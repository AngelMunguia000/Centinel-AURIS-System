"""Vigilancia por cámara en la Pi (edge/PENDIENTES.md "Video y evidencia", decisión del PO 2026-10-24).

Sin sensor de movimiento, la cámara del nodo es el sensor: cada segundo la Pi pide /capture,
compara con la foto anterior en miniatura y en grises, y si cambió lo suficiente en dos fotos
seguidas genera el evento `movimiento` (severidad alta: abre incidencia si el lugar está armado),
guarda la foto como evidencia y decide la disuasión (application/disuasion.py).
"""

import asyncio
import io
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Awaitable, Callable, Dict, List, Optional, Protocol, Sequence, Tuple

import httpx
from PIL import Image, ImageChops, ImageDraw, ImageFont

from centinela_gateway.adapters.vision import Hallazgo
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.application.disuasion import Disuasor
from centinela_gateway.application.puente import Puente

log = logging.getLogger("centinela.camaras")

Publicar = Callable[[str, bytes], Awaitable[None]]


class Detector(Protocol):
    def detectar(self, jpeg: bytes) -> List[Hallazgo]: ...


PROTEGIDAS = {"person"}  # nunca se disuade con alguien a la vista (en un buque hay tripulación)
NOMBRES = {"bird": ("ave", "aves"), "person": ("persona", "personas")}

TAMANO = (64, 48)
UMBRAL_PIXEL = 25  # diferencia de gris (0-255) para contar un pixel como cambiado: ignora ruido del sensor
UMBRAL_AREA = 0.03  # fracción de la imagen que debe cambiar
CUADROS_SEGUIDOS = 2  # un parpadeo de luz cambia una foto, una persona o un animal varias
ESPERA_ENTRE_EVENTOS_S = 30  # una presencia larga no inunda la Bitácora
EVIDENCIA_MAX_S = 24 * 3600  # una foto que la web nunca aceptó se descarta tras un día
# Resultado de la disuasión: 20 s después de la ráfaga, ¿la escena volvió a como estaba antes de la intrusión?
# Se compara con la foto previa al movimiento (no "¿hubo movimiento?": huir también es moverse).
ESPERA_RESULTADO_S = 20


def marcar(jpeg: bytes, hallazgos: List[Hallazgo]) -> bytes:
    """La evidencia con un recuadro en cada hallazgo: verde lo que se ahuyenta, azul lo protegido."""
    img = Image.open(io.BytesIO(jpeg)).convert("RGB")
    dibujo = ImageDraw.Draw(img)
    letra = ImageFont.load_default(size=max(12, img.height // 45))  # legible igual en 640 que en 1280 px
    for h in hallazgos:
        color = (0, 160, 255) if h.clase in PROTEGIDAS else (40, 220, 120)
        dibujo.rectangle(h.caja, outline=color, width=max(2, img.height // 300))
        texto, origen = f"{NOMBRES.get(h.clase, (h.clase,))[0]} {round(h.confianza * 100)}%", (h.caja[0], max(0, h.caja[1] - letra.size - 4))
        dibujo.rectangle(dibujo.textbbox(origen, texto, font=letra), fill=(0, 0, 0))  # fondo: se lee sobre cielo o plumas claras
        dibujo.text(origen, texto, fill=color, font=letra)
    salida = io.BytesIO()
    img.save(salida, "JPEG", quality=90)
    return salida.getvalue()


def miniatura(jpeg: bytes) -> Image.Image:
    return Image.open(io.BytesIO(jpeg)).convert("L").resize(TAMANO)


def fraccion_cambiada(a: Image.Image, b: Image.Image) -> float:
    histograma = ImageChops.difference(a, b).histogram()
    return sum(histograma[UMBRAL_PIXEL + 1 :]) / (TAMANO[0] * TAMANO[1])


class Vigilante:
    def __init__(
        self,
        puente: Puente,
        http: httpx.AsyncClient,
        evidencias: Path,
        disuasor: Optional[Disuasor] = None,
        publicar: Optional[Publicar] = None,
        reloj: Callable[[], float] = time.monotonic,
        detector: Optional[Detector] = None,
        objetivos: Sequence[str] = ("bird",),
    ) -> None:
        self.puente, self.http, self.evidencias = puente, http, evidencias
        self.disuasor = disuasor or Disuasor()
        self.publicar = publicar
        self.reloj = reloj
        self.detector = detector  # sin detector: todo movimiento se disuade (comportamiento previo)
        self.objetivos = set(objetivos)
        self._previa: Dict[str, Image.Image] = {}
        self._seguidos: Dict[str, int] = {}
        self._ultimo: Dict[str, float] = {}
        self._referencia: Dict[str, Image.Image] = {}  # escena justo antes de que empezara el movimiento
        self._pendientes: Dict[str, Tuple[str, float, Image.Image]] = {}  # disuasión → (id, cuándo medir, referencia)

    async def revisar(self) -> None:
        for node_id, ip in self.puente.camaras().items():
            try:
                res = await self.http.get(f"http://{ip}/capture", timeout=3.0)
                res.raise_for_status()
                jpeg = res.content
                actual = miniatura(jpeg)
            except (httpx.HTTPError, OSError) as error:  # OSError cubre un JPEG ilegible (PIL)
                log.debug("sin foto de %s: %s", node_id, error)
                continue
            self._medir_resultado(node_id, actual)
            previa = self._previa.get(node_id)
            self._previa[node_id] = actual
            if previa is None:
                continue
            cambio = fraccion_cambiada(previa, actual)
            if cambio >= UMBRAL_AREA and not self._seguidos.get(node_id):
                self._referencia[node_id] = previa  # la escena vacía, antes del primer cuadro con movimiento
            self._seguidos[node_id] = self._seguidos.get(node_id, 0) + 1 if cambio >= UMBRAL_AREA else 0
            ahora = self.reloj()
            if self._seguidos[node_id] < CUADROS_SEGUIDOS or ahora - self._ultimo.get(node_id, float("-inf")) < ESPERA_ENTRE_EVENTOS_S:
                continue
            self._ultimo[node_id] = ahora
            self._seguidos[node_id] = 0
            await self._movimiento(node_id, jpeg, cambio)

    async def _movimiento(self, node_id: str, jpeg: bytes, cambio: float) -> None:
        texto_movimiento = f"Movimiento detectado por la cámara ({round(cambio * 100)} % de la imagen)"
        if self.detector is None:
            self._guardar(node_id, "movimiento", "alta", texto_movimiento, jpeg)
            await self._disuadir(node_id)
            return
        try:
            hallazgos = await asyncio.to_thread(self.detector.detectar, jpeg)  # ~0.1-0.4 s en la Pi: fuera del loop
        except Exception as error:  # un modelo que falla no debe tumbar la vigilancia: se registra el movimiento
            log.warning("visión falló en %s: %s", node_id, error)
            hallazgos = []
        objetivo = [h for h in hallazgos if h.clase in self.objetivos]
        protegida = next((h.clase for h in hallazgos if h.clase in PROTEGIDAS), None)
        if not objetivo:
            self._guardar(node_id, "movimiento", "baja", texto_movimiento, jpeg)
            self._sin_disuadir(node_id, "no se vio ningún objetivo")
            return
        clase = objetivo[0].clase
        singular, plural = NOMBRES.get(clase, (clase, clase))
        detalle = f"Detectado por la cámara: {len(objetivo)} {singular if len(objetivo) == 1 else plural} (máx. {round(max(h.confianza for h in objetivo) * 100)} %)"
        if protegida:
            detalle += f", con {NOMBRES.get(protegida, (protegida,))[0]} a la vista"
        self._guardar(node_id, "deteccion", "alta", detalle, marcar(jpeg, [h for h in hallazgos if h.clase in self.objetivos | PROTEGIDAS]))
        if protegida:
            self._sin_disuadir(node_id, f"hay una {NOMBRES.get(protegida, (protegida,))[0]} a la vista")
            return
        await self._disuadir(node_id)

    def _guardar(self, node_id: str, tipo: str, severidad: str, detalle: str, jpeg: bytes) -> None:
        evento_id = self.puente.encolar_evento(node_id, tipo, severidad, detalle)
        self.evidencias.mkdir(parents=True, exist_ok=True)
        (self.evidencias / f"{evento_id}.jpg").write_bytes(jpeg)
        log.info("%s en %s: %s (evidencia %s)", tipo, node_id, detalle, evento_id)

    def _sin_disuadir(self, node_id: str, motivo: str) -> None:
        self.puente.encolar_evento(node_id, "disuasion", "baja", f"Sin disuadir: {motivo}", {"ejecutada": False, "motivo": motivo})

    async def _disuadir(self, node_id: str) -> None:
        # None = la web aún no dijo: el nodo arranca armado, la Pi también.
        if self.puente.armado is False:
            self._sin_disuadir(node_id, "el lugar está desarmado")
            return
        rafaga, motivo = self.disuasor.decidir(node_id, int(self.reloj() * 1000))
        if rafaga is None:
            self._sin_disuadir(node_id, motivo)
            return
        comando = {"v": 1, "cmd_id": f"disuasion-{uuid.uuid4()}", "pattern": rafaga.familia, "duracion_ms": rafaga.duracion_ms, "ganancia": rafaga.ganancia}
        try:
            if self.publicar is None:
                raise ConnectionError("sin broker")
            await self.publicar(f"centinel/{node_id}/command/audio", json.dumps(comando).encode())
        except (ConnectionError, OSError) as error:
            self._sin_disuadir(node_id, f"broker no disponible ({error})")
            return
        datos = {"ejecutada": True, "patron": rafaga.familia, "duracion_ms": rafaga.duracion_ms, "ganancia": rafaga.ganancia}
        id_ = self.puente.encolar_evento(node_id, "disuasion", "baja", f"Ráfaga {rafaga.familia} de {rafaga.duracion_ms / 1000:.1f} s", datos)
        referencia = self._referencia.get(node_id)
        if referencia is not None:
            self._pendientes[node_id] = (id_, self.reloj() + rafaga.duracion_ms / 1000 + ESPERA_RESULTADO_S, referencia)

    def _medir_resultado(self, node_id: str, actual: Image.Image) -> None:
        pendiente = self._pendientes.get(node_id)
        if pendiente is None or self.reloj() < pendiente[1]:
            return
        del self._pendientes[node_id]
        id_, _, referencia = pendiente
        exito = fraccion_cambiada(referencia, actual) < UMBRAL_AREA
        detalle = "La escena volvió a la normal tras la ráfaga" if exito else "La presencia siguió tras la ráfaga"
        self.puente.encolar_evento(node_id, "disuasion_resultado", "baja", detalle, {"disuasion_id": id_, "exito": exito})

    async def bucle(self, intervalo: float = 1.0) -> None:
        while True:
            await self.revisar()
            await asyncio.sleep(intervalo)


async def subir_evidencias(web: ClienteWeb, carpeta: Path, ahora: Callable[[], float] = time.time) -> None:
    """Sube las fotos pendientes. La web responde 404 hasta que le llega el evento (cola de eventos): se reintenta."""
    if not carpeta.exists():
        return
    for archivo in sorted(carpeta.glob("*.jpg")):
        resultado = await web.enviar_evidencia(archivo.stem, archivo.read_bytes())
        if resultado != "reintentar" or ahora() - archivo.stat().st_mtime > EVIDENCIA_MAX_S:
            archivo.unlink(missing_ok=True)


async def bucle_evidencias(web: ClienteWeb, carpeta: Path, intervalo: float = 3.0) -> None:
    while True:
        await subir_evidencias(web, carpeta)
        await asyncio.sleep(intervalo)

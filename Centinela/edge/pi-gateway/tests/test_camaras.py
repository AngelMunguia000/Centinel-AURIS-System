"""Cámara como sensor, evidencia y disuasión por presencia (application/camaras.py, disuasion.py)."""

import io
import json
import random

import httpx
import pytest
import respx
from PIL import Image

from centinela_gateway.adapters.cola import Cola
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.application.camaras import Vigilante, subir_evidencias
from centinela_gateway.application.disuasion import CICLO_MAX, VENTANA_MS, Disuasor
from centinela_gateway.application.puente import Puente

WEB = "http://web.test"
NODO = "node-0000000000c1"
IP = "192.168.1.77"
CAPS = {"led": "real", "pantilt": "simulado", "audio": "simulado", "camara": "real"}


def _jpeg(blanco: float) -> bytes:
    """Foto negra con una franja blanca que ocupa `blanco` del ancho."""
    img = Image.new("RGB", (320, 240), "black")
    if blanco:
        img.paste((255, 255, 255), (0, 0, int(320 * blanco), 240))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


class Reloj:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t


@pytest.fixture
async def entorno(tmp_path):
    async with httpx.AsyncClient() as http:
        puente = Puente(ClienteWeb(WEB, "token", http), Cola(str(tmp_path / "cola.db")))
        puente.manejar(f"centinel/{NODO}/status", json.dumps({"v": 1, "state": "online", "fw": "0.2.0", "capacidades": CAPS, "ip": IP}).encode())
        publicados = []

        async def publicar(topico, datos):
            publicados.append((topico, json.loads(datos)))

        reloj = Reloj()
        vigilante = Vigilante(puente, http, tmp_path / "evidencias", Disuasor(random.Random(1)), publicar, reloj)
        yield puente, vigilante, publicados, reloj, tmp_path


def _eventos(puente):
    return [(e["tipo"], e.get("detalle", "")) for e in puente.cola.pendientes() if e["tipo"] != "conexion"]


@respx.mock
async def test_movimiento_genera_evento_evidencia_y_disuasion(entorno):
    puente, vigilante, publicados, reloj, tmp = entorno
    assert puente.camaras() == {NODO: IP}
    ruta = respx.get(f"http://{IP}/capture")
    for foto in (_jpeg(0), _jpeg(0), _jpeg(0.5)):  # base, sin cambio, primer cambio
        ruta.mock(return_value=httpx.Response(200, content=foto))
        await vigilante.revisar()
    assert _eventos(puente) == []  # un solo cuadro distinto no basta (parpadeo de luz)

    ruta.mock(return_value=httpx.Response(200, content=_jpeg(0)))
    await vigilante.revisar()  # segundo cuadro con cambio: ahora sí
    tipos = [t for t, _ in _eventos(puente)]
    assert tipos == ["movimiento", "disuasion"]
    movimiento = next(e for e in puente.cola.pendientes() if e["tipo"] == "movimiento")
    assert movimiento["severidad"] == "alta"
    assert (tmp / "evidencias" / f"{movimiento['id']}.jpg").exists()
    topico, comando = publicados[0]
    assert topico == f"centinel/{NODO}/command/audio" and comando["v"] == 1 and comando["pattern"]

    # Presencia que sigue: no se repite el evento antes de 30 s.
    for foto in (_jpeg(0.5), _jpeg(0)):
        ruta.mock(return_value=httpx.Response(200, content=foto))
        await vigilante.revisar()
    assert len(_eventos(puente)) == 2


@respx.mock
async def test_desarmado_registra_sin_disuadir(entorno):
    puente, vigilante, publicados, _, _ = entorno
    puente.armado = False
    ruta = respx.get(f"http://{IP}/capture")
    for foto in (_jpeg(0), _jpeg(0.6), _jpeg(0)):
        ruta.mock(return_value=httpx.Response(200, content=foto))
        await vigilante.revisar()
    assert _eventos(puente)[-1] == ("disuasion", "Sin disuadir: el lugar está desarmado")
    assert publicados == []


@respx.mock
async def test_camara_caida_no_rompe_el_bucle(entorno):
    puente, vigilante, _, _, _ = entorno
    respx.get(f"http://{IP}/capture").mock(side_effect=httpx.ConnectError("sin red"))
    await vigilante.revisar()
    respx.get(f"http://{IP}/capture").mock(return_value=httpx.Response(200, content=b"no es un jpeg"))
    await vigilante.revisar()
    assert _eventos(puente) == []


def test_disuasor_antihabituacion_y_ciclo_de_trabajo():
    d = Disuasor(random.Random(7))
    familias, emisiones, motivos = [], [], set()
    # Presencia constante, un intento por segundo durante 10 min: el enfriamiento deja ráfagas cada
    # ~10 s (≈ 25 %), así que el límite del 20 % tiene que cortar alguna.
    for t in range(0, 600_000, 1_000):
        rafaga, motivo = d.decidir(NODO, t)
        if rafaga is None:
            motivos.add(motivo)
            continue
        assert rafaga.familia not in familias[-3:]  # nunca uno de los últimos 3
        assert 500 <= rafaga.duracion_ms <= 3000
        familias.append(rafaga.familia)
        emisiones.append((t, rafaga.duracion_ms))
        # En ningún minuto suena más del 20 %.
        assert sum(dur for ini, dur in emisiones if t - ini < VENTANA_MS) <= CICLO_MAX * VENTANA_MS
    assert "en enfriamiento tras la ráfaga anterior" in motivos

    # Cerca del tope: recorta la ráfaga a lo que queda del 20 %, y si no queda nada la niega.
    d = Disuasor(random.Random(3))
    d._emisiones[NODO] = [(0, 11_000)]
    rafaga, _ = d.decidir(NODO, 20_000)  # pasado el enfriamiento (0 + 11 s + 8 s)
    assert rafaga is not None and rafaga.duracion_ms == 1_000
    assert d.decidir(NODO, 30_000) == (None, "límite de ciclo de trabajo alcanzado")


@respx.mock
async def test_sube_evidencias_y_reintenta_si_la_web_aun_no_tiene_el_evento(tmp_path):
    carpeta = tmp_path / "evidencias"
    carpeta.mkdir()
    (carpeta / "evt-1.jpg").write_bytes(b"jpeg1")
    (carpeta / "evt-2.jpg").write_bytes(b"jpeg2")
    (carpeta / "evt-3.jpg").write_bytes(b"jpeg3")
    respx.put(f"{WEB}/api/edge/evidencia/evt-1").mock(return_value=httpx.Response(200, json={"ok": True}))
    respx.put(f"{WEB}/api/edge/evidencia/evt-2").mock(return_value=httpx.Response(404))
    respx.put(f"{WEB}/api/edge/evidencia/evt-3").mock(return_value=httpx.Response(413))
    async with httpx.AsyncClient() as http:
        await subir_evidencias(ClienteWeb(WEB, "token", http), carpeta)
    assert sorted(p.name for p in carpeta.iterdir()) == ["evt-2.jpg"]  # solo queda la que hay que reintentar
    assert respx.calls[0].request.headers["content-type"] == "image/jpeg"


@respx.mock
async def test_api_reenvia_el_video_del_nodo():
    from centinela_gateway.adapters.http import crear_app

    respx.route(host="pi").pass_through()  # la propia API (ASGI) no se simula
    url = f"http://{IP}:81/stream"
    tipo = "multipart/x-mixed-replace;boundary=centinelaframe"
    app = crear_app("hash", lambda p: None, lambda: 0, lambda n: url if n == NODO else None)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://pi") as c:
        assert (await c.get(f"/v1/camaras/{NODO}/stream")).status_code == 401
        auth = {"authorization": "Bearer hash"}
        assert (await c.get("/v1/camaras/node-0000000000ff/stream", headers=auth)).status_code == 404
        respx.get(url).mock(return_value=httpx.Response(200, content=b"--centinelaframe\r\nfoto", headers={"content-type": tipo}))
        res = await c.get(f"/v1/camaras/{NODO}/stream", headers=auth)
        assert res.status_code == 200 and res.headers["content-type"] == tipo and res.content == b"--centinelaframe\r\nfoto"
        respx.get(url).mock(side_effect=httpx.ConnectError("caída"))
        assert (await c.get(f"/v1/camaras/{NODO}/stream", headers=auth)).status_code == 502


async def test_url_del_video_segun_el_nodo(entorno):
    puente = entorno[0]
    assert puente.url_video(NODO) == f"http://{IP}:81/stream"  # firmware: video en :81
    puente.manejar("centinel/node-0000000000c2/status", json.dumps({"v": 1, "state": "online", "capacidades": CAPS, "ip": "127.0.0.1:8081"}).encode())
    assert puente.url_video("node-0000000000c2") == "http://127.0.0.1:8081/stream"  # nodo virtual
    assert puente.url_video("node-0000000000ff") is None


@respx.mock
async def test_resultado_de_la_disuasion_compara_con_la_escena_previa(entorno):
    puente, vigilante, _, reloj, _ = entorno
    ruta = respx.get(f"http://{IP}/capture")

    async def foto(blanco):
        ruta.mock(return_value=httpx.Response(200, content=_jpeg(blanco)))
        await vigilante.revisar()

    def resultados():
        return [e["datos"]["exito"] for e in puente.cola.pendientes() if e["tipo"] == "disuasion_resultado"]

    for b in (0, 0, 0.5, 0):  # escena vacía, entra alguien, se va: movimiento + ráfaga
        await foto(b)
    disuasion = next(e for e in puente.cola.pendientes() if e["tipo"] == "disuasion")
    assert disuasion["datos"]["ejecutada"] is True and disuasion["datos"]["patron"]

    await foto(0)
    assert resultados() == []  # aún no pasan los 20 s
    reloj.t += 30
    await foto(0)  # la escena volvió a la de antes: funcionó
    assert resultados() == [True]
    res = next(e for e in puente.cola.pendientes() if e["tipo"] == "disuasion_resultado")
    assert res["datos"]["disuasion_id"] == disuasion["id"]

    # Otra intrusión que no se va.
    reloj.t += 60
    for b in (0, 0.5, 0.4):
        await foto(b)
    reloj.t += 30
    await foto(0.5)
    assert resultados() == [True, False]


@respx.mock
async def test_sin_disuadir_manda_el_motivo_estructurado(entorno):
    puente, vigilante, _, _, _ = entorno
    puente.armado = False
    ruta = respx.get(f"http://{IP}/capture")
    for b in (0, 0.6, 0):
        ruta.mock(return_value=httpx.Response(200, content=_jpeg(b)))
        await vigilante.revisar()
    e = next(e for e in puente.cola.pendientes() if e["tipo"] == "disuasion")
    assert e["datos"] == {"ejecutada": False, "motivo": "el lugar está desarmado"}


class DetectorFalso:
    """Lo que "vería" YOLO en la foto; la prueba lo cambia según el caso."""

    def __init__(self, hallazgos):
        self.hallazgos = hallazgos

    def detectar(self, jpeg):
        return self.hallazgos


async def _provocar_movimiento(vigilante):
    ruta = respx.get(f"http://{IP}/capture")
    for foto in (_jpeg(0), _jpeg(0.5), _jpeg(0)):
        ruta.mock(return_value=httpx.Response(200, content=foto))
        await vigilante.revisar()


@respx.mock
async def test_con_vision_un_ave_genera_deteccion_y_disuasion(entorno):
    from centinela_gateway.adapters.vision import Hallazgo

    puente, vigilante, publicados, _, tmp = entorno
    vigilante.detector = DetectorFalso([Hallazgo("bird", 0.86, (10, 10, 60, 50)), Hallazgo("bird", 0.6, (100, 20, 140, 60))])
    await _provocar_movimiento(vigilante)
    assert [t for t, _ in _eventos(puente)] == ["deteccion", "disuasion"]
    deteccion = next(e for e in puente.cola.pendientes() if e["tipo"] == "deteccion")
    assert deteccion["severidad"] == "alta" and deteccion["detalle"] == "Detectado por la cámara: 2 aves (máx. 86 %)"
    # La evidencia lleva un recuadro en cada ave: la foto negra ahora tiene pixeles de color en el borde de la caja.
    evidencia = Image.open(tmp / "evidencias" / f"{deteccion['id']}.jpg").convert("RGB")
    assert sum(evidencia.getpixel((10, 30))) > 200 and sum(evidencia.getpixel((35, 30))) < 30  # JPEG: casi negro
    assert publicados and publicados[0][0] == f"centinel/{NODO}/command/audio"


@respx.mock
async def test_con_vision_nunca_disuade_si_hay_una_persona(entorno):
    from centinela_gateway.adapters.vision import Hallazgo

    puente, vigilante, publicados, _, _ = entorno
    vigilante.detector = DetectorFalso([Hallazgo("bird", 0.9), Hallazgo("person", 0.7)])
    await _provocar_movimiento(vigilante)
    eventos = _eventos(puente)
    assert eventos[0] == ("deteccion", "Detectado por la cámara: 1 ave (máx. 90 %), con persona a la vista")
    assert eventos[1] == ("disuasion", "Sin disuadir: hay una persona a la vista")
    assert publicados == []


@respx.mock
async def test_con_vision_movimiento_sin_objetivo_no_disuade(entorno):
    from centinela_gateway.adapters.vision import Hallazgo

    puente, vigilante, publicados, _, _ = entorno
    vigilante.detector = DetectorFalso([Hallazgo("dog", 0.8)])
    await _provocar_movimiento(vigilante)
    movimiento = next(e for e in puente.cola.pendientes() if e["tipo"] == "movimiento")
    assert movimiento["severidad"] == "baja"
    assert _eventos(puente)[-1] == ("disuasion", "Sin disuadir: no se vio ningún objetivo")
    assert publicados == []

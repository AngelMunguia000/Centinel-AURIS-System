"""Puente MQTT (ESP32) ↔ HTTP (web): el caso de uso central del gateway.

Spec: docs/diseno/2026-10-16-enlace-edge-design.md §4 y §8.
"""

import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from pydantic import ValidationError

from centinela_gateway.adapters.cola import Cola
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.domain.modelos import NODE_ID_PATRON, Ack, EventoNodo, Status, Telemetria

log = logging.getLogger("centinela.puente")

TOPICOS = ("status", "telemetry", "events", "ack")
# Retenido: un nodo que se conecta recibe el estado actual al suscribirse.
TOPICO_ARMADO = "centinel/sistema/armado"
Publicar = Callable[[str, bytes, bool], Awaitable[None]]
_NODE_ID = re.compile(NODE_ID_PATRON)
# Namespace fijo: el mismo (node_id, id local) da siempre el mismo uuid en la web.
_NS_EVENTOS = uuid.UUID("6f1c1b8e-6a43-4e57-9d0e-2f5a6c1d7e90")


def _ahora_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Puente:
    def __init__(self, web: ClienteWeb, cola: Cola, ahora: Callable[[], str] = _ahora_iso) -> None:
        self.web = web
        self.cola = cola
        self._ahora = ahora
        self._nodos: Dict[str, Dict[str, Any]] = {}
        self._esperas: Dict[str, "asyncio.Future[Ack]"] = {}
        self.armado: Optional[bool] = None  # último estado que se repartió a los nodos

    # ---- entrada MQTT -------------------------------------------------------

    def manejar(self, topico: str, payload: bytes) -> None:
        """Procesa un mensaje del broker. Nunca lanza: lo malformado se registra y se descarta."""
        partes = topico.split("/")
        if len(partes) != 3 or partes[0] != "centinel" or not _NODE_ID.match(partes[1]) or partes[2] not in TOPICOS:
            log.warning("mensaje descartado: tópico inesperado %r", topico)
            return
        node_id, tipo = partes[1], partes[2]
        try:
            datos = json.loads(payload)
            if tipo == "status":
                self._status(node_id, Status.model_validate(datos))
            elif tipo == "telemetry":
                self._nodo(node_id)["telemetria"] = Telemetria.model_validate(datos).model_dump(exclude={"v"})
            elif tipo == "events":
                self._evento_del_nodo(node_id, EventoNodo.model_validate(datos))
            else:
                ack = Ack.model_validate(datos)
                espera = self._esperas.pop(ack.cmd_id, None)
                if espera and not espera.done():
                    espera.set_result(ack)
        except (ValueError, ValidationError) as error:
            log.warning("mensaje descartado en %s: %s", topico, str(error).splitlines()[0])

    def _nodo(self, node_id: str) -> Dict[str, Any]:
        return self._nodos.setdefault(node_id, {"online": False, "fw": None, "capacidades": None, "telemetria": None, "ip": None})

    def camaras(self) -> Dict[str, str]:
        """node_id → IP de los nodos en línea con cámara real (application/camaras.py)."""
        return {
            node_id: n["ip"]
            for node_id, n in self._nodos.items()
            if n["online"] and n["ip"] and (n["capacidades"] or {}).get("camara") == "real"
        }

    def url_video(self, node_id: str) -> Optional[str]:
        """Video MJPEG del nodo: el firmware lo sirve en :81; el nodo virtual ("ip:puerto") en su mismo puerto."""
        ip = self.camaras().get(node_id)
        if ip is None:
            return None
        return f"http://{ip}/stream" if ":" in ip else f"http://{ip}:81/stream"

    def encolar_evento(self, node_id: str, tipo: str, severidad: str, detalle: Optional[str], datos: Optional[Dict[str, Any]] = None) -> str:
        """Evento generado en la Pi (movimiento por cámara, disuasión). `datos` va estructurado a la web. Devuelve su id."""
        id_ = str(uuid.uuid4())
        self._encolar(node_id, tipo, severidad, detalle, id_, datos)
        return id_

    def _status(self, node_id: str, status: Status) -> None:
        nodo = self._nodo(node_id)
        online = status.state == "online"
        if status.fw:
            nodo["fw"] = status.fw
        if status.capacidades:
            nodo["capacidades"] = status.capacidades.model_dump()
        if status.ip:
            nodo["ip"] = status.ip
        if online != nodo["online"]:
            nodo["online"] = online
            self._encolar(node_id, "conexion", "baja" if online else "media", "online" if online else "offline", str(uuid.uuid4()))

    def _evento_del_nodo(self, node_id: str, evento: EventoNodo) -> None:
        # El ESP32 no tiene reloj ni uuid: la Pi le da hora de recepción e id determinista.
        self._encolar(node_id, evento.tipo, evento.severidad, evento.detalle, str(uuid.uuid5(_NS_EVENTOS, f"{node_id}:{evento.id}")))

    def _encolar(self, node_id: str, tipo: str, severidad: str, detalle: Optional[str], id_: str, datos: Optional[Dict[str, Any]] = None) -> None:
        evento: Dict[str, Any] = {"id": id_, "node_id": node_id, "tipo": tipo, "severidad": severidad, "ocurrido_en": self._ahora()}
        if detalle:
            evento["detalle"] = detalle
        if datos:
            evento["datos"] = datos
        self.cola.encolar(evento)

    def nodos_en_linea(self) -> List[Dict[str, Any]]:
        """Solo nodos en línea con telemetría: un nodo caído no debe "revivir" en la web por un latido."""
        salida = []
        for node_id, n in self._nodos.items():
            if n["online"] and n["telemetria"] is not None:
                item: Dict[str, Any] = {"node_id": node_id, "telemetria": n["telemetria"]}
                if n["fw"]:
                    item["fw"] = n["fw"]
                if n["capacidades"]:
                    item["capacidades"] = n["capacidades"]
                salida.append(item)
        return salida

    def esperar_ack(self, cmd_id: str) -> "asyncio.Future[Ack]":
        futuro: "asyncio.Future[Ack]" = asyncio.get_running_loop().create_future()
        self._esperas[cmd_id] = futuro
        return futuro

    def cancelar_espera(self, cmd_id: str) -> None:
        self._esperas.pop(cmd_id, None)

    # ---- salida HTTP --------------------------------------------------------

    async def latido(self, publicar: Optional[Publicar] = None) -> None:
        armado = await self.web.enviar_telemetria(self.nodos_en_linea())
        # Armado por lugar (roadmap #4): la web decide, la Pi lo reparte a sus nodos. Si la web no
        # respondió se conserva el último valor conocido; los nodos no deben quedar desarmados por un corte.
        if armado is None or armado == self.armado:
            return
        if publicar is not None:
            try:
                await publicar(TOPICO_ARMADO, json.dumps({"v": 1, "armado": armado}).encode(), True)
            except ConnectionError as error:
                log.warning("no se pudo avisar el armado a los nodos: %s", error)
                return  # se reintenta en el siguiente latido
        log.info("lugar %s", "armado" if armado else "desarmado")
        self.armado = armado

    async def bucle_latido(self, intervalo: float = 2.0, publicar: Optional[Publicar] = None) -> None:
        while True:
            await self.latido(publicar)
            await asyncio.sleep(intervalo)

    async def drenar(self) -> bool:
        """Envía un lote de la cola. True si la cola quedó vacía."""
        pendientes = self.cola.pendientes()
        if not pendientes:
            return True
        if not await self.web.enviar_eventos(pendientes):
            return False
        self.cola.confirmar([e["id"] for e in pendientes])
        return not self.cola.pendientes()

    async def bucle_drenado(self, minimo: float = 1.0, maximo: float = 30.0) -> None:
        espera = minimo
        while True:
            espera = minimo if await self.drenar() else min(espera * 2, maximo)
            await asyncio.sleep(espera)

    # ---- MQTT ---------------------------------------------------------------

    async def suscribir(self, cliente: Any) -> None:
        for tipo in TOPICOS:
            await cliente.subscribe(f"centinel/+/{tipo}", qos=1)

    async def escuchar(self, cliente: Any) -> None:
        async for mensaje in cliente.messages:
            self.manejar(str(mensaje.topic), bytes(mensaje.payload))

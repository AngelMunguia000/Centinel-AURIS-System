"""ESP32 virtual: el mismo protocolo MQTT que el firmware (spec §4.1), para probar sin placa.

    python -m simulador.nodo_virtual --node-id node-0000000000a1 [--host 127.0.0.1] [--evento alta] [--camara 8081]

Con --camara sirve /capture en ese puerto: una escena quieta en la que cada ~20 s entra un "intruso"
unos segundos, para probar la cadena cámara → movimiento → evidencia → disuasión sin la placa.

Para simular un corte real (y ver el LWT en la web) hay que MATAR el proceso (cerrar la
terminal o taskkill); Ctrl+C se desconecta limpio y el broker no publica el Last Will.
"""

import argparse
import asyncio
import itertools
import json
import logging
import random
import re
import sys
import time
import uuid
from io import BytesIO

import aiomqtt
from PIL import Image, ImageDraw
from pydantic import ValidationError

from centinela_gateway.domain.modelos import NODE_ID_PATRON, ComandoAudio, ComandoPantilt, ComandoSystem

log = logging.getLogger("nodo_virtual")

CAPACIDADES = {"led": "real", "pantilt": "simulado", "audio": "simulado", "camara": "ausente"}
FW = "0.1.0-virtual"
MODELOS = {"pantilt": ComandoPantilt, "audio": ComandoAudio, "system": ComandoSystem}


def escena(segundo: float) -> bytes:
    """JPEG de la cámara virtual: patio quieto; de 0 a 4 s de cada 20 cruza un intruso."""
    img = Image.new("RGB", (320, 240), (40, 60, 40))
    dibujo = ImageDraw.Draw(img)
    dibujo.rectangle((0, 170, 320, 240), fill=(70, 70, 70))
    fase = segundo % 20
    if fase < 4:
        x = int(40 + fase * 60)
        dibujo.rectangle((x, 90, x + 60, 200), fill=(200, 180, 160))
    buf = BytesIO()
    img.save(buf, "JPEG", quality=70)
    return buf.getvalue()


async def servir_camara(puerto: int, inicio: float) -> asyncio.base_events.Server:
    """HTTP mínimo: GET /capture → JPEG y GET /stream → MJPEG (~5 fps), como la cámara del firmware."""

    async def atender(lector: asyncio.StreamReader, escritor: asyncio.StreamWriter) -> None:
        linea = await lector.readline()
        while (await lector.readline()) not in (b"\r\n", b""):
            pass
        if linea.startswith(b"GET /stream"):
            escritor.write(b"HTTP/1.1 200 OK\r\nContent-Type: multipart/x-mixed-replace;boundary=centinelaframe\r\nConnection: close\r\n\r\n")
            try:
                while True:
                    jpeg = escena(time.monotonic() - inicio)
                    escritor.write(b"\r\n--centinelaframe\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\n\r\n" % len(jpeg) + jpeg)
                    await escritor.drain()
                    await asyncio.sleep(0.2)
            except (ConnectionError, OSError):
                return  # el espectador cerró
        if linea.startswith(b"GET /capture"):
            jpeg = escena(time.monotonic() - inicio)
            escritor.write(b"HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nContent-Length: %d\r\nConnection: close\r\n\r\n" % len(jpeg) + jpeg)
        else:
            escritor.write(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
        await escritor.drain()
        escritor.close()

    return await asyncio.start_server(atender, "127.0.0.1", puerto)


async def correr(node_id: str, host: str, puerto: int = 1883, intervalo: float = 2.0, evento: str = "", eventos_cada: float = 0, camara: int = 0) -> None:
    base = f"centinel/{node_id}"
    estado = {"led": False, "pan": 90.0, "tilt": 0.0, "armado": True}
    arranque = uuid.uuid4().hex[:8]  # prefijo por arranque: los ids de evento no se repiten tras reiniciar
    inicio = time.monotonic()
    will = aiomqtt.Will(f"{base}/status", json.dumps({"v": 1, "state": "offline", "reason": "lwt"}), qos=1, retain=True)

    servidor = await servir_camara(camara, inicio) if camara else None
    capacidades = {**CAPACIDADES, "camara": "real"} if camara else CAPACIDADES
    status = {"v": 1, "state": "online", "fw": FW, "capacidades": capacidades, **({"ip": f"127.0.0.1:{camara}"} if camara else {})}

    async with aiomqtt.Client(host, puerto, identifier=node_id, keepalive=10, will=will) as c:
        await c.publish(f"{base}/status", json.dumps(status), qos=1, retain=True)
        await c.subscribe(f"{base}/command/+", qos=1)
        await c.subscribe("centinel/sistema/armado", qos=1)
        log.info("nodo %s en línea en %s:%s", node_id, host, puerto)
        if evento:
            await c.publish(
                f"{base}/events",
                json.dumps({"v": 1, "id": f"{arranque}-1", "tipo": "prueba", "severidad": evento, "detalle": "Evento de prueba del nodo virtual", "ts_ms": 0}),
                qos=1,
            )

        async def telemetria() -> None:
            while True:
                await c.publish(
                    f"{base}/telemetry",
                    json.dumps({
                        "v": 1,
                        "ts_ms": int((time.monotonic() - inicio) * 1000),
                        "temp_c": round(random.uniform(40, 45), 1),
                        "rssi_dbm": random.randint(-70, -55),
                        "uptime_s": int(time.monotonic() - inicio),
                        "heap_libre": random.randint(180_000, 220_000),
                        "pan_deg": estado["pan"],
                        "tilt_deg": estado["tilt"],
                    }),
                    qos=0,
                )
                await asyncio.sleep(intervalo)

        async def eventos_periodicos() -> None:
            # Para la demo sin hardware: sobre todo movimiento leve, y de vez en cuando una alerta alta.
            for k in itertools.count(2):
                await asyncio.sleep(eventos_cada)
                severidad = random.choices(["baja", "media", "alta"], weights=[6, 3, 1])[0]
                await c.publish(
                    f"{base}/events",
                    json.dumps({"v": 1, "id": f"{arranque}-{k}", "tipo": "movimiento", "severidad": severidad,
                                "detalle": "Movimiento detectado (simulado)", "ts_ms": int((time.monotonic() - inicio) * 1000)}),
                    qos=1,
                )

        tareas = [asyncio.ensure_future(telemetria())]
        if eventos_cada > 0:
            tareas.append(asyncio.ensure_future(eventos_periodicos()))
        try:
            async for m in c.messages:
                if str(m.topic) == "centinel/sistema/armado":
                    estado["armado"] = json.loads(bytes(m.payload)).get("armado", True) is not False
                    log.info("lugar %s", "armado" if estado["armado"] else "desarmado")
                    continue
                tipo = str(m.topic).rsplit("/", 1)[-1]
                await c.publish(f"{base}/ack", json.dumps(_atender(tipo, bytes(m.payload), estado)), qos=1)
        finally:
            for t in tareas:
                t.cancel()
            if servidor:
                servidor.close()


def _atender(tipo: str, payload: bytes, estado: dict) -> dict:
    """Valida igual que el firmware (rangos incluidos) y responde el ack."""
    try:
        datos = json.loads(payload)
    except ValueError:
        return {"v": 1, "cmd_id": "", "ok": False, "error": "JSON inválido"}
    cmd_id = str(datos.get("cmd_id", ""))
    try:
        cmd = MODELOS[tipo].model_validate(datos)
    except (KeyError, ValidationError) as error:
        return {"v": 1, "cmd_id": cmd_id, "ok": False, "error": str(error).splitlines()[0]}
    if isinstance(cmd, ComandoSystem):
        if cmd.accion == "led":
            estado["led"] = bool(cmd.encendido)
            return {"v": 1, "cmd_id": cmd_id, "ok": True, "resultado": {"led": estado["led"]}}
        return {"v": 1, "cmd_id": cmd_id, "ok": True, "resultado": {"pong": True} if cmd.accion == "ping" else {}}
    if isinstance(cmd, ComandoPantilt):
        if cmd.mode == "home":
            estado["pan"], estado["tilt"] = 90.0, 0.0
        else:
            estado["pan"], estado["tilt"] = cmd.pan_deg, cmd.tilt_deg
        return {"v": 1, "cmd_id": cmd_id, "ok": True, "resultado": {"pan_deg": estado["pan"], "tilt_deg": estado["tilt"]}}
    if not estado.get("armado", True):
        return {"v": 1, "cmd_id": cmd_id, "ok": False, "error": "lugar desarmado"}  # igual que el firmware
    log.info("disuasión: %s", json.loads(payload).get("pattern"))
    return {"v": 1, "cmd_id": cmd_id, "ok": True, "resultado": {"simulado": True}}  # audio simulado: no suena


def main() -> None:
    p = argparse.ArgumentParser(description="ESP32 virtual de Centinela")
    p.add_argument("--node-id", default="node-0000000000a1")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=1883)
    p.add_argument("--evento", choices=["baja", "media", "alta"], default="")
    p.add_argument("--eventos-cada", type=float, default=0, help="segundos entre eventos aleatorios (0 = ninguno)")
    p.add_argument("--camara", type=int, default=0, help="puerto de la cámara virtual en 127.0.0.1 (0 = sin cámara)")
    a = p.parse_args()
    if not re.match(NODE_ID_PATRON, a.node_id):
        p.error("--node-id debe ser node- + 12 hex en minúsculas")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s: %(message)s")
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(correr(a.node_id, a.host, a.port, evento=a.evento, eventos_cada=a.eventos_cada, camara=a.camara))


if __name__ == "__main__":
    main()

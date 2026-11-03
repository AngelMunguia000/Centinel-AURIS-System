"""ESP32 virtual: habla exactamente el protocolo del firmware (spec §4.1); plan Tarea 12."""

import asyncio
import json

import aiomqtt

from simulador.nodo_virtual import correr

NODO = "node-00000000e2e1"


async def _esperar(mensajes, topico, intentos=60):
    for _ in range(intentos):
        if topico in mensajes:
            return mensajes[topico]
        await asyncio.sleep(0.05)
    raise AssertionError(f"no llegó {topico}; llegaron {list(mensajes)}")


async def test_nodo_virtual_responde_ack_a_led_y_publica_status_y_telemetria(broker):
    host, puerto = broker
    tarea = asyncio.create_task(correr(NODO, host, puerto, intervalo=0.1))
    mensajes = {}
    try:
        async with aiomqtt.Client(host, puerto) as c:
            await c.subscribe(f"centinel/{NODO}/#", qos=1)

            async def escuchar():
                async for m in c.messages:
                    mensajes[str(m.topic)] = json.loads(m.payload)

            escucha = asyncio.create_task(escuchar())
            status = await _esperar(mensajes, f"centinel/{NODO}/status")
            assert status["state"] == "online"
            assert status["capacidades"] == {"led": "real", "pantilt": "simulado", "audio": "simulado", "camara": "ausente"}
            tele = await _esperar(mensajes, f"centinel/{NODO}/telemetry")
            assert 40 <= tele["temp_c"] <= 45 and tele["v"] == 1

            await c.publish(f"centinel/{NODO}/command/system", json.dumps({"v": 1, "cmd_id": "c-led", "accion": "led", "encendido": True}), qos=1)
            ack = await _esperar(mensajes, f"centinel/{NODO}/ack")
            assert ack == {"v": 1, "cmd_id": "c-led", "ok": True, "resultado": {"led": True}}

            mensajes.pop(f"centinel/{NODO}/ack")
            await c.publish(f"centinel/{NODO}/command/pantilt", json.dumps({"v": 1, "cmd_id": "c-pt", "mode": "absolute", "pan_deg": 999, "tilt_deg": 0}), qos=1)
            ack = await _esperar(mensajes, f"centinel/{NODO}/ack")
            assert ack["cmd_id"] == "c-pt" and ack["ok"] is False
            escucha.cancel()
    finally:
        tarea.cancel()

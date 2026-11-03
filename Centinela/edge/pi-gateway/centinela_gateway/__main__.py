"""python -m centinela_gateway — API REST + puente MQTT ↔ web en un solo proceso.

Spec: docs/diseno/2026-10-16-enlace-edge-design.md §3.2.
"""

import asyncio
import hashlib
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict

import aiomqtt
import httpx
import uvicorn

from centinela_gateway.adapters.cola import Cola
from centinela_gateway.adapters.http import crear_app
from centinela_gateway.adapters.web import ClienteWeb
from centinela_gateway.application.camaras import Vigilante, bucle_evidencias
from centinela_gateway.application.comandos import ejecutar
from centinela_gateway.application.puente import Puente
from centinela_gateway.config import Config

log = logging.getLogger("centinela")


async def principal(config: Config, puerto_api: int) -> None:
    async with httpx.AsyncClient() as http:
        puente = Puente(ClienteWeb(config.web_url, config.gateway_token, http), Cola(config.cola_db))
        estado: Dict[str, Any] = {"mqtt": None}

        async def publicar(topico: str, datos: bytes, retener: bool = False) -> None:
            cliente = estado["mqtt"]
            if cliente is None:
                raise ConnectionError("sin conexión al broker")
            await cliente.publish(topico, datos, qos=1, retain=retener)

        async def bucle_mqtt() -> None:
            while True:
                try:
                    async with aiomqtt.Client(config.mqtt_host, config.mqtt_port, identifier="centinela-gateway", keepalive=10) as cliente:
                        estado["mqtt"] = cliente
                        await puente.suscribir(cliente)
                        log.info("MQTT conectado a %s:%s", config.mqtt_host, config.mqtt_port)
                        await puente.escuchar(cliente)
                except aiomqtt.MqttError as error:
                    log.warning("MQTT desconectado (%s); reintento en 2 s", error)
                finally:
                    estado["mqtt"] = None
                await asyncio.sleep(2)

        # Cámara como sensor: movimiento → evento + foto de evidencia + disuasión (application/camaras.py).
        evidencias = Path(config.evidencias_dir)
        detector = None
        if config.vision_modelo:
            from centinela_gateway.adapters.vision import DetectorYolo

            detector = DetectorYolo(config.vision_modelo, config.vision_confianza)
            log.info("visión activa: %s, ahuyenta %s", config.vision_modelo, ", ".join(config.vision_objetivos))
        vigilante = Vigilante(puente, http, evidencias, publicar=publicar, detector=detector, objetivos=config.vision_objetivos)

        app = crear_app(hashlib.sha256(config.gateway_token.encode()).hexdigest(), lambda p: ejecutar(puente, publicar, p), lambda: len(puente.nodos_en_linea()), puente.url_video)
        servidor = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=puerto_api, log_level="warning"))
        log.info("API en http://0.0.0.0:%s — web: %s", puerto_api, config.web_url)

        tareas = [asyncio.ensure_future(t) for t in (servidor.serve(), bucle_mqtt(), puente.bucle_latido(publicar=publicar), puente.bucle_drenado(), vigilante.bucle(), bucle_evidencias(puente.web, evidencias))]
        # Si cualquiera termina (p. ej. Ctrl+C detiene uvicorn), se cancela el resto.
        _, pendientes = await asyncio.wait(tareas, return_when=asyncio.FIRST_COMPLETED)
        for t in pendientes:
            t.cancel()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # 2 peticiones por segundo taparían las detecciones en el journal
    if sys.platform == "win32":
        # aiomqtt necesita el loop selector (el Proactor de Windows no tiene add_reader).
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(principal(Config.desde_entorno(), int(os.environ.get("PUERTO_API", "8000"))))


if __name__ == "__main__":
    main()

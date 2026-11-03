"""Caso de uso: ejecutar un comando de la web en un nodo y esperar su ack (spec §4.3)."""

import asyncio
import json
import time
from typing import Awaitable, Callable

from centinela_gateway.application.puente import Puente
from centinela_gateway.domain.modelos import PeticionComando, RespuestaComando

Publicar = Callable[[str, bytes], Awaitable[None]]

TIMEOUT_ACK_S = 3.0


async def ejecutar(puente: Puente, publicar: Publicar, peticion: PeticionComando, timeout: float = TIMEOUT_ACK_S) -> RespuestaComando:
    """Publica el comando por MQTT y espera su ack. Lanza ValidationError si el payload no cumple el contrato."""
    comando = peticion.comando()  # vuelve a validar rangos en este salto, antes de publicar nada
    espera = puente.esperar_ack(peticion.cmd_id)
    inicio = time.monotonic()
    try:
        await publicar(f"centinel/{peticion.node_id}/command/{peticion.tipo}", json.dumps(comando.model_dump(exclude_none=True)).encode())
        ack = await asyncio.wait_for(espera, timeout)
    except asyncio.TimeoutError:
        return RespuestaComando(estado="timeout", error="El nodo no respondió", latencia_ms=round((time.monotonic() - inicio) * 1000))
    except (ConnectionError, OSError, RuntimeError) as error:
        # Broker caído o reconectando: respuesta explícita en vez de un 500 sin explicación.
        return RespuestaComando(estado="error", error=f"Broker MQTT no disponible: {error}", latencia_ms=round((time.monotonic() - inicio) * 1000))
    finally:
        puente.cancelar_espera(peticion.cmd_id)
    latencia = round((time.monotonic() - inicio) * 1000)
    if ack.ok:
        return RespuestaComando(estado="ok", resultado=ack.resultado, latencia_ms=latencia)
    return RespuestaComando(estado="error", error=ack.error or "El nodo rechazó el comando", latencia_ms=latencia)

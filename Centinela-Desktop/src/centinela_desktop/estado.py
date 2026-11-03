"""Estado en vivo de los nodos: el mismo reductor que hooks/use-edge-stream.ts de la web. Puro."""
from __future__ import annotations

from typing import Any

Nodo = dict[str, Any]
Evento = dict[str, Any]
MAX_EVENTOS = 100


def aplicar(nodos: list[Nodo], eventos: list[Evento], tipo: str, datos: Any) -> tuple[list[Nodo], list[Evento]]:
    """Devuelve (nodos, eventos) nuevos tras un mensaje del stream; no muta lo que recibe."""
    if tipo == "snapshot":
        return list(datos), eventos
    if tipo == "dispositivo.telemetria":
        def act(n: Nodo) -> Nodo:
            if n.get("id") != datos.get("dispositivoId"):
                return n
            return {
                **n,
                "telemetria": datos.get("telemetria"),
                "capacidades": datos.get("capacidades") or n.get("capacidades"),
                "ultimoContacto": datos.get("ultimoContacto"),
            }
        return [act(n) for n in nodos], eventos
    if tipo == "dispositivo.estado":
        estado = "desconectado" if datos.get("conexion") == "DESCONECTADO" else "en_linea"
        return [({**n, "estado": estado} if n.get("id") == datos.get("dispositivoId") else n) for n in nodos], eventos
    if tipo == "evento.nuevo":
        resto = [e for e in eventos if e.get("id") != datos.get("id")]
        return nodos, ([datos] + resto)[:MAX_EVENTOS]
    return nodos, eventos

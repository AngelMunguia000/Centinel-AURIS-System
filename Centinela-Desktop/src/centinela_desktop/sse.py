"""Lector de Server-Sent Events (GET /api/stream de la web). Puro: se le pasan líneas, devuelve eventos."""
from __future__ import annotations

import json
from typing import Any


class LectorSSE:
    """Acumula líneas `event:` / `data:` y entrega (evento, datos) al llegar la línea vacía que cierra el bloque."""

    def __init__(self) -> None:
        self._evento = "message"
        self._datos: list[str] = []

    def linea(self, texto: str) -> tuple[str, Any] | None:
        texto = texto.rstrip("\r")
        if texto == "":
            if not self._datos:
                self._evento = "message"
                return None
            evento, crudo = self._evento, "\n".join(self._datos)
            self._evento, self._datos = "message", []
            try:
                return evento, json.loads(crudo)
            except json.JSONDecodeError:
                return evento, crudo
        if texto.startswith(":"):
            return None  # comentario / keep-alive
        campo, _, valor = texto.partition(":")
        valor = valor[1:] if valor.startswith(" ") else valor
        if campo == "event":
            self._evento = valor
        elif campo == "data":
            self._datos.append(valor)
        return None

"""Qué notificaciones de la web se muestran como aviso de Windows. Puro: sin Qt ni red."""
from __future__ import annotations

from typing import Any

Notificacion = dict[str, Any]


def nuevos_avisos(vistos: set[int], notificaciones: list[Notificacion]) -> list[Notificacion]:
    """Las no leídas que todavía no se mostraron, de la más vieja a la más nueva."""
    nuevas = [n for n in notificaciones if not n.get("leida") and n.get("id") not in vistos]
    return sorted(nuevas, key=lambda n: str(n.get("createdAt", "")))


def es_panico(n: Notificacion) -> bool:
    # Mismo criterio que la campanita de la web (components/NotificacionesBell.tsx).
    return str(n.get("mensaje", "")).startswith("PÁNICO")

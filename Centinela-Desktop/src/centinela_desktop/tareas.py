"""Correr llamadas de red fuera del hilo de la interfaz y volver con el resultado por una señal de Qt."""
from __future__ import annotations

import threading
from typing import Callable

from PySide6.QtCore import QObject, Signal

from .cliente import ErrorCentinela


class _Puente(QObject):
    listo = Signal(object, object)  # (callback, valor o ErrorCentinela)


_puente: _Puente | None = None


def _entregar(cb: Callable[[object], None], valor: object) -> None:
    try:
        cb(valor)
    except RuntimeError as e:
        # La respuesta llegó después de cerrar la ventana que la pidió: ya no hay a quién pintarle.
        if "already deleted" not in str(e):
            raise


def en_segundo_plano(trabajo: Callable[[], object], al_terminar: Callable[[object], None]) -> None:
    """`al_terminar` recibe el valor o un ErrorCentinela, siempre en el hilo de la interfaz."""
    global _puente
    if _puente is None:
        _puente = _Puente()  # se crea en el hilo de la interfaz (primera llamada)
        _puente.listo.connect(_entregar)
    puente = _puente

    def correr() -> None:
        try:
            valor: object = trabajo()
        except ErrorCentinela as e:
            valor = e
        except Exception as e:  # noqa: BLE001 — nunca dejar la interfaz esperando
            valor = ErrorCentinela(f"Error inesperado: {e}")
        puente.listo.emit(al_terminar, valor)

    threading.Thread(target=correr, daemon=True).start()

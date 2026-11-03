"""Hilo que lee el stream en vivo de la web (SSE) y lo entrega a la interfaz por señales."""
from __future__ import annotations

from PySide6.QtCore import QThread, Signal

from .cliente import ClienteCentinela, ErrorCentinela
from .sse import LectorSSE

REINTENTO_S = 3


class HiloStream(QThread):
    mensaje = Signal(str, object)  # (tipo de evento, datos)
    conectado = Signal(bool)
    sin_permiso = Signal()

    def __init__(self, cliente: ClienteCentinela) -> None:
        super().__init__()
        self.cliente = cliente
        self._activo = True

    def detener(self) -> None:
        self._activo = False
        self.requestInterruption()
        self.cliente.cortar_stream()  # si no, la lectura puede seguir bloqueada y Qt destruye el hilo corriendo

    def run(self) -> None:
        while self._activo and not self.isInterruptionRequested():
            lector = LectorSSE()
            try:
                for linea in self.cliente.lineas_stream():
                    if not self._activo:
                        return
                    if evento := lector.linea(linea):
                        self.conectado.emit(True)
                        self.mensaje.emit(*evento)
            except ErrorCentinela as e:
                if not self._activo:
                    return
                if e.estado in (401, 403):
                    self.sin_permiso.emit()
                    return
            if not self._activo:
                return
            self.conectado.emit(False)
            # Espera corta y en pasos, para poder salir rápido al cerrar la app.
            for _ in range(REINTENTO_S * 10):
                if not self._activo:
                    return
                self.msleep(100)

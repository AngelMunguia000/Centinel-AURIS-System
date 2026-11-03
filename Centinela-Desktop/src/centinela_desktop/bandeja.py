"""Icono en la bandeja de Windows: menú, avisos nativos y pánico."""
from __future__ import annotations

from typing import Callable

from PySide6.QtCore import QSettings, QTimer, Signal
from PySide6.QtWidgets import QMenu, QSystemTrayIcon

from .avisos import es_panico, nuevos_avisos
from .cliente import ClienteCentinela, ErrorCentinela
from .config import INTERVALO_AVISOS_MS
from .icono import icono
from .tareas import en_segundo_plano


class BandejaCentinela(QSystemTrayIcon):
    notificaciones = Signal(list)  # cada consulta buena: la campanita de la consola se pinta con esto
    def __init__(
        self,
        cliente: ClienteCentinela,
        mostrar: Callable[[str | None], None],
        panico: Callable[[], None],
        cambiar_servidor: Callable[[], None],
        al_salir: Callable[[], None],
    ) -> None:
        super().__init__(icono())
        self.cliente = cliente
        self.mostrar = mostrar
        self.vistos: set[int] = set()
        self.primera_consulta = True
        self.consultando = False
        self.setToolTip("Centinela")

        menu = QMenu()
        menu.addAction("Abrir Centinela", lambda: mostrar(None))
        menu.addSeparator()
        for etiqueta, vista in (("Inicio", "inicio"), ("Monitor en vivo", "monitor"), ("Bitácora", "bitacora"), ("Reportes", "reportes")):
            menu.addAction(etiqueta, lambda v=vista: mostrar(v))
        menu.addSeparator()
        menu.addAction("Pánico…", panico)
        menu.addSeparator()
        menu.addAction("Cambiar servidor…", cambiar_servidor)
        menu.addAction("Salir", al_salir)
        self.setContextMenu(menu)
        self._menu = menu  # Qt no se queda con la referencia

        self.activated.connect(lambda razon: mostrar(None) if razon == QSystemTrayIcon.ActivationReason.Trigger else None)
        self.messageClicked.connect(lambda: mostrar("reportes"))

        self.temporizador = QTimer(self)
        self.temporizador.timeout.connect(self.consultar)
        self.temporizador.start(INTERVALO_AVISOS_MS)

    def sesion_nueva(self) -> None:
        self.vistos.clear()
        self.primera_consulta = True
        self.setIcon(icono())
        self.consultar()

    def consultar(self) -> None:
        if self.consultando or not self.cliente.con_sesion:
            return
        self.consultando = True
        en_segundo_plano(self.cliente.notificaciones, self._con_notificaciones)

    def _con_notificaciones(self, valor: object) -> None:
        self.consultando = False
        if isinstance(valor, ErrorCentinela):
            return  # sin red o sesión vencida: se reintenta en la próxima vuelta, sin molestar
        self.notificaciones.emit(valor)
        nuevas = nuevos_avisos(self.vistos, valor)  # type: ignore[arg-type]
        self.vistos.update(n["id"] for n in nuevas)
        self.setIcon(icono(alerta=any(not n.get("leida") for n in valor)))  # type: ignore[union-attr]
        if not QSettings().value("avisos/bandeja", True, type=bool):
            self.primera_consulta = False
            return  # el usuario los apagó en Ajustes; el icono y la campanita siguen avisando
        if self.primera_consulta:
            # Al abrir no se dispara un aviso por cada pendiente viejo: uno solo que los resume.
            self.primera_consulta = False
            if nuevas:
                self.showMessage("Centinela", f"Tienes {len(nuevas)} avisos sin leer.", icono(alerta=True), 6000)
            return
        for n in nuevas[-3:]:
            if es_panico(n):
                self.showMessage("PÁNICO", n["mensaje"], QSystemTrayIcon.MessageIcon.Critical, 15000)
            else:
                self.showMessage("Centinela", n["mensaje"], icono(alerta=True), 8000)

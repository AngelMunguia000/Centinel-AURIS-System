"""Ventana de la consola: encabezado, barra lateral agrupada, vistas nativas y estado en vivo."""
from __future__ import annotations

from typing import Any

from PySide6.QtCore import QSettings, QSize, Qt, Signal
from PySide6.QtGui import QCloseEvent
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QMainWindow, QMenu, QMessageBox, QPushButton, QStackedWidget, QToolButton, QVBoxLayout,
    QWidget,
)

from . import tema
from .cliente import ClienteCentinela, ErrorCentinela
from .componentes import etiqueta_con
from .estado import aplicar
from .hilo_stream import HiloStream
from .icono import icono, lucide, pixmap_logo
from .tareas import en_segundo_plano
from .vistas import Vista, VistaBitacora, VistaInicio, VistaMonitor, VistaReportes
from .vista_prototipo import VistaPrototipo
from .vistas_gestion import VistaAdmin, VistaAjustes, VistaDispositivos

Datos = dict[str, Any]


class VentanaConsola(QMainWindow):
    cerrar_sesion = Signal()
    refrescar_avisos = Signal()  # tras marcar avisos como leídos: la bandeja vuelve a consultar

    def __init__(self, cliente: ClienteCentinela, usuario: Datos, ajustes: QSettings) -> None:
        super().__init__()
        self.cliente = cliente
        self.usuario = usuario
        self.ajustes = ajustes
        self.saliendo = False
        self.nodos: list[Datos] = []
        self.eventos: list[Datos] = []
        self.setWindowTitle("Centinela")
        self.setWindowIcon(icono())
        self.resize(1360, 860)
        if geo := ajustes.value("ventana/geometria"):
            self.restoreGeometry(geo)

        permisos = usuario.get("permisos", [])
        self.ve_nodos = any(p.startswith("dispositivos.") for p in permisos)

        raiz = QWidget()
        raiz.setObjectName("raiz")
        col = QVBoxLayout(raiz)
        col.setContentsMargins(16, 14, 16, 0)  # la cabecera flota como píldora, igual que en la web
        col.setSpacing(0)
        col.addWidget(self._cabecera())
        cuerpo = QHBoxLayout()
        cuerpo.setContentsMargins(0, 0, 0, 0)
        cuerpo.setSpacing(0)
        col.addLayout(cuerpo, 1)
        self.setCentralWidget(raiz)

        self.pila = QStackedWidget()
        self.vistas: dict[str, Vista] = {"inicio": VistaInicio(cliente, usuario), "reportes": VistaReportes(cliente, usuario)}
        if self.ve_nodos:
            self.vistas["monitor"] = VistaMonitor(cliente)
            self.vistas["bitacora"] = VistaBitacora(cliente)
            self.vistas["dispositivos"] = VistaDispositivos(cliente)
        if "usuarios.gestionar" in permisos or "auditoria.ver" in permisos:
            self.vistas["admin"] = VistaAdmin(cliente, usuario)
        self.vistas["prototipo"] = VistaPrototipo()  # como en la web: el catálogo lo ve cualquier rol
        self.vistas["ajustes"] = VistaAjustes(cliente, usuario, ajustes)
        for v in self.vistas.values():
            self.pila.addWidget(v)
            v.ir.connect(self.ir)
        cuerpo.addWidget(self._barra_lateral())
        cuerpo.addWidget(self.pila, 1)

        self.hilo: HiloStream | None = None
        if self.ve_nodos:
            self.hilo = HiloStream(cliente)
            self.hilo.mensaje.connect(self._mensaje)
            self.hilo.conectado.connect(self._conectado)
            self.hilo.sin_permiso.connect(lambda: self.en_vivo.setText(""))  # un 401 lo atiende main.py (vuelve al login)
            self.hilo.start()
        else:
            self.en_vivo.setText("")
        self.ir("inicio")

    # --- armado
    def _cabecera(self) -> QFrame:
        cab = QFrame()
        cab.setObjectName("cabecera")
        cab.setFixedHeight(56)
        fila = QHBoxLayout(cab)
        fila.setContentsMargins(24, 0, 24, 0)
        logo = QLabel()
        logo.setPixmap(pixmap_logo(28))
        fila.addWidget(logo)
        marca = QLabel(f'Centinela <span style="color:{tema.CARMESI_TEXTO}">AURIS</span>')
        marca.setTextFormat(Qt.TextFormat.RichText)
        marca.setStyleSheet("font-size: 17px; font-weight: 600;")
        fila.addWidget(marca)
        fila.addStretch()
        # Campanita como la de la web (NotificacionesBell.tsx); la bandeja la alimenta con cada consulta.
        self.campana = QToolButton()
        self.campana.setObjectName("campana")
        self.campana.setIcon(lucide("bell", tema.TEXTO, 16))
        self.campana.setToolButtonStyle(Qt.ToolButtonStyle.ToolButtonTextBesideIcon)
        self.campana.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        self.campana.setToolTip("Avisos")
        self.campana.setMenu(QMenu(self.campana))
        fila.addWidget(self.campana)
        fila.addSpacing(14)
        self.en_vivo = etiqueta_con("mono", "● conectando…")
        self.en_vivo.setStyleSheet(f"color: {tema.TEXTO_TENUE}; font-size: 11px;")
        fila.addWidget(self.en_vivo)
        fila.addSpacing(18)
        # Menú de cuenta: quién soy, Ajustes y Cerrar sesión, sin ocupar la cabecera con texto suelto.
        u = self.usuario
        quien = u.get("nombre") or u.get("username") or u.get("email", "")
        cuenta = QToolButton()
        cuenta.setObjectName("cuenta")
        cuenta.setText(f"{quien}  ·  {u.get('role', '')}")
        cuenta.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        menu = QMenu(cuenta)
        menu.addAction(" ".join(p for p in (u.get("nombre"), u.get("apellido")) if p) or quien).setEnabled(False)
        menu.addAction(u.get("email", "")).setEnabled(False)
        menu.addSeparator()
        menu.addAction(lucide("settings", tema.TEXTO_SUAVE, 16), "Ajustes", lambda: self.ir("ajustes"))
        menu.addAction(lucide("log-out", tema.TEXTO_SUAVE, 16), "Cerrar sesión", self._cerrar_sesion)
        cuenta.setMenu(menu)
        fila.addWidget(cuenta)
        return cab

    def _barra_lateral(self) -> QFrame:
        barra = QFrame()
        barra.setObjectName("sidebar")
        barra.setFixedWidth(232)
        col = QVBoxLayout(barra)
        col.setContentsMargins(14, 24, 14, 18)
        col.setSpacing(2)
        self.botones: dict[str, QPushButton] = {}
        # Mismos iconos que el sidebar de la web (SeguridadSidebar.tsx)
        # Operación diaria arriba; lo de consulta (referencia del prototipo, ajustes) abajo, junto a Pánico.
        grupos = [("OPERACIÓN", [("inicio", "Inicio", "layout-dashboard"), ("monitor", "Monitor", "eye"), ("bitacora", "Bitácora", "terminal")]),
                  ("INCIDENCIAS", [("reportes", "Reportes", "file-text")]),
                  ("SISTEMA", [("dispositivos", "Dispositivos", "router"), ("admin", "Administración", "users")]),
                  (None, [("prototipo", "Referencia del prototipo", "cpu"), ("ajustes", "Ajustes", "settings")])]
        for grupo, items in grupos:
            visibles = [(k, t, i) for k, t, i in items if k in self.vistas]
            if not visibles:
                continue
            if grupo:
                col.addWidget(etiqueta_con("grupo", grupo))
            else:
                col.addStretch()
            for clave, texto, nombre_icono in visibles:
                b = QPushButton(f"  {texto}")  # Qt no deja espacio entre icono y texto
                b.setObjectName("nav")
                b.setIcon(lucide(nombre_icono, tema.TEXTO_SUAVE, 18, color_activo=tema.AMBAR))
                b.setIconSize(QSize(18, 18))
                b.setCheckable(True)
                b.setCursor(Qt.CursorShape.PointingHandCursor)
                b.clicked.connect(lambda _=False, c=clave: self.ir(c))
                col.addWidget(b)
                self.botones[clave] = b
            col.addSpacing(16 if grupo else 10)
        # Número de pendientes junto a "Reportes", como un contador de bandeja de entrada
        self.contador = QLabel("", self.botones["reportes"])
        self.contador.setStyleSheet(f"font-family: '{tema.MONO}'; font-size: 11px; color: {tema.AMBAR}; background: transparent;")
        caja = QHBoxLayout(self.botones["reportes"])
        caja.setContentsMargins(0, 0, 12, 0)
        caja.addStretch()
        caja.addWidget(self.contador)
        panico = QPushButton("  Pánico")
        panico.setObjectName("panico")
        panico.setIcon(lucide("triangle-alert", "#fca5a5", 16))
        panico.clicked.connect(self.panico)
        col.addWidget(panico)
        return barra

    # --- avisos (campanita)
    def fijar_notificaciones(self, notis: list[Datos]) -> None:
        sin_leer = [n for n in notis if not n.get("leida")]
        self.campana.setText(f" {len(sin_leer)}" if sin_leer else "")
        self.campana.setIcon(lucide("bell", tema.AMBAR if sin_leer else tema.TEXTO, 16))
        menu = self.campana.menu()
        menu.clear()
        if not notis:
            menu.addAction("No tienes avisos.").setEnabled(False)
            return
        for n in notis[:8]:
            texto = str(n.get("mensaje", ""))
            texto = texto if len(texto) <= 70 else texto[:69] + "…"
            accion = menu.addAction(("●  " if not n.get("leida") else "    ") + texto)
            accion.triggered.connect(lambda _=False, n=n: self._abrir_aviso(n))
        if sin_leer:
            menu.addSeparator()
            menu.addAction("Marcar todas como leídas", self._leer_todas)

    def _abrir_aviso(self, n: Datos) -> None:
        if not n.get("leida"):
            en_segundo_plano(lambda: self.cliente.marcar_leida(int(n["id"])), lambda _v: self.refrescar_avisos.emit())
        self.ir("reportes")

    def _leer_todas(self) -> None:
        en_segundo_plano(self.cliente.leer_todas, lambda _v: self.refrescar_avisos.emit())

    # --- navegación y datos en vivo
    def ir(self, clave: str) -> None:
        vista = self.vistas.get(clave) or self.vistas["inicio"]
        for c, b in self.botones.items():
            b.setChecked(self.vistas.get(c) is vista)
        self.pila.setCurrentWidget(vista)
        vista.al_mostrar()
        vista.en_vivo(self.nodos, self.eventos)
        en_segundo_plano(self.cliente.stats_reportes, self._con_stats)

    def _con_stats(self, valor: object) -> None:
        if not isinstance(valor, ErrorCentinela):
            n = int(valor.get("reportesPendientes", 0))  # type: ignore[union-attr]
            self.contador.setText(str(n) if n else "")

    def mostrar_al_frente(self, clave: str | None = None) -> None:
        if clave:
            self.ir(clave)
        self.showNormal()
        self.raise_()
        self.activateWindow()

    def _mensaje(self, tipo: str, datos: object) -> None:
        self.nodos, self.eventos = aplicar(self.nodos, self.eventos, tipo, datos)
        vista = self.pila.currentWidget()
        if isinstance(vista, Vista):
            vista.en_vivo(self.nodos, self.eventos)

    def _conectado(self, si: bool) -> None:
        if si and self.en_vivo.text() == "● reconectando…":
            # Volvió la conexión: la vista abierta se pone al día con lo que pasó mientras estuvo caída.
            vista = self.pila.currentWidget()
            if isinstance(vista, Vista):
                vista.al_mostrar()
        self.en_vivo.setText("● en vivo" if si else "● reconectando…")
        self.en_vivo.setStyleSheet(f"color: {tema.AMBAR if si else tema.TEXTO_TENUE}; font-size: 11px;")

    # --- acciones
    def panico(self) -> None:
        respuesta = QMessageBox.question(
            self, "Pánico", "Se abrirá una incidencia crítica y se avisará a todos los Operadores. ¿Continuar?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.Cancel, QMessageBox.StandardButton.Cancel,
        )
        if respuesta != QMessageBox.StandardButton.Yes:
            return

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                QMessageBox.warning(self, "No se pudo enviar la alerta", str(valor))
            else:
                QMessageBox.information(self, "Alerta enviada", f"Se avisó a {valor} responsables.")

        en_segundo_plano(self.cliente.panico, listo)

    def _cerrar_sesion(self) -> None:
        self.detener()
        en_segundo_plano(self.cliente.cerrar_sesion, lambda _v: None)
        self.saliendo = True
        self.close()
        self.cerrar_sesion.emit()

    def detener(self) -> None:
        if self.hilo:
            self.hilo.detener()
            self.hilo.wait(1500)

    # --- cerrar = ocultar en la bandeja (sigue avisando); "Salir" o "Cerrar sesión" cierran de verdad
    def closeEvent(self, evento: QCloseEvent) -> None:  # noqa: N802
        self.ajustes.setValue("ventana/geometria", self.saveGeometry())
        if self.saliendo:
            self.detener()
            evento.accept()
        else:
            evento.ignore()
            self.hide()

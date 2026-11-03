"""Punto de entrada de Centinela Desktop (app nativa: todas las pantallas programadas en Qt)."""
from __future__ import annotations

import argparse
import os
import sys

from PySide6.QtCore import QObject, QProcess, QSettings, QTimer, Signal
from PySide6.QtWidgets import QApplication, QInputDialog, QMessageBox

from . import tema
from .bandeja import BandejaCentinela
from .cliente import ClienteCentinela
from .config import SERVIDOR_POR_DEFECTO, VERSION, normalizar_servidor
from .icono import icono
from .login import VentanaLogin
from .ventana import VentanaConsola


class AvisoSesion(QObject):
    vencida = Signal()


def pedir_servidor(actual: str) -> str | None:
    """Diálogo de la dirección del servidor; vuelve a preguntar si no es válida. None si se cancela."""
    texto = actual
    while True:
        texto, ok = QInputDialog.getText(
            None, "Servidor de Centinela", "Dirección del servidor (por ejemplo http://192.168.1.50:3000):", text=texto
        )
        if not ok:
            return None
        if servidor := normalizar_servidor(texto):
            return servidor
        QMessageBox.warning(None, "Dirección no válida", "Escribe una dirección como http://192.168.1.50:3000")


def main(argv: list[str] | None = None) -> int:
    args = argparse.ArgumentParser(prog="Centinela")
    args.add_argument("--servidor", help="usa esta dirección sin guardarla")
    args.add_argument("--vista", default="inicio", help="inicio, monitor, bitacora o reportes")
    args.add_argument("--captura", help="guarda una imagen de la ventana en este PNG y sale (verificación)")
    opciones = args.parse_args(argv)

    app = QApplication(sys.argv[:1])
    app.setApplicationName("Centinela")
    app.setOrganizationName("Centinela AURIS")
    app.setApplicationVersion(VERSION)
    app.setWindowIcon(icono())
    app.setQuitOnLastWindowClosed(False)  # cerrar la consola la deja en la bandeja
    tema.cargar_fuentes()
    app.setStyleSheet(tema.QSS)
    ajustes = QSettings()

    servidor = normalizar_servidor(opciones.servidor or "") or ajustes.value("servidor")
    if not servidor:
        servidor = pedir_servidor(SERVIDOR_POR_DEFECTO)
        if not servidor:
            return 0
        ajustes.setValue("servidor", servidor)

    cliente = ClienteCentinela(servidor)
    estado: dict[str, object] = {"consola": None}
    login = VentanaLogin(cliente)

    def consola() -> VentanaConsola | None:
        return estado["consola"]  # type: ignore[return-value]

    def mostrar(vista: str | None) -> None:
        if c := consola():
            c.mostrar_al_frente(vista)
        else:
            login.showNormal()
            login.raise_()
            login.activateWindow()

    def salir() -> None:
        if c := consola():
            c.saliendo = True
            c.close()
        bandeja.hide()
        cliente.cerrar()
        app.quit()

    def cambiar_servidor() -> None:
        nuevo = pedir_servidor(servidor)
        if nuevo and nuevo != servidor:
            ajustes.setValue("servidor", nuevo)
            QProcess.startDetached(sys.executable, sys.argv[1:] if getattr(sys, "frozen", False) else sys.argv)
            salir()

    def panico() -> None:
        if c := consola():
            c.panico()
        else:
            mostrar(None)
            bandeja.showMessage("Centinela", "Inicia sesión para poder pedir ayuda.", icono(), 6000)

    def al_iniciar_sesion(usuario: dict) -> None:
        c = VentanaConsola(cliente, usuario, ajustes)
        c.cerrar_sesion.connect(al_cerrar_sesion)
        c.refrescar_avisos.connect(bandeja.consultar)
        estado["consola"] = c
        login.hide()
        c.show()
        c.ir(opciones.vista)
        bandeja.sesion_nueva()
        if opciones.captura:
            QTimer.singleShot(5000, lambda: (print("captura:", opciones.vista, app.primaryScreen().grabWindow(c.winId()).save(opciones.captura), flush=True), salir()))

    def al_cerrar_sesion() -> None:
        estado["consola"] = None
        login.show()

    def sesion_vencida() -> None:
        if c := consola():
            c.detener()
            c.saliendo = True
            c.close()
            estado["consola"] = None
        cliente.fijar_sesion(None)
        login.error.setText("Tu sesión expiró. Vuelve a iniciar sesión.")
        login.showNormal()
        login.raise_()
        login.activateWindow()

    puente = AvisoSesion()
    puente.vencida.connect(sesion_vencida)
    cliente.al_expirar = puente.vencida.emit  # se llama desde hilos de red; la señal lo trae al hilo de la interfaz

    bandeja = BandejaCentinela(cliente, mostrar, panico, cambiar_servidor, salir)
    bandeja.notificaciones.connect(lambda notis: (c := consola()) and c.fijar_notificaciones(notis))
    login.sesion_iniciada.connect(al_iniciar_sesion)
    login.pide_cambiar_servidor.connect(cambiar_servidor)
    # Cerrar la ventana de login sin sesión cierra la app (no hay nada que vigilar todavía).
    login.closeEvent = lambda e: (e.accept(), None if consola() else salir())  # type: ignore[method-assign]
    bandeja.show()
    login.show()

    if opciones.captura:
        # Verificación sin manos: CENTINELA_AUTOLOGIN="correo:contraseña" (solo desarrollo).
        if auto := os.environ.get("CENTINELA_AUTOLOGIN"):
            correo, _, clave = auto.partition(":")
            login.entrar_con(correo, clave)
        else:
            QTimer.singleShot(2500, lambda: (app.primaryScreen().grabWindow(login.winId()).save(opciones.captura), salir()))
        QTimer.singleShot(45_000, salir)

    return app.exec()


if __name__ == "__main__":
    sys.exit(main())

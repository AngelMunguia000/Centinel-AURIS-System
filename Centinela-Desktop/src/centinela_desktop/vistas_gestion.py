"""Vistas de gestión, en Qt: Ajustes (perfil y contraseña), Dispositivos (vincular y revocar Pi) y Administración."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from html import escape
from typing import Callable

from PySide6.QtCore import QSettings, Qt, QTime
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import (
    QButtonGroup, QCheckBox, QComboBox, QDialog, QFormLayout, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QMessageBox,
    QPushButton, QTimeEdit, QVBoxLayout, QWidget,
)

from . import tema
from .cliente import ClienteCentinela, ErrorCentinela
from .componentes import Tarjeta, encabezado, etiqueta_con, limpiar, rotulo
from .config import VERSION
from .icono import lucide
from .tareas import en_segundo_plano
from .vistas import ESTADO_NODO, Datos, Vista, chip_texto, fecha, hace

CLAVE_INICIO_WINDOWS = r"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run"


def avisar(lbl: QLabel, texto: str, tono: str = "") -> None:
    colores = {"ok": tema.VERDE, "error": tema.ROJO_ALERTA}
    lbl.setStyleSheet(f"color: {colores[tono]};" if tono in colores else "")
    lbl.setText(texto)
    lbl.setVisible(bool(texto))  # vacío no ocupa lugar


def enviar(boton: QPushButton, aviso: QLabel, trabajo: Callable[[], object], exito: str,
           despues: Callable[[object], None] | None = None) -> None:
    """Patrón de todos los formularios: bloquear el botón, llamar a la web y decir cómo fue."""
    boton.setEnabled(False)
    avisar(aviso, "Enviando…")

    def listo(valor: object) -> None:
        boton.setEnabled(True)
        if isinstance(valor, ErrorCentinela):
            avisar(aviso, str(valor), "error")
            return
        avisar(aviso, exito, "ok")
        if despues:
            despues(valor)

    en_segundo_plano(trabajo, listo)


def confirmar(padre, titulo: str, texto: str) -> bool:
    b = QMessageBox.StandardButton
    return QMessageBox.question(padre, titulo, texto, b.Yes | b.Cancel, b.Cancel) == b.Yes


# ---------------------------------------------------------------- Ajustes
class VistaAjustes(Vista):
    def __init__(self, cliente: ClienteCentinela, usuario: Datos, ajustes: QSettings | None = None) -> None:
        super().__init__()
        self.cliente = cliente
        self.ajustes = ajustes or QSettings()
        cabeza, _, _ = encabezado("Ajustes", f"Tu cuenta y esta app · última conexión {hace(usuario.get('ultimoLoginAnterior'))}")
        self.col.addWidget(cabeza)

        perfil = Tarjeta()
        perfil.cuerpo.addWidget(rotulo("Perfil"))
        rejilla = QGridLayout()
        rejilla.setHorizontalSpacing(16)
        rejilla.setVerticalSpacing(4)
        self.campos: dict[str, QLineEdit] = {}
        correo = QLineEdit(usuario.get("email", ""))
        correo.setReadOnly(True)
        correo.setToolTip("El correo es tu identidad de inicio de sesión; no se cambia desde aquí.")
        # Etiqueta encima del campo y dos columnas: un teléfono no necesita 1000 px de ancho
        for i, (clave, nombre) in enumerate((("nombre", "Nombre"), ("apellido", "Apellido"), ("username", "Usuario"),
                                             ("telefono", "Teléfono"), ("email", "Correo"))):
            campo = correo if clave == "email" else QLineEdit(usuario.get(clave) or "")
            if clave != "email":
                self.campos[clave] = campo
            fila, columna = (i // 2) * 2, i % 2
            rejilla.addWidget(etiqueta_con("tenue", nombre), fila, columna)
            rejilla.addWidget(campo, fila + 1, columna)
        perfil.cuerpo.addLayout(rejilla)
        self.boton_perfil, self.aviso_perfil = self._pie(perfil, "Guardar perfil", self._guardar_perfil)

        clave = Tarjeta()
        clave.cuerpo.addWidget(rotulo("Contraseña"))
        form = QVBoxLayout()
        form.setSpacing(4)
        self.actual, self.nueva, self.repetir = QLineEdit(), QLineEdit(), QLineEdit()
        for campo, nombre in ((self.actual, "Actual"), (self.nueva, "Nueva (8 caracteres o más)"), (self.repetir, "Repetir nueva")):
            campo.setEchoMode(QLineEdit.EchoMode.Password)
            form.addWidget(etiqueta_con("tenue", nombre))
            form.addWidget(campo)
        clave.cuerpo.addLayout(form)
        clave.cuerpo.addStretch()
        self.boton_clave, self.aviso_clave = self._pie(clave, "Cambiar contraseña", self._cambiar_clave)

        arriba = QHBoxLayout()
        arriba.setSpacing(16)
        arriba.addWidget(perfil, 3)
        arriba.addWidget(clave, 2)
        self.col.addLayout(arriba)

        # Lo propio de la app de escritorio, que la web no tiene
        app = Tarjeta()
        app.cuerpo.addWidget(rotulo("Esta app"))
        datos = QFormLayout()
        datos.setHorizontalSpacing(24)
        datos.addRow(etiqueta_con("tenue", "Servidor"), etiqueta_con("mono", cliente.servidor))
        datos.addRow(etiqueta_con("tenue", "Versión"), etiqueta_con("mono", VERSION))
        app.cuerpo.addLayout(datos)
        self.avisos_bandeja = QCheckBox("Mostrar avisos de Windows cuando llegue una notificación")
        self.avisos_bandeja.setChecked(self.ajustes.value("avisos/bandeja", True, type=bool))
        self.avisos_bandeja.toggled.connect(lambda si: self.ajustes.setValue("avisos/bandeja", si))
        app.cuerpo.addWidget(self.avisos_bandeja)
        self.inicio_windows = QCheckBox("Abrir Centinela al iniciar Windows")
        empaquetada = getattr(sys, "frozen", False)
        self.inicio_windows.setEnabled(empaquetada)
        if empaquetada:
            self.inicio_windows.setChecked(QSettings(CLAVE_INICIO_WINDOWS, QSettings.Format.NativeFormat).contains("Centinela"))
            self.inicio_windows.toggled.connect(self._inicio_windows)
        else:
            self.inicio_windows.setToolTip("Solo en la app instalada (Centinela.exe).")
        app.cuerpo.addWidget(self.inicio_windows)
        self.col.addWidget(app)

        # Seguridad (roadmap de funciones #8): sesiones abiertas y estado de la verificación en dos pasos.
        seguridad = Tarjeta()
        cabeza_seg = QHBoxLayout()
        cabeza_seg.addWidget(rotulo("Seguridad"))
        cabeza_seg.addStretch()
        self.boton_otras = QPushButton("Cerrar las demás sesiones")
        self.boton_otras.clicked.connect(self._cerrar_otras)
        cabeza_seg.addWidget(self.boton_otras)
        seguridad.cuerpo.addLayout(cabeza_seg)
        self.dos_pasos = etiqueta_con("tenue", "Cargando…", ajustar=True)
        seguridad.cuerpo.addWidget(self.dos_pasos)
        self.lista_sesiones = QVBoxLayout()
        self.lista_sesiones.setSpacing(2)
        seguridad.cuerpo.addLayout(self.lista_sesiones)
        self.aviso_seguridad = etiqueta_con("tenue")
        seguridad.cuerpo.addWidget(self.aviso_seguridad)
        self.col.addWidget(seguridad)
        self.col.addStretch()

    def al_mostrar(self) -> None:
        en_segundo_plano(self.cliente.estado_2fa, self._con_2fa)
        en_segundo_plano(self.cliente.sesiones, self._con_sesiones)

    def _con_2fa(self, valor: object) -> None:
        if isinstance(valor, ErrorCentinela):
            self.dos_pasos.setText(str(valor))
        elif valor.get("activo"):  # type: ignore[union-attr]
            n = valor.get("codigosRestantes", 0)  # type: ignore[union-attr]
            self.dos_pasos.setText(f"Verificación en dos pasos: activa · {n} código{'s' if n != 1 else ''} de respaldo sin usar.")
        else:
            # El QR se escanea con el teléfono: activarla desde la consola web es más cómodo.
            self.dos_pasos.setText("Verificación en dos pasos: inactiva. Actívala en Ajustes desde la consola web.")

    def _con_sesiones(self, valor: object) -> None:
        limpiar(self.lista_sesiones)
        if isinstance(valor, ErrorCentinela):
            avisar(self.aviso_seguridad, str(valor), "error")
            return
        otras = [s for s in valor if not s.get("actual")]  # type: ignore[union-attr]
        self.boton_otras.setEnabled(bool(otras))
        for s in valor:  # type: ignore[union-attr]
            fila = QHBoxLayout()
            texto = f"{s.get('dispositivo', '—')}{'  · esta sesión' if s.get('actual') else ''}"
            fila.addWidget(etiqueta_con("" if s.get("actual") else "suave", texto))
            detalle = f"activa {hace(s.get('ultimaActividad'))}" + (f" · {s['ip']}" if s.get("ip") else "")
            fila.addWidget(etiqueta_con("tenue", detalle), 1)
            if not s.get("actual"):
                b = QPushButton("Cerrar")
                b.clicked.connect(lambda _=False, sid=s["id"], b=b: self._cerrar_una(sid, b))
                fila.addWidget(b)
            self.lista_sesiones.addLayout(fila)

    def _cerrar_una(self, sesion_id: str, boton: QPushButton) -> None:
        boton.setEnabled(False)

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                boton.setEnabled(True)
                avisar(self.aviso_seguridad, str(valor), "error")
            else:
                avisar(self.aviso_seguridad, "Sesión cerrada.", "ok")
            en_segundo_plano(self.cliente.sesiones, self._con_sesiones)

        en_segundo_plano(lambda: self.cliente.cerrar_sesion_remota(sesion_id), listo)

    def _cerrar_otras(self) -> None:
        if not confirmar(self, "Cerrar las demás sesiones", "Se cerrarán todas tus sesiones salvo esta. ¿Continuar?"):
            return

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                avisar(self.aviso_seguridad, str(valor), "error")
            else:
                avisar(self.aviso_seguridad, f"Sesiones cerradas: {valor.get('cerradas', 0)}.", "ok")  # type: ignore[union-attr]
            en_segundo_plano(self.cliente.sesiones, self._con_sesiones)

        en_segundo_plano(self.cliente.cerrar_otras_sesiones, listo)

    @staticmethod
    def _inicio_windows(si: bool) -> None:
        run = QSettings(CLAVE_INICIO_WINDOWS, QSettings.Format.NativeFormat)
        if si:
            run.setValue("Centinela", f'"{sys.executable}"')
        else:
            run.remove("Centinela")

    @staticmethod
    def _pie(tarjeta: Tarjeta, texto: str, accion: Callable[[], None]) -> tuple[QPushButton, QLabel]:
        fila = QHBoxLayout()
        aviso = etiqueta_con("tenue")
        boton = QPushButton(texto)
        boton.setObjectName("primario")
        boton.clicked.connect(accion)
        fila.addWidget(aviso, 1)
        fila.addWidget(boton)
        tarjeta.cuerpo.addLayout(fila)
        return boton, aviso

    def _guardar_perfil(self) -> None:
        datos = {k: c.text().strip() for k, c in self.campos.items()}
        if not datos["nombre"] or not datos["apellido"] or not datos["telefono"]:
            avisar(self.aviso_perfil, "Nombre, apellido y teléfono no pueden quedar vacíos.", "error")
            return
        datos["username"] = datos["username"] or None  # vacío = quitar el nombre de usuario, como acepta la web
        enviar(self.boton_perfil, self.aviso_perfil, lambda: self.cliente.actualizar_perfil(datos), "Perfil guardado.")

    def _cambiar_clave(self) -> None:
        actual, nueva = self.actual.text(), self.nueva.text()
        if len(nueva) < 8:
            avisar(self.aviso_clave, "La nueva contraseña debe tener al menos 8 caracteres.", "error")
            return
        if nueva != self.repetir.text():
            avisar(self.aviso_clave, "Las contraseñas nuevas no coinciden.", "error")
            return

        def limpiar_campos(_v: object) -> None:
            for c in (self.actual, self.nueva, self.repetir):
                c.clear()

        enviar(self.boton_clave, self.aviso_clave, lambda: self.cliente.cambiar_contrasena(actual, nueva),
               "Contraseña actualizada.", limpiar_campos)


# ---------------------------------------------------------------- Dispositivos
class VistaDispositivos(Vista):
    def __init__(self, cliente: ClienteCentinela) -> None:
        super().__init__()
        self.cliente = cliente
        self.nodos: list[Datos] = []
        self.gateways: list[Datos] | None = None
        cabeza, _, _ = encabezado("Dispositivos", "Las Raspberry Pi que reportan tus nodos, y los nodos de cada una.")
        self.boton_alta = QPushButton("Vincular una Pi")
        self.boton_alta.setObjectName("primario")
        cabeza.acciones.addWidget(self.boton_alta)
        self.col.addWidget(cabeza)

        alta = Tarjeta()
        self.boton_alta.clicked.connect(lambda: alta.setVisible(alta.isHidden()))
        alta.cuerpo.addWidget(rotulo("Vincular una Raspberry Pi"))
        fila = QHBoxLayout()
        self.nombre = QLineEdit()
        self.nombre.setPlaceholderText("Nombre (p. ej. Pi de la entrada)")
        self.url = QLineEdit()
        self.url.setPlaceholderText("Dirección de la Pi (http://192.168.1.50:8000)")
        self.boton_vincular = QPushButton("Vincular")
        self.boton_vincular.setObjectName("primario")
        self.boton_vincular.clicked.connect(self._vincular)
        fila.addWidget(self.nombre, 1)
        fila.addWidget(self.url, 2)
        fila.addWidget(self.boton_vincular)
        alta.cuerpo.addLayout(fila)
        self.aviso = etiqueta_con("tenue", "", ajustar=True)
        alta.cuerpo.addWidget(self.aviso)
        # El token solo viene en la respuesta del alta: se muestra una vez para copiarlo a la Pi.
        self.caja_token = QHBoxLayout()
        self.token = QLineEdit()
        self.token.setReadOnly(True)
        self.token.setStyleSheet(f"font-family: '{tema.MONO}';")
        self.copiar = QPushButton("Copiar")
        self.copiar.clicked.connect(lambda: QGuiApplication.clipboard().setText(self.token.text()))
        self.caja_token.addWidget(self.token, 1)
        self.caja_token.addWidget(self.copiar)
        alta.cuerpo.addLayout(self.caja_token)
        self._mostrar_token(False)
        alta.setVisible(False)  # se abre con el botón de la cabecera
        self.alta = alta
        self.col.addWidget(alta)

        self.col.addWidget(rotulo("Vinculadas"))
        self.lista = QVBoxLayout()
        self.lista.setSpacing(10)
        self.col.addLayout(self.lista)
        self.col.addStretch()

    def _mostrar_token(self, si: bool) -> None:
        self.token.setVisible(si)
        self.copiar.setVisible(si)
        if not si:
            self.token.clear()

    def al_mostrar(self) -> None:
        en_segundo_plano(self.cliente.gateways, self._con_gateways)

    def en_vivo(self, nodos: list[Datos], eventos: list[Datos]) -> None:
        def firma(lista: list[Datos]) -> list[tuple]:
            return [(n.get("id"), n.get("estado"), n.get("gatewayId")) for n in lista]

        cambio = firma(nodos) != firma(self.nodos)
        self.nodos = nodos
        if cambio and self.gateways is not None:
            self._con_gateways(self.gateways)

    def _con_gateways(self, valor: object) -> None:
        limpiar(self.lista)
        if isinstance(valor, ErrorCentinela):
            self.lista.addWidget(etiqueta_con("error", str(valor)))
            return
        self.gateways = list(valor)  # type: ignore[arg-type]
        activas = [g for g in valor if not g.get("revocadoEn")]  # type: ignore[union-attr]
        revocadas = [g for g in valor if g.get("revocadoEn")]  # type: ignore[union-attr]
        for g in activas:
            self.lista.addWidget(self._tarjeta(g))
        if not activas:
            self.lista.addWidget(etiqueta_con("suave", "Todavía no hay ninguna Raspberry Pi vinculada."))
            self.alta.setVisible(True)
        if revocadas:
            # Plegadas como en la web ("Revocadas (N)"): son historial, no algo que atender.
            caja = QWidget()
            col = QVBoxLayout(caja)
            col.setContentsMargins(0, 0, 0, 0)
            col.setSpacing(10)
            for g in revocadas:
                col.addWidget(self._tarjeta(g))
            caja.setVisible(False)
            boton = QPushButton(f"  Revocadas ({len(revocadas)})")
            boton.setObjectName("enlace")
            boton.setIcon(lucide("chevron-right", tema.TEXTO_SUAVE, 16))
            boton.setStyleSheet(f"color: {tema.TEXTO_SUAVE}; padding: 6px 0;")
            boton.setCursor(Qt.CursorShape.PointingHandCursor)

            def alternar(_: bool = False, caja: QWidget = caja, boton: QPushButton = boton, n: int = len(revocadas)) -> None:
                caja.setVisible(caja.isHidden())
                boton.setIcon(lucide("chevron-right" if caja.isHidden() else "chevron-down", tema.TEXTO_SUAVE, 16))

            boton.clicked.connect(alternar)
            self.lista.addWidget(boton)
            self.lista.addWidget(caja)

    def _tarjeta(self, g: Datos) -> Tarjeta:
        t = Tarjeta()
        fila = QHBoxLayout()
        textos = QVBoxLayout()
        nombre = etiqueta_con("mono", g.get("nombre", ""))
        nombre.setStyleSheet("font-size: 14px; font-weight: 600;")
        textos.addWidget(nombre)
        suyos = [] if g.get("revocadoEn") else [n for n in self.nodos if n.get("gatewayId") == g.get("id")]
        cuantos = "" if g.get("revocadoEn") else f" · {len(suyos)} nodo{'s' if len(suyos) != 1 else ''}"
        textos.addWidget(etiqueta_con("tenue", f"{g.get('urlBase', '')} · último contacto {hace(g.get('ultimoContacto'))}{cuantos}"))
        fila.addLayout(textos, 1)
        if g.get("revocadoEn"):
            fila.addWidget(chip_texto(f"revocada {fecha(g['revocadoEn'], '%d %b %Y')}", tema.TEXTO_TENUE))
        else:
            fila.addWidget(chip_texto("armado" if g.get("armadoAhora") else "desarmado", tema.AMBAR if g.get("armadoAhora") else tema.TEXTO_TENUE),
                           alignment=Qt.AlignmentFlag.AlignVCenter)
            modo = QComboBox()
            for clave, nombre_modo in MODOS_ARMADO.items():
                modo.addItem(nombre_modo, clave)
            modo.setCurrentIndex(max(0, modo.findData(g.get("modoArmado", "armado"))))
            modo.currentIndexChanged.connect(lambda _i: self._elegir_modo(g, modo))
            fila.addWidget(modo)
            horario = QPushButton("Horario…")
            horario.clicked.connect(lambda: self._editar_horario(g))
            fila.addWidget(horario)
            b = QPushButton("Revocar")
            b.clicked.connect(lambda: self._revocar(g, b))
            fila.addWidget(b)
        t.cuerpo.addLayout(fila)
        if not g.get("revocadoEn"):
            quien = f" · cambió {g['armadoCambiadoPor']} {hace(g.get('armadoCambiadoEn'))}" if g.get("armadoCambiadoPor") else ""
            t.cuerpo.addWidget(etiqueta_con("tenue", describir_armado(g) + quien, ajustar=True))
        # Los nodos de esta Pi, con su estado: antes solo se veían en el Monitor
        for n in suyos:
            texto_estado, color = ESTADO_NODO.get(n.get("estado", ""), ("—", tema.TEXTO_TENUE))
            linea = QHBoxLayout()
            linea.setContentsMargins(14, 0, 0, 0)
            punto = QLabel("●")
            punto.setStyleSheet(f"color: {color}; font-size: 10px;")
            linea.addWidget(punto)
            linea.addWidget(etiqueta_con("mono", n.get("nombre") or n.get("uid", "")))
            linea.addWidget(etiqueta_con("tenue", f"{texto_estado} · último contacto {hace(n.get('ultimoContacto'))}"), 1)
            t.cuerpo.addLayout(linea)
        return t

    def _vincular(self) -> None:
        nombre, url = self.nombre.text().strip(), self.url.text().strip()
        if not nombre or not url.startswith(("http://", "https://")):
            avisar(self.aviso, "Escribe un nombre y una dirección que empiece con http:// o https://.", "error")
            return
        self._mostrar_token(False)

        def creada(valor: object) -> None:
            self.token.setText(valor.get("token", ""))  # type: ignore[union-attr]
            self._mostrar_token(True)
            self.nombre.clear()
            self.url.clear()
            self.al_mostrar()

        enviar(self.boton_vincular, self.aviso, lambda: self.cliente.vincular_gateway(nombre, url),
               "Vinculada. Copia este token en la Pi ahora: no se vuelve a mostrar.", creada)

    def _armar(self, g: Datos, cambios: Datos, control: QWidget | None = None) -> None:
        if control is not None:
            control.setEnabled(False)

        def listo(valor: object) -> None:
            if control is not None:
                control.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                avisar(self.aviso, str(valor), "error")
            self.al_mostrar()  # repinta con lo que dice el servidor, también si falló

        en_segundo_plano(lambda: self.cliente.armar_gateway(int(g["id"]), cambios), listo)

    def _elegir_modo(self, g: Datos, combo: QComboBox) -> None:
        if combo.currentData() == "horario" and not g.get("horarioArmado"):
            self._editar_horario(g)  # primero se define; guardarlo activa el modo
            return
        self._armar(g, {"modoArmado": combo.currentData()}, combo)

    def _editar_horario(self, g: Datos) -> None:
        dialogo = DialogoHorario(self, leer_horario(g.get("horarioArmado")))
        if dialogo.exec():
            self._armar(g, {"modoArmado": "horario", "horario": dialogo.horario()})
        else:
            self.al_mostrar()  # devuelve el selector a su modo real si se canceló

    def _revocar(self, g: Datos, boton: QPushButton) -> None:
        if not confirmar(self, "Revocar Raspberry Pi",
                         f"«{g.get('nombre')}» dejará de poder reportar al instante. Su historial se conserva. ¿Continuar?"):
            return
        boton.setEnabled(False)

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                boton.setEnabled(True)
                avisar(self.aviso, str(valor), "error")
            else:
                self.al_mostrar()

        en_segundo_plano(lambda: self.cliente.revocar_gateway(int(g["id"])), listo)


# Armado por Pi: mismas reglas que lib/edge/armado.ts de la web (roadmap de funciones #4).
MODOS_ARMADO = {"armado": "Armado", "desarmado": "Desarmado", "horario": "Por horario"}
DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]


def leer_horario(texto: str | None) -> Datos | None:
    try:
        h = json.loads(texto) if texto else None
    except ValueError:
        return None
    return h if isinstance(h, dict) and h.get("dias") and h.get("desde") and h.get("hasta") else None


def describir_armado(g: Datos) -> str:
    """El armado ahora lo calcula la web (armadoAhora); aquí solo se explica el modo."""
    vac = g.get("vacacionesHasta")
    if vac and _dt_vigente(vac):
        return f"Modo vacaciones hasta {fecha(vac, '%d %b')} · armado"
    if g.get("modoArmado") != "horario":
        return MODOS_ARMADO.get(g.get("modoArmado", ""), g.get("modoArmado", ""))
    h = leer_horario(g.get("horarioArmado"))
    if not h:
        return "Por horario (sin horario válido) · armado"
    dias = " ".join(DIAS_CORTOS[d] for d in sorted(h["dias"]))
    return f"Por horario: {dias} {h['desde']}–{h['hasta']} · ahora {'armado' if g.get('armadoAhora') else 'desarmado'}"


def _dt_vigente(iso: str) -> bool:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")) > datetime.now(timezone.utc)
    except ValueError:
        return False


class DialogoHorario(QDialog):
    """Días y ventana horaria en que la Pi queda armada (si cruza la medianoche, cuenta el día de inicio)."""

    def __init__(self, padre: QWidget, actual: Datos | None) -> None:
        super().__init__(padre)
        actual = actual or {"dias": list(range(7)), "desde": "22:00", "hasta": "07:00"}
        self.setWindowTitle("Horario de armado")
        col = QVBoxLayout(self)
        col.setContentsMargins(24, 22, 24, 22)
        col.addWidget(rotulo("Horario de armado"))
        col.addWidget(etiqueta_con("tenue", "Fuera de este horario el lugar queda desarmado: no abre reportes ni disuade. "
                                            "Pánico, manipulación y desconexión avisan siempre.", ajustar=True))
        dias = QHBoxLayout()
        self.dias = []
        for i, nombre in enumerate(DIAS_CORTOS):
            c = QCheckBox(nombre)
            c.setChecked(i in actual["dias"])
            self.dias.append(c)
            dias.addWidget(c)
        col.addLayout(dias)
        horas = QHBoxLayout()
        self.desde, self.hasta = QTimeEdit(QTime.fromString(actual["desde"], "HH:mm")), QTimeEdit(QTime.fromString(actual["hasta"], "HH:mm"))
        for etq, w in (("De", self.desde), ("a", self.hasta)):
            w.setDisplayFormat("HH:mm")
            horas.addWidget(etiqueta_con("tenue", etq))
            horas.addWidget(w)
        horas.addStretch()
        col.addLayout(horas)
        self.aviso = etiqueta_con("tenue", "")
        col.addWidget(self.aviso)
        pie = QHBoxLayout()
        pie.addStretch()
        cancelar = QPushButton("Cancelar")
        cancelar.clicked.connect(self.reject)
        guardar = QPushButton("Guardar horario")
        guardar.setObjectName("primario")
        guardar.clicked.connect(self._validar)
        pie.addWidget(cancelar)
        pie.addWidget(guardar)
        col.addLayout(pie)

    def horario(self) -> Datos:
        return {"dias": [i for i, c in enumerate(self.dias) if c.isChecked()],
                "desde": self.desde.time().toString("HH:mm"), "hasta": self.hasta.time().toString("HH:mm")}

    def _validar(self) -> None:
        h = self.horario()
        if not h["dias"]:
            avisar(self.aviso, "Elige al menos un día.", "error")
        elif h["desde"] == h["hasta"]:
            avisar(self.aviso, "La hora de inicio y la de fin no pueden ser iguales.", "error")
        else:
            self.accept()


# ---------------------------------------------------------------- Administración
ACCIONES = {"cambio_rol": "Cambio de rol", "cuenta_eliminada": "Cuenta eliminada", "dos_pasos_quitado": "Quitó la verificación en dos pasos"}


# Mismo catálogo y orden que lib/permisos.ts de la web (una prueba lo compara)
PERMISOS = [
    ("reportes.ver_todos", "Ver todos los reportes", "Lista, estadísticas, comentarios, historial y CSV de reportes de cualquier cuenta, no solo los propios."),
    ("reportes.resolver", "Resolver reportes", "Marcar un reporte como resuelto."),
    ("reportes.reclasificar", "Reclasificar reportes", "Cambiar prioridad y categoría de un reporte."),
    ("reportes.asignar", "Asignar reportes", "Asignar o reasignar un reporte a un Operador."),
    ("usuarios.gestionar", "Gestionar usuarios", "Listar cuentas, cambiar roles, eliminar cuentas y ajustar permisos."),
    ("auditoria.ver", "Ver auditoría de cuentas", "Consultar el registro de cambios de rol, permisos y cuentas eliminadas."),
    ("dispositivos.propios", "Dispositivos propios", "Bitácora, Centro de Dispositivos y Monitor en Vivo de la propia cuenta."),
    ("dispositivos.otros", "Dispositivos de otras cuentas", "Ver y gestionar el equipo de cualquier otra cuenta."),
    ("prototipo.ejecutar", "Ejecutar simulación del prototipo", "Correr la simulación FSM y limpiar sus datos en /prototipo."),
    ("vision.revisar", "Revisar la detección por cámara", "Marcar en las fotos de los nodos si había un ave y ver qué tan bien detecta el modelo, en /vision."),
]
ESTADOS_PERMISO = [("defecto", "Por defecto"), ("otorgado", "Otorgado"), ("quitado", "Quitado")]


class DialogoPermisos(QDialog):
    """Excepciones de permisos de una cuenta Usuario/Operador, como el PermisosPanel de la web."""

    def __init__(self, padre: QWidget, cliente: ClienteCentinela, u: Datos, es_admin: bool, mis_permisos: list[str]) -> None:
        super().__init__(padre)
        self.cliente, self.u = cliente, u
        self.es_admin, self.mis_permisos = es_admin, set(mis_permisos)
        self.setWindowTitle(f"Permisos de {u.get('nombre', '')}")
        self.setMinimumWidth(680)
        self.col = QVBoxLayout(self)
        self.col.setContentsMargins(24, 22, 24, 22)
        self.col.addWidget(rotulo("Permisos"))
        self.sub = etiqueta_con("tenue", f"{u.get('email', '')} — los cambios quedan en la auditoría de cuentas.", ajustar=True)
        self.col.addWidget(self.sub)
        self.aviso = etiqueta_con("tenue", "Cargando permisos…", ajustar=True)
        self.col.addWidget(self.aviso)
        self.filas = QVBoxLayout()
        self.col.addLayout(self.filas)
        self.grupos: dict[str, QButtonGroup] = {}
        pie = QHBoxLayout()
        pie.addStretch()
        cerrar = QPushButton("Cerrar")
        cerrar.clicked.connect(self.reject)
        self.guardar = QPushButton("Guardar permisos")
        self.guardar.setObjectName("primario")
        self.guardar.setEnabled(False)
        self.guardar.clicked.connect(self._guardar)
        pie.addWidget(cerrar)
        pie.addWidget(self.guardar)
        self.col.addLayout(pie)
        en_segundo_plano(lambda: self.cliente.permisos_usuario(int(u["id"])), self.pintar)

    def pintar(self, valor: object) -> None:
        if isinstance(valor, ErrorCentinela):
            avisar(self.aviso, str(valor), "error")
            return
        self.aviso.setVisible(False)
        self.sub.setText(f"{self.u.get('email', '')} · Rol {valor.get('rol', '')} — los cambios quedan en la auditoría de cuentas.")  # type: ignore[union-attr]
        limpiar(self.filas)
        self.grupos.clear()
        por_defecto = set(valor.get("porDefecto", []))  # type: ignore[union-attr]
        estados = valor.get("estados", {})  # type: ignore[union-attr]
        for clave, nombre, descripcion in PERMISOS:
            # Igual que la web: quien no es Admin solo toca lo que él mismo tiene, y nunca usuarios.gestionar.
            bloqueado = not self.es_admin and (clave == "usuarios.gestionar" or clave not in self.mis_permisos)
            pista = " — Solo un Admin puede cambiarlo" if clave == "usuarios.gestionar" else " — No tienes este permiso"
            fila = QHBoxLayout()
            textos = QVBoxLayout()
            textos.setSpacing(1)
            t = QLabel(nombre)
            t.setStyleSheet("font-weight: 500;")
            textos.addWidget(t)
            textos.addWidget(etiqueta_con("tenue", descripcion, ajustar=True))
            textos.addWidget(etiqueta_con("tenue", f"Por defecto del rol: {'sí' if clave in por_defecto else 'no'}{pista if bloqueado else ''}"))
            fila.addLayout(textos, 1)
            grupo = QButtonGroup(self)
            for valor_estado, etq in ESTADOS_PERMISO:
                b = QPushButton(etq)
                b.setObjectName("chip")
                b.setCheckable(True)
                b.setEnabled(not bloqueado)
                b.setChecked(estados.get(clave, "defecto") == valor_estado)
                b.setProperty("estado", valor_estado)
                grupo.addButton(b)
                fila.addWidget(b)
            self.grupos[clave] = grupo
            self.filas.addLayout(fila)
            self.filas.addSpacing(8)
        self.guardar.setEnabled(True)

    def estados(self) -> dict[str, str]:
        return {clave: g.checkedButton().property("estado") for clave, g in self.grupos.items() if g.checkedButton()}

    def _guardar(self) -> None:
        def listo(valor: object) -> None:
            self.guardar.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                self.aviso.setVisible(True)
                avisar(self.aviso, str(valor), "error")
                return
            self.accept()

        self.guardar.setEnabled(False)
        en_segundo_plano(lambda: self.cliente.guardar_permisos(int(self.u["id"]), self.estados()), listo)


class VistaAdmin(Vista):
    def __init__(self, cliente: ClienteCentinela, usuario: Datos) -> None:
        super().__init__()
        self.cliente = cliente
        self.yo = usuario.get("id")
        permisos = usuario.get("permisos", [])
        self.mis_permisos = permisos
        self.es_admin = usuario.get("role") == "Admin"
        self.gestiona = "usuarios.gestionar" in permisos
        self.audita = "auditoria.ver" in permisos
        cabeza, _, _ = encabezado("Administración", "Cuentas, roles, permisos y el registro de cambios.")
        self.col.addWidget(cabeza)
        self.aviso = etiqueta_con("tenue", "", ajustar=True)
        self.aviso.setVisible(False)
        self.col.addWidget(self.aviso)
        self.roles: list[Datos] = []

        self.usuarios: list[Datos] = []
        self.filtro_rol: str | None = None
        self.panel_usuarios, self.lista_usuarios = self._panel("Usuarios", self.gestiona)
        # Filtro por rol, en la misma fila que el título del panel
        fila_filtro = QHBoxLayout()
        fila_filtro.addWidget(self.panel_usuarios.cuerpo.takeAt(0).widget())
        fila_filtro.addStretch()
        self.chips_rol: list[QPushButton] = []
        for texto, rol in (("Todos", None), ("Admin", "Admin"), ("Operador", "Operador"), ("Usuario", "Usuario")):
            chip = QPushButton(texto)
            chip.setObjectName("chip")
            chip.setCheckable(True)
            chip.setChecked(rol is None)
            chip.clicked.connect(lambda _=False, r=rol, c=chip: self._filtrar_rol(r, c))
            self.chips_rol.append(chip)
            fila_filtro.addWidget(chip)
        self.panel_usuarios.cuerpo.insertLayout(0, fila_filtro)
        self.panel_auditoria, self.lista_auditoria = self._panel("Auditoría de cuentas", self.audita)
        self.col.addStretch()

    def _panel(self, titulo: str, visible: bool) -> tuple[Tarjeta, QVBoxLayout]:
        panel = Tarjeta()
        panel.cuerpo.addWidget(rotulo(titulo))
        lista = QVBoxLayout()
        lista.setSpacing(0)
        panel.cuerpo.addLayout(lista)
        panel.setVisible(visible)
        self.col.addWidget(panel)
        return panel, lista

    def al_mostrar(self) -> None:
        if self.gestiona:
            en_segundo_plano(lambda: (self.cliente.roles(), self.cliente.usuarios()), self._con_usuarios)
        if self.audita:
            en_segundo_plano(self.cliente.auditoria, self._con_auditoria)

    def _con_usuarios(self, valor: object) -> None:
        limpiar(self.lista_usuarios)
        if isinstance(valor, ErrorCentinela):
            self.lista_usuarios.addWidget(etiqueta_con("error", str(valor)))
            return
        self.roles, self.usuarios = valor  # type: ignore[misc]
        self._pintar_usuarios()

    def _filtrar_rol(self, rol: str | None, chip: QPushButton) -> None:
        self.filtro_rol = rol
        for c in self.chips_rol:
            c.setChecked(c is chip)
        self._pintar_usuarios()

    def _pintar_usuarios(self) -> None:
        limpiar(self.lista_usuarios)
        visibles = [u for u in self.usuarios if self.filtro_rol is None or (u.get("rol") or {}).get("nombre") == self.filtro_rol]
        for u in visibles:
            self.lista_usuarios.addWidget(self._fila_usuario(u))
        if not visibles:
            self.lista_usuarios.addWidget(etiqueta_con("suave", "Ninguna cuenta con ese rol."))

    def _fila_usuario(self, u: Datos) -> Tarjeta:
        fila = Tarjeta()
        fila.setStyleSheet(f"QFrame#tarjeta {{ border: none; border-bottom: 1px solid {tema.BORDE}; border-radius: 0; }}")
        h = QHBoxLayout()
        textos = QVBoxLayout()
        actual = (u.get("rol") or {}).get("nombre")
        textos.addWidget(QLabel(u.get("nombre", "")))
        detalle = f"{u.get('email', '')} · último acceso {hace(u.get('ultimoLogin'))}"
        if actual == "Operador":
            carga = (u.get("_count") or {}).get("reportesAsignados", 0)
            detalle += f" · {carga} pendiente{'s' if carga != 1 else ''} asignado{'s' if carga != 1 else ''}"
        textos.addWidget(etiqueta_con("tenue", detalle))
        h.addLayout(textos, 1)
        es_yo = u.get("id") == self.yo
        rol = QComboBox()
        for r in self.roles:
            rol.addItem(r["nombre"], r["id"])
        rol.setCurrentText(actual or "")
        rol.setEnabled(not es_yo)  # la web tampoco deja cambiarse el rol ni eliminarse a uno mismo
        rol.currentIndexChanged.connect(lambda _i: self._cambiar_rol(u, rol, actual))
        h.addWidget(rol)
        if actual in ("Operador", "Usuario") and not es_yo:  # las cuentas Admin tienen siempre todo
            perm = QPushButton("Permisos")
            perm.clicked.connect(lambda: self._permisos(u))
            h.addWidget(perm)
        borrar = QPushButton("Eliminar")
        borrar.setEnabled(not es_yo)
        borrar.clicked.connect(lambda: self._eliminar(u, borrar))
        h.addWidget(borrar)
        if es_yo:
            h.addWidget(etiqueta_con("tenue", "(tú)"))
        fila.cuerpo.addLayout(h)
        return fila

    def _permisos(self, u: Datos) -> None:
        if DialogoPermisos(self, self.cliente, u, self.es_admin, self.mis_permisos).exec():
            avisar(self.aviso, f"Permisos de {u.get('email')} guardados.", "ok")
            if self.audita:
                en_segundo_plano(self.cliente.auditoria, self._con_auditoria)

    def _cambiar_rol(self, u: Datos, combo: QComboBox, anterior: str | None) -> None:
        nuevo = combo.currentText()
        if not confirmar(self, "Cambiar rol", f"¿Cambiar a {u.get('email')} de {anterior} a {nuevo}? Sus permisos especiales se reinician."):
            combo.blockSignals(True)
            combo.setCurrentText(anterior or "")
            combo.blockSignals(False)
            return
        combo.setEnabled(False)

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                avisar(self.aviso, str(valor), "error")
            else:
                avisar(self.aviso, f"{u.get('email')} ahora es {nuevo}.", "ok")
            self.al_mostrar()  # repinta con lo que dice el servidor, también si falló

        rol_id = int(combo.currentData())
        en_segundo_plano(lambda: self.cliente.cambiar_rol(int(u["id"]), rol_id), listo)

    def _eliminar(self, u: Datos, boton: QPushButton) -> None:
        if not confirmar(self, "Eliminar cuenta", f"Se eliminará la cuenta de {u.get('email')}. Esto no se puede deshacer. ¿Continuar?"):
            return
        boton.setEnabled(False)

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                boton.setEnabled(True)
                avisar(self.aviso, str(valor), "error")
            else:
                avisar(self.aviso, f"Cuenta de {u.get('email')} eliminada.", "ok")
                self.al_mostrar()

        en_segundo_plano(lambda: self.cliente.eliminar_usuario(int(u["id"])), listo)

    def _con_auditoria(self, valor: object) -> None:
        limpiar(self.lista_auditoria)
        if isinstance(valor, ErrorCentinela):
            self.lista_auditoria.addWidget(etiqueta_con("error", str(valor)))
            return
        for r in valor:  # type: ignore[union-attr]
            e = {k: escape(str(r.get(k) or "—")) for k in ("valorAnterior", "valorNuevo", "objetivoEmail", "adminEmail")}
            fila = QLabel(
                f'<span style="font-family:{tema.MONO};font-size:11px;color:{tema.TEXTO_TENUE}">{fecha(r.get("createdAt"))}</span><br>'
                # Sin "→": la fuente incluida no lo trae y sale como un cuadro.
                f'{ACCIONES.get(r.get("accion"), escape(str(r.get("accion"))))}: {e["objetivoEmail"]}'
                f' ({"de " + e["valorAnterior"] + " a " + e["valorNuevo"] if r.get("valorNuevo") else "era " + e["valorAnterior"]})'
                f' <span style="color:{tema.TEXTO_SUAVE}">por {e["adminEmail"]}</span>'
            )
            fila.setStyleSheet(f"padding: 8px 2px; border-bottom: 1px solid {tema.BORDE};")
            self.lista_auditoria.addWidget(fila)
        if not valor:
            self.lista_auditoria.addWidget(etiqueta_con("suave", "Sin cambios registrados."))

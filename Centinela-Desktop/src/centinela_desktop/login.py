"""Inicio de sesión nativo (mismo diseño que /iniciar-sesion de la web)."""
from __future__ import annotations

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QFrame, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget

from . import tema
from .cliente import ClienteCentinela, ErrorCentinela
from .componentes import etiqueta_con
from .icono import icono, pixmap_logo
from .tareas import en_segundo_plano


class VentanaLogin(QWidget):
    sesion_iniciada = Signal(dict)  # el usuario de GET /api/me
    pide_cambiar_servidor = Signal()

    def __init__(self, cliente: ClienteCentinela) -> None:
        super().__init__()
        self.cliente = cliente
        self.setObjectName("raiz")
        self.setWindowTitle("Centinela — Iniciar sesión")
        self.setWindowIcon(icono())
        self.resize(520, 700)

        col = QVBoxLayout(self)
        col.setContentsMargins(48, 40, 48, 32)
        col.setSpacing(10)
        col.addStretch()

        logo = QLabel()
        logo.setPixmap(pixmap_logo(84))
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        col.addWidget(logo)
        marca = QLabel("CENTINELA")
        marca.setAlignment(Qt.AlignmentFlag.AlignCenter)
        marca.setStyleSheet("font-size: 30px; font-weight: 800; letter-spacing: 4px;")
        col.addWidget(marca)
        sub = QLabel("ACCESO AL SISTEMA")
        sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        sub.setStyleSheet(f"font-family: '{tema.MONO}'; font-size: 11px; letter-spacing: 3px; color: {tema.TEXTO_SUAVE};")
        col.addWidget(sub)
        col.addSpacing(18)

        tarjeta = QFrame()
        tarjeta.setObjectName("tarjeta")
        tarjeta.setStyleSheet(f"QFrame#tarjeta {{ border-left: 2px solid {tema.CARMESI}; }}")
        form = QVBoxLayout(tarjeta)
        form.setContentsMargins(28, 26, 28, 26)
        form.setSpacing(8)
        form.addWidget(self._rotulo("CORREO ELECTRÓNICO"))
        self.email = QLineEdit()
        self.email.setPlaceholderText("tu@email.com")
        form.addWidget(self.email)
        form.addSpacing(8)
        form.addWidget(self._rotulo("CONTRASEÑA"))
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)
        self.password.returnPressed.connect(self._entrar)
        form.addWidget(self.password)
        # Verificación en dos pasos: aparece solo si el servidor la pide tras la contraseña.
        self.desafio: str | None = None
        self.rotulo_codigo = self._rotulo("CÓDIGO DE VERIFICACIÓN (APP O RESPALDO)")
        self.codigo = QLineEdit()
        self.codigo.setPlaceholderText("123 456")
        self.codigo.setMaxLength(20)
        self.codigo.returnPressed.connect(self._entrar)
        for w in (self.rotulo_codigo, self.codigo):
            w.setVisible(False)
            form.addWidget(w)
        form.addSpacing(10)
        self.boton = QPushButton("ACCEDER AL SISTEMA  →")
        self.boton.setObjectName("primario")
        self.boton.setStyleSheet("padding: 12px; letter-spacing: 1px;")
        self.boton.clicked.connect(self._entrar)
        form.addWidget(self.boton)
        self.error = etiqueta_con("error", "", ajustar=True)
        form.addWidget(self.error)
        col.addWidget(tarjeta)

        col.addSpacing(8)
        servidor = QPushButton(f"Servidor: {cliente.servidor} · cambiar")
        servidor.setObjectName("enlace")
        servidor.setStyleSheet(f"color: {tema.TEXTO_TENUE}; font-size: 12px;")
        servidor.clicked.connect(self.pide_cambiar_servidor.emit)
        col.addWidget(servidor, 0, Qt.AlignmentFlag.AlignCenter)
        col.addStretch()
        pie = QLabel("© 2026 CENTINELA AURIS · ACCESO RESTRINGIDO A PERSONAL AUTORIZADO")
        pie.setAlignment(Qt.AlignmentFlag.AlignCenter)
        pie.setStyleSheet(f"font-family: '{tema.MONO}'; font-size: 9px; letter-spacing: 1px; color: {tema.TEXTO_TENUE};")
        col.addWidget(pie)
        self.email.setFocus()

    @staticmethod
    def _rotulo(texto: str) -> QLabel:
        lbl = QLabel(texto)
        lbl.setStyleSheet(f"font-size: 11px; font-weight: 700; letter-spacing: 1px; color: {tema.TEXTO_SUAVE};")
        return lbl

    def entrar_con(self, email: str, password: str) -> None:
        """Rellena y envía (lo usa el modo de verificación automática)."""
        self.email.setText(email)
        self.password.setText(password)
        self._entrar()

    def _entrar(self) -> None:
        email, password = self.email.text().strip(), self.password.text()
        desafio, codigo = self.desafio, self.codigo.text().strip()
        if desafio and len(codigo) < 6:
            self.error.setText("Escribe el código de tu app o uno de respaldo.")
            return
        if not desafio and (not email or not password):
            self.error.setText("Escribe tu correo y tu contraseña.")
            return
        self.boton.setEnabled(False)
        self.boton.setText("Verificando…" if desafio else "Entrando…")
        self.error.setText("")

        def trabajo() -> dict:
            if desafio:
                self.cliente.verificar_codigo(desafio, codigo)
                return self.cliente.yo()
            r = self.cliente.iniciar_sesion(email, password)
            return r if r.get("requiere2fa") else self.cliente.yo()

        en_segundo_plano(trabajo, self._resultado)

    def _paso_codigo(self, desafio: str | None) -> None:
        """Muestra u oculta el campo del código (desafio None = volver a la contraseña)."""
        self.desafio = desafio
        for w in (self.rotulo_codigo, self.codigo):
            w.setVisible(desafio is not None)
        self.email.setEnabled(desafio is None)
        self.password.setEnabled(desafio is None)
        self.codigo.clear()
        self.boton.setText("VERIFICAR  →" if desafio else "ACCEDER AL SISTEMA  →")
        (self.codigo if desafio else self.password).setFocus()

    def _resultado(self, valor: object) -> None:
        self.boton.setEnabled(True)
        if isinstance(valor, ErrorCentinela):
            if self.desafio and valor.estado == 400:  # el desafío venció: de vuelta a la contraseña
                self._paso_codigo(None)
            else:
                self.boton.setText("VERIFICAR  →" if self.desafio else "ACCEDER AL SISTEMA  →")
            self.error.setText(str(valor))
            return
        if isinstance(valor, dict) and valor.get("requiere2fa"):
            self._paso_codigo(valor.get("desafio"))
            return
        self.password.clear()
        self._paso_codigo(None)
        self.sesion_iniciada.emit(valor)

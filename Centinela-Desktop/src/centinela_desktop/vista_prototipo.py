"""Referencia del prototipo en Qt: solo el catálogo de módulos. La simulación sigue en la web (decisión del PO, 2026-10-23).

Es consulta, no operación diaria: tarjetas compactas (nombre + función) que se despliegan con el detalle.
"""
from __future__ import annotations

from html import escape

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QGridLayout, QLabel, QPushButton, QVBoxLayout, QWidget

from . import tema
from .componentes import Tarjeta, encabezado, etiqueta_con, rotulo
from .icono import lucide
from .modulos import GRUPOS, MODULOS
from .vistas import Vista

COLUMNAS = 3


class VistaPrototipo(Vista):
    def __init__(self) -> None:
        super().__init__()
        cabeza, _, _ = encabezado("Referencia del prototipo",
                                  f"Los {len(MODULOS)} módulos de Centinel v2. La simulación se ejecuta en la web.")
        self.col.addWidget(cabeza)
        # Una sola rejilla en orden de grupo (el grupo va dentro de cada tarjeta): sin huecos de grupos de 1 o 2
        rejilla = QGridLayout()
        rejilla.setSpacing(12)
        for c in range(COLUMNAS):
            rejilla.setColumnStretch(c, 1)
        ordenados = sorted(MODULOS, key=lambda m: GRUPOS.index(m[0]))
        for i, m in enumerate(ordenados):
            rejilla.addWidget(self._tarjeta(m), i // COLUMNAS, i % COLUMNAS, Qt.AlignmentFlag.AlignTop)
        self.tarjetas = len(ordenados)
        self.col.addLayout(rejilla)
        self.col.addStretch()

    @staticmethod
    def _tarjeta(m: tuple[str, ...]) -> Tarjeta:
        grupo, nombre, funcion, especificacion, conexion, pdf = m
        t = Tarjeta()
        t.cuerpo.setSpacing(6)
        t.cuerpo.addWidget(rotulo(grupo))
        cabeza = QPushButton("  " + nombre.replace("→", " a "))  # la fuente incluida no trae "→"
        cabeza.setObjectName("enlace")
        cabeza.setCursor(Qt.CursorShape.PointingHandCursor)
        cabeza.setIcon(lucide("chevron-right", tema.TEXTO_SUAVE, 14))
        cabeza.setStyleSheet(f"color: {tema.TEXTO}; font-size: 15px; font-weight: 600;")
        t.cuerpo.addWidget(cabeza)
        t.cuerpo.addWidget(etiqueta_con("suave", funcion, ajustar=True))
        detalle = QWidget()
        col = QVBoxLayout(detalle)
        col.setContentsMargins(0, 4, 0, 0)
        col.setSpacing(6)
        col.addWidget(etiqueta_con("mono", especificacion, ajustar=True))
        extra = QLabel(f"Con Centinela: {escape(conexion)}<br>Fuente: PDF {pdf}")
        extra.setObjectName("tenue")
        extra.setWordWrap(True)
        col.addWidget(extra)
        detalle.setVisible(False)
        t.cuerpo.addWidget(detalle)

        def alternar() -> None:
            detalle.setVisible(detalle.isHidden())
            cabeza.setIcon(lucide("chevron-right" if detalle.isHidden() else "chevron-down", tema.TEXTO_SUAVE, 14))

        cabeza.clicked.connect(alternar)
        return t

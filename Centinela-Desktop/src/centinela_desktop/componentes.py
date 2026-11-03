"""Piezas visuales compartidas (las mismas que components/marca.tsx de la web, en Qt)."""
from __future__ import annotations

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QFrame, QGridLayout, QHBoxLayout, QLabel, QVBoxLayout, QWidget

from . import tema


def rotulo(texto: str) -> QLabel:
    lbl = QLabel(texto.upper())
    lbl.setObjectName("rotulo")
    return lbl


def etiqueta_con(nombre: str, texto: str = "", ajustar: bool = False) -> QLabel:
    lbl = QLabel(texto)
    lbl.setObjectName(nombre)
    lbl.setWordWrap(ajustar)
    return lbl


def titular(texto: str) -> QLabel:
    """Titular grande con el punto final en carmesí, como en la web."""
    lbl = QLabel()
    lbl.setObjectName("titular")
    lbl.setTextFormat(Qt.TextFormat.RichText)
    lbl.setWordWrap(True)
    fijar_titular(lbl, texto)
    return lbl


def fijar_titular(lbl: QLabel, texto: str) -> None:
    lbl.setText(f'{texto}<span style="color:{tema.CARMESI_TEXTO}">.</span>')


class Encabezado(QWidget):
    """Cabecera compacta de cada vista: título y bajada a la izquierda, cifras y botones a la derecha.

    El titular grande es del landing; en la consola el espacio es para los datos (auditoría 2026-10-24).
    """

    def __init__(self, titulo: str, bajada: str = "") -> None:
        super().__init__()
        fila = QHBoxLayout(self)
        fila.setContentsMargins(0, 0, 0, 4)
        fila.setSpacing(12)
        textos = QVBoxLayout()
        textos.setSpacing(2)
        self.tit = titular(titulo)
        self.tit.setObjectName("titulo_vista")
        self.baj = etiqueta_con("bajada", bajada, ajustar=True)
        textos.addWidget(self.tit)
        textos.addWidget(self.baj)
        fila.addLayout(textos, 1)
        self.acciones = QHBoxLayout()
        self.acciones.setSpacing(8)
        fila.addLayout(self.acciones)


def encabezado(titulo: str, bajada: str = "") -> tuple[Encabezado, QLabel, QLabel]:
    caja = Encabezado(titulo, bajada)
    return caja, caja.tit, caja.baj


class Tarjeta(QFrame):
    def __init__(self, padre: QWidget | None = None) -> None:
        super().__init__(padre)
        self.setObjectName("tarjeta")
        self.cuerpo = QVBoxLayout(self)
        self.cuerpo.setContentsMargins(20, 18, 20, 18)
        self.cuerpo.setSpacing(10)


TONOS = {"normal": tema.TEXTO, "senal": tema.AMBAR, "alerta": tema.CARMESI_TEXTO, "ok": tema.VERDE}


class FranjaCifras(QFrame):
    """Cifras en mono separadas por filetes (FranjaCifras de la web)."""

    def __init__(self, etiquetas: list[str]) -> None:
        super().__init__()
        self.setObjectName("tarjeta")
        rejilla = QGridLayout(self)
        rejilla.setContentsMargins(0, 0, 0, 0)
        rejilla.setSpacing(0)
        self._valores: list[QLabel] = []
        for i, texto in enumerate(etiquetas):
            celda = QFrame()
            celda.setObjectName("celda")
            if i:
                celda.setStyleSheet(f"QFrame#celda {{ border: none; border-left: 1px solid {tema.BORDE}; border-radius: 0; }}")
            col = QVBoxLayout(celda)
            col.setContentsMargins(18, 12, 18, 12)
            valor = QLabel("—")
            valor.setStyleSheet(f"font-family: '{tema.MONO}'; font-size: 24px; font-weight: 500; border: none;")
            nombre = QLabel(texto)
            nombre.setStyleSheet(f"color: {tema.TEXTO_SUAVE}; font-size: 13px; border: none;")
            col.addWidget(valor)
            col.addWidget(nombre)
            rejilla.addWidget(celda, 0, i)
            self._valores.append(valor)

    def fijar(self, i: int, valor: object, tono: str = "normal") -> None:
        lbl = self._valores[i]
        lbl.setText(str(valor))
        lbl.setStyleSheet(
            f"font-family: '{tema.MONO}'; font-size: 24px; font-weight: 500; border: none; color: {TONOS.get(tono, tema.TEXTO)};"
        )


class CifrasLinea(QLabel):
    """Las mismas cifras que FranjaCifras pero en una sola línea, para la cabecera de una vista."""

    def __init__(self, etiquetas: list[str]) -> None:
        super().__init__()
        self.setTextFormat(Qt.TextFormat.RichText)
        self.etiquetas = etiquetas
        self.valores: list[tuple[str, str]] = [("—", "normal")] * len(etiquetas)
        self._pintar()

    def fijar(self, i: int, valor: object, tono: str = "normal") -> None:
        self.valores[i] = (str(valor), tono)
        self._pintar()

    def _pintar(self) -> None:
        partes = [
            f'<span style="font-family:{tema.MONO};font-size:17px;color:{TONOS.get(tono, tema.TEXTO)}">{v}</span>'
            f'&nbsp;<span style="color:{tema.TEXTO_SUAVE}">{e}</span>'
            for (v, tono), e in zip(self.valores, self.etiquetas)
        ]
        self.setText("&nbsp;&nbsp;&nbsp;&nbsp;".join(partes))


def limpiar(layout) -> None:
    """Quita y destruye los widgets de un layout (para volver a pintar listas)."""
    while layout.count():
        item = layout.takeAt(0)
        if w := item.widget():
            w.deleteLater()
        elif sub := item.layout():
            limpiar(sub)

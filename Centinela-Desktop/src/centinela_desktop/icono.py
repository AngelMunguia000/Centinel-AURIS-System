"""Icono de Centinela dibujado en código (anillos blancos y núcleo carmesí, como el logo de la web)."""
from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QByteArray, QRectF, Qt
from PySide6.QtGui import QColor, QIcon, QPainter, QPen, QPixmap
from PySide6.QtSvg import QSvgRenderer

ICONOS = Path(__file__).parent / "iconos"  # SVG de Lucide (ISC), los mismos que usa la web

CARMESI = QColor("#c8243f")


def pixmap_logo(lado: int = 256, alerta: bool = False) -> QPixmap:
    pm = QPixmap(lado, lado)
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.setBrush(QColor("#0b0809"))
    p.setPen(Qt.PenStyle.NoPen)
    p.drawEllipse(QRectF(0, 0, lado, lado))
    p.setBrush(Qt.BrushStyle.NoBrush)
    for frac, grosor in ((0.40, 0.075), (0.27, 0.06)):
        p.setPen(QPen(QColor("white"), lado * grosor))
        r = lado * frac
        p.drawEllipse(QRectF(lado / 2 - r, lado / 2 - r, 2 * r, 2 * r))
    p.setPen(Qt.PenStyle.NoPen)
    # El núcleo se vuelve ámbar mientras haya un aviso sin atender.
    p.setBrush(QColor("#f2b84b") if alerta else CARMESI)
    r = lado * 0.15
    p.drawEllipse(QRectF(lado / 2 - r, lado / 2 - r, 2 * r, 2 * r))
    p.end()
    return pm


def icono(alerta: bool = False) -> QIcon:
    ic = QIcon()
    for lado in (16, 24, 32, 48, 64, 128, 256):
        ic.addPixmap(pixmap_logo(lado, alerta))
    return ic


def pixmap_lucide(nombre: str, color: str, lado: int = 18) -> QPixmap:
    svg = (ICONOS / f"{nombre}.svg").read_text(encoding="utf-8").replace("currentColor", color)
    pm = QPixmap(lado * 2, lado * 2)  # al doble para pantallas con escala
    pm.fill(Qt.GlobalColor.transparent)
    p = QPainter(pm)
    QSvgRenderer(QByteArray(svg.encode())).render(p)
    p.end()
    pm.setDevicePixelRatio(2)
    return pm


def lucide(nombre: str, color: str, lado: int = 18, color_activo: str | None = None) -> QIcon:
    """Icono de Lucide; con `color_activo`, un botón marcado (checked) lo muestra de ese color."""
    ic = QIcon(pixmap_lucide(nombre, color, lado))
    if color_activo:
        ic.addPixmap(pixmap_lucide(nombre, color_activo, lado), QIcon.Mode.Normal, QIcon.State.On)
    return ic

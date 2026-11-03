"""Identidad visual de la web en Qt: grafito + carmesí + ámbar señal, Inter Tight + IBM Plex Mono; cabecera en píldora y sidebar sin caja, como la web (Brain/21 §65)."""
from __future__ import annotations

from pathlib import Path

from PySide6.QtGui import QFontDatabase

FONDO = "#06090e"
TARJETA = "#0f1319"
BORDE = "#242931"
TEXTO = "#eff2f6"
TEXTO_SUAVE = "#979faa"
TEXTO_TENUE = "#636a72"
CARMESI = "#9e1b34"      # rellenos: botón principal (como --primary)
CARMESI_TEXTO = "#e0566c"  # rojo que se lee como texto (como --brand)
AMBAR = "#f2b84b"        # señal: en vivo, activo, datos (como --signal)
VERDE = "#4ade80"
ROJO_ALERTA = "#f87171"
NARANJA = "#fb923c"
AZUL = "#7dd3fc"          # reporte en atención (sky-300 de la web)

SANS = "Inter Tight"
MONO = "IBM Plex Mono"


def cargar_fuentes() -> None:
    carpeta = Path(__file__).parent / "fuentes"
    for ttf in carpeta.glob("*.ttf"):
        QFontDatabase.addApplicationFont(str(ttf))


QSS = f"""
* {{ font-family: '{SANS}', 'Segoe UI'; font-size: 14px; color: {TEXTO}; }}  /* 14 px como el texto de la web; Qt trae 9 pt */
QMainWindow, QDialog {{ background: {FONDO}; }}
QWidget#raiz {{ background: qradialgradient(cx:0.1, cy:0, radius:0.9, fx:0.1, fy:0, stop:0 #161d28, stop:0.6 {FONDO}); }}
QToolTip {{ background: {TARJETA}; color: {TEXTO}; border: 1px solid {BORDE}; padding: 6px; }}
QScrollArea, QScrollArea > QWidget > QWidget {{ background: transparent; border: none; }}
QScrollBar:vertical {{ background: transparent; width: 10px; margin: 0; }}
QScrollBar::handle:vertical {{ background: {BORDE}; border-radius: 5px; min-height: 30px; }}
QScrollBar::add-line, QScrollBar::sub-line {{ height: 0; }}

QFrame#tarjeta {{ background: {TARJETA}; border: 1px solid {BORDE}; border-radius: 16px; }}
QFrame#sidebar {{ background: transparent; border: none; }}
QFrame#cabecera {{ background: rgba(255,255,255,0.04); border: 1px solid {BORDE}; border-radius: 28px; }}
QFrame#cabecera QPushButton {{ border-radius: 16px; }}
QToolButton#campana {{ background: transparent; border: 1px solid {BORDE}; border-radius: 16px; padding: 6px 10px;
    color: {AMBAR}; font-weight: 600; }}
QToolButton#campana::menu-indicator {{ image: none; }}
QMenu {{ background: {TARJETA}; border: 1px solid {BORDE}; padding: 6px; }}
QMenu::item {{ padding: 8px 14px; border-radius: 6px; }}
QMenu::item:selected {{ background: rgba(255,255,255,0.06); }}

QLabel#titulo_vista {{ font-size: 26px; font-weight: 700; letter-spacing: -0.3px; }}
QLabel#bajada {{ font-size: 14px; color: {TEXTO_SUAVE}; }}
QLabel#rotulo {{ font-family: '{MONO}', Consolas; font-size: 11px; letter-spacing: 1px; color: {AMBAR}; }}
QLabel#grupo {{ font-family: '{MONO}', Consolas; font-size: 10px; letter-spacing: 2px; color: {TEXTO_TENUE}; padding-left: 10px; }}
QLabel#tenue {{ color: {TEXTO_TENUE}; font-size: 13px; }}
QLabel#suave {{ color: {TEXTO_SUAVE}; }}
QLabel#mono {{ font-family: '{MONO}', Consolas; }}
QLabel#error {{ color: {ROJO_ALERTA}; }}
QLabel#ok {{ color: {VERDE}; }}

QPushButton {{ background: rgba(255,255,255,0.05); border: 1px solid {BORDE}; border-radius: 8px;
    padding: 8px 14px; font-weight: 600; }}
QPushButton:hover {{ background: rgba(255,255,255,0.09); }}
QPushButton:disabled {{ color: {TEXTO_TENUE}; }}
QPushButton#primario {{ background: {CARMESI}; border: none; color: white; }}
QPushButton#primario:hover {{ background: #b02340; }}
QPushButton#primario:disabled {{ background: #4a1a22; color: {TEXTO_SUAVE}; }}
QPushButton#panico {{ background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5; padding: 10px; }}
QPushButton#panico:hover {{ background: rgba(239,68,68,0.25); }}
QPushButton#nav {{ background: transparent; border: none; border-radius: 8px; text-align: left;
    padding: 9px 12px; color: {TEXTO_SUAVE}; font-weight: 500; }}
QPushButton#nav:hover {{ background: rgba(255,255,255,0.04); color: {TEXTO}; }}
QPushButton#nav:checked {{ background: rgba(255,255,255,0.09); color: {TEXTO}; border-left: 2px solid {AMBAR}; }}
QPushButton#chip {{ border-radius: 14px; padding: 5px 14px; color: {TEXTO_SUAVE}; font-weight: 500; }}
QPushButton#chip:checked {{ border-color: rgba(242,184,75,0.55); background: rgba(242,184,75,0.10); color: {AMBAR}; }}
QPushButton#enlace {{ background: transparent; border: none; color: {AMBAR}; padding: 0; text-align: left; }}

QLineEdit, QTextEdit, QComboBox {{ background: rgba(255,255,255,0.04); border: 1px solid {BORDE};
    border-radius: 8px; padding: 8px 10px; selection-background-color: {CARMESI}; }}
QLineEdit:focus, QTextEdit:focus, QComboBox:focus {{ border-color: {AMBAR}; }}
QComboBox QAbstractItemView {{ background: {TARJETA}; border: 1px solid {BORDE}; selection-background-color: {CARMESI}; }}
QComboBox::drop-down {{ border: none; width: 22px; }}
QCheckBox {{ spacing: 10px; }}
QCheckBox::indicator {{ width: 16px; height: 16px; border: 1px solid {BORDE}; border-radius: 4px; background: rgba(255,255,255,0.04); }}
QCheckBox::indicator:checked {{ background: {AMBAR}; border-color: {AMBAR}; }}
QCheckBox::indicator:disabled {{ background: transparent; }}
QToolButton#cuenta {{ background: transparent; border: 1px solid {BORDE}; border-radius: 16px; padding: 6px 12px; font-weight: 500; }}
QToolButton#cuenta::menu-indicator {{ image: none; }}
QTableWidget {{ background: transparent; border: none; gridline-color: transparent; selection-background-color: rgba(242,184,75,0.10);
    selection-color: {TEXTO}; outline: 0; }}
QTableWidget::item {{ border-bottom: 1px solid {BORDE}; padding: 0 8px; }}
QTableWidget::item:selected {{ background: rgba(242,184,75,0.10); }}
QHeaderView, QTableCornerButton::section {{ background: transparent; border: none; }}
QHeaderView::section {{ background: transparent; border: none; border-bottom: 1px solid {BORDE}; padding: 6px 8px;
    font-family: '{MONO}', Consolas; font-size: 10px; letter-spacing: 1px; color: {TEXTO_TENUE}; }}
"""

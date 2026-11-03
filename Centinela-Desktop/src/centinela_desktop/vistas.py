"""Las vistas de la consola, programadas en Qt (sin navegador): Inicio, Monitor, Bitácora y Reportes.

Estructura de cada vista (auditoría 2026-10-24, Sessions/Centinela_2026-10-24_auditoria_consola.md):
arriba el estado en pocas cifras, en medio la lista que pide acción, y el detalle solo cuando se pide.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from PySide6.QtCore import QRectF, QSize, Qt, Signal
from PySide6.QtGui import QColor, QFont, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtWidgets import (
    QAbstractItemView, QComboBox, QDialog, QFileDialog, QGridLayout, QHBoxLayout, QHeaderView, QLabel, QLineEdit,
    QMenu, QPushButton, QScrollArea, QSizePolicy, QTableWidget, QTableWidgetItem, QTextEdit, QVBoxLayout, QWidget,
)

from . import tema
from .cliente import ClienteCentinela, ErrorCentinela
from .componentes import CifrasLinea, FranjaCifras, Tarjeta, encabezado, etiqueta_con, fijar_titular, limpiar, rotulo
from .icono import lucide, pixmap_lucide
from .saludo import nombre_corto, saludo
from .tareas import en_segundo_plano

Datos = dict[str, Any]

COLOR_SEVERIDAD = {"alta": "#fca5a5", "media": "#fcd34d", "baja": tema.TEXTO_TENUE}
COLOR_PRIORIDAD = {"critica": "#fca5a5", "alta": tema.NARANJA, "media": "#fcd34d", "baja": tema.TEXTO_TENUE}
NOMBRE_PRIORIDAD = {"critica": "Crítica", "alta": "Alta", "media": "Media", "baja": "Baja"}
ORDEN_PRIORIDAD = {"critica": 0, "alta": 1, "media": 2, "baja": 3}
CATEGORIAS = ("Hardware", "Software", "Seguridad", "Cuenta")
ESTADO_NODO = {"en_linea": ("En línea", tema.VERDE), "desconectado": ("Desconectado", tema.ROJO_ALERTA), "sin_contacto": ("Sin contacto con la Pi", tema.AMBAR)}
PREFIJO_SIMULADO = "[SIMULADO]"  # lib/prototipo/eventos.ts


MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _dt(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone()
    except ValueError:
        return None


def fecha(iso: str | None, formato: str = "%d %b %Y · %H:%M") -> str:
    """Como strftime pero con meses en español (strftime depende del idioma del sistema)."""
    if not iso:
        return "—"
    dt = _dt(iso)
    if dt is None:
        return iso
    return dt.strftime(formato.replace("%b", MESES[dt.month - 1]))


def hace(iso: str | None, ahora: datetime | None = None) -> str:
    """'hace 2 días (22 oct, 19:22)': relativo para leer rápido y con fecha para no confundir días."""
    dt = _dt(iso)
    if dt is None:
        return "nunca" if not iso else str(iso)
    ahora = ahora or datetime.now().astimezone()
    seg = int((ahora - dt).total_seconds())
    if seg < 60:
        rel = "hace un momento"
    elif seg < 3600:
        rel = f"hace {seg // 60} min"
    elif seg < 86400:
        rel = f"hace {seg // 3600} h"
    else:
        dias = seg // 86400
        rel = f"hace {dias} día{'s' if dias != 1 else ''}"
    detalle = dt.strftime("%H:%M") if dt.date() == ahora.date() else f"{dt.day} {MESES[dt.month - 1]}, {dt:%H:%M}"
    return f"{rel} ({detalle})"


# Respuesta a alarmas: mismas reglas que lib/respuesta.ts de la web (roadmap de funciones, 2026-10-24).
META_ACUSE_MIN = {"critica": 5, "alta": 15, "media": 60, "baja": 240}
MOTIVOS_CIERRE = {"real": "Incidente real", "falsa_alarma": "Falsa alarma", "prueba": "Prueba"}


def vencido(r: Datos, ahora: datetime | None = None) -> bool:
    """Pendiente, sin acuse y pasado el plazo de su prioridad."""
    creado = _dt(r.get("createdAt"))
    if r.get("estado") != "pendiente" or r.get("atendidoEn") or creado is None:
        return False
    ahora = ahora or datetime.now().astimezone()
    return (ahora - creado).total_seconds() > META_ACUSE_MIN.get(r.get("prioridad", ""), 60) * 60


def duracion(desde: str | None, hasta: str | None) -> str:
    a, b = _dt(desde), _dt(hasta)
    if a is None or b is None:
        return "—"
    m = max(0, round((b - a).total_seconds() / 60))
    if m < 60:
        return f"{m} min"
    if m < 1440:
        return f"{m // 60} h" + (f" {m % 60} min" if m % 60 else "")
    return f"{m // 1440} d" + (f" {(m % 1440) // 60} h" if (m % 1440) // 60 else "")


def estado_respuesta(r: Datos, ahora: datetime | None = None) -> tuple[str, str]:
    """(texto, color) del punto del ciclo: Pendiente, Vencido, En atención o Resuelto."""
    if r.get("estado") == "resuelto":
        return "Resuelto", tema.VERDE
    if r.get("atendidoEn"):
        return "En atención", tema.AZUL
    if vencido(r, ahora):
        return "Vencido", tema.ROJO_ALERTA
    return "Pendiente", tema.AMBAR


def linea_respuesta(r: Datos) -> str:
    partes = []
    if r.get("atendidoEn"):
        quien = (r.get("atendidoPor") or {}).get("nombre")
        partes.append(f"Atendido{f' por {quien}' if quien else ''} en {duracion(r.get('createdAt'), r['atendidoEn'])}")
    elif r.get("estado") == "pendiente":
        partes.append(f"Sin acuse · {'venció el plazo de' if vencido(r) else 'plazo'} {META_ACUSE_MIN.get(r.get('prioridad', ''), 60)} min")
    if r.get("estado") == "resuelto":
        if r.get("motivoCierre"):
            partes.append(f"Cerrado como {MOTIVOS_CIERRE.get(r['motivoCierre'], r['motivoCierre'])}")
        if r.get("resueltoEn"):
            partes.append(f"resuelto en {duracion(r.get('createdAt'), r['resueltoEn'])}")
    if r.get("escaladoEn") and r.get("estado") != "resuelto":
        partes.append("escalado")
    return " · ".join(partes)


def hoy_largo() -> str:
    d = datetime.now()
    return f"{DIAS[d.weekday()]}, {d.day} de {MESES_LARGOS[d.month - 1]}"


def es_hoy(iso: str | None) -> bool:
    dt = _dt(iso)
    return dt is not None and dt.date() == datetime.now().date()


def dia_legible(iso: str | None) -> str:
    dt = _dt(iso)
    if dt is None:
        return "—"
    hoy = datetime.now().date()
    if dt.date() == hoy:
        return "Hoy"
    if dt.date() == hoy - timedelta(days=1):
        return "Ayer"
    return f"{DIAS[dt.weekday()]} {dt.day} de {MESES_LARGOS[dt.month - 1]}"


def cuando_corto(iso: str | None) -> str:
    """'HOY 19:22', 'AYER 19:22' o '22 OCT 19:22', para listas estrechas."""
    dia = dia_legible(iso)
    return f"{dia.upper()} {fecha(iso, '%H:%M')}" if dia in ("Hoy", "Ayer") else fecha(iso, "%d %b %H:%M").upper()


def rgba(hex_color: str, alfa: float) -> str:
    # Qt lee "#RRGGBBAA" como "#AARRGGBB": la transparencia va siempre con rgba().
    h = hex_color.lstrip("#")
    return f"rgba({int(h[0:2], 16)}, {int(h[2:4], 16)}, {int(h[4:6], 16)}, {alfa})"


def chip_texto(texto: str, color: str) -> QLabel:
    lbl = QLabel(texto.upper())
    lbl.setStyleSheet(
        f"color: {color}; border: 1px solid {rgba(color, 0.35)}; background: {rgba(color, 0.10)}; border-radius: 9px;"
        f" padding: 2px 8px; font-size: 10px; font-weight: 600; font-family: '{tema.MONO}';"
    )
    return lbl


def csv_bitacora(eventos: list[Datos]) -> str:
    """Mismas columnas y comillas que exportarCsv() de la Bitácora web."""
    def celda(v: object) -> str:
        return '"' + str(v).replace('"', '""') + '"'

    filas = [["fecha", "tipo", "nodo", "severidad", "detalle", "id"]]
    filas += [[e.get("ocurridoEn", ""), e.get("tipo", ""), e.get("dispositivoNombre", ""), e.get("severidad", ""),
               e.get("detalle") or "", e.get("id", "")] for e in eventos]
    return "\n".join(",".join(celda(c) for c in f) for f in filas)


def guardar_archivo(padre: QWidget, sugerido: str, datos: bytes) -> str | None:
    """Pregunta dónde guardar y escribe; devuelve la ruta o None si se canceló."""
    ruta, _ = QFileDialog.getSaveFileName(padre, "Guardar CSV", str(Path.home() / "Downloads" / sugerido), "CSV (*.csv)")
    if not ruta:
        return None
    Path(ruta).write_bytes(datos)
    return ruta


def agrupar_rafagas(eventos: list[Datos], ventana_s: int = 300) -> list[list[Datos]]:
    """Junta eventos iguales (tipo, nodo, detalle, severidad) separados por menos de `ventana_s` segundos.

    Una ráfaga de 14 "Movimiento detectado" se lee como una fila; el orden (recientes primero) se respeta.
    """
    grupos: list[list[Datos]] = []
    abiertos: dict[tuple, list[Datos]] = {}
    for e in eventos:
        clave = (e.get("tipo"), e.get("dispositivoNombre"), e.get("detalle"), e.get("severidad"))
        t, g = _dt(e.get("ocurridoEn")), abiertos.get(clave)
        ultimo = _dt(g[-1].get("ocurridoEn")) if g else None
        if g is not None and t and ultimo and t.date() == ultimo.date() and (ultimo - t).total_seconds() <= ventana_s:
            g.append(e)
        else:
            g = [e]
            grupos.append(g)
            abiertos[clave] = g
    return grupos


def por_hora(eventos: list[Datos], ahora: datetime | None = None) -> list[int]:
    """Cuántos eventos hubo en cada una de las últimas 24 horas (el último es la hora en curso)."""
    ahora = (ahora or datetime.now().astimezone()).replace(minute=0, second=0, microsecond=0)
    conteo = [0] * 24
    for e in eventos:
        dt = _dt(e.get("ocurridoEn"))
        if dt is None:
            continue
        horas = int((ahora - dt.replace(minute=0, second=0, microsecond=0)).total_seconds() // 3600)
        if 0 <= horas < 24:
            conteo[23 - horas] += 1
    return conteo


def es_simulado(r: Datos) -> bool:
    return str(r.get("titulo", "")).startswith(PREFIJO_SIMULADO)


def filtrar_reportes(reportes: list[Datos], texto: str = "", estado: str | None = None, prioridad: str | None = None,
                     categoria: str | None = None, asignado: object = None, ocultar_simulados: bool = False) -> list[Datos]:
    """`asignado`: None = todos, "sin" = sin asignar, o el id de un Operador."""
    q = texto.strip().lower()
    return [
        r for r in reportes
        if (estado is None or r.get("estado") == estado)
        and (prioridad is None or r.get("prioridad") == prioridad)
        and (categoria is None or r.get("categoria") == categoria)
        and (asignado is None or (r.get("operadorAsignadoId") is None if asignado == "sin" else r.get("operadorAsignadoId") == asignado))
        and not (ocultar_simulados and es_simulado(r))
        and (not q or q in f"{r.get('titulo', '')} {r.get('descripcion', '')} #{r.get('id', '')}".lower())
    ]


def atencion(reportes: list[Datos], nodos: list[Datos], usuario: Datos) -> list[tuple[str, str, str, str]]:
    """Lo que pide acción ahora, como (título, detalle, color, vista destino); lo más grave primero.

    Admin (ve todo y asigna): críticos/altos sin asignar y los vencidos sin acuse. Operador: lo suyo y lo urgente
    sin dueño. Usuario: sus pendientes.
    """
    permisos = set(usuario.get("permisos", []))
    pendientes = [r for r in reportes if r.get("estado") == "pendiente"]
    if "reportes.ver_todos" in permisos and "reportes.asignar" in permisos:
        elegidos = [r for r in pendientes
                    if (r.get("prioridad") in ("critica", "alta") and not r.get("operadorAsignadoId")) or vencido(r)]
        sufijo = "sin asignar"
    elif usuario.get("role") == "Operador":
        # Lo suyo primero; luego lo urgente que nadie tiene, para que la cola compartida no se quede sin dueño
        elegidos = [r for r in pendientes if r.get("operadorAsignadoId") == usuario.get("id")
                    or (not r.get("operadorAsignadoId") and r.get("prioridad") in ("critica", "alta"))]
        sufijo = ""
    else:
        elegidos, sufijo = pendientes, "pendiente"

    def estado(r: Datos) -> str:
        if sufijo:
            return sufijo
        return "asignado a ti" if r.get("operadorAsignadoId") == usuario.get("id") else "sin asignar"

    elegidos.sort(key=lambda r: (estado(r) != "asignado a ti", ORDEN_PRIORIDAD.get(r.get("prioridad"), 9), -(r.get("id") or 0)))
    filas = [(f"{NOMBRE_PRIORIDAD.get(r.get('prioridad'), '')} · {r.get('titulo', '')}",
              f"#{r.get('id')} · {'vencido sin acuse' if vencido(r) else estado(r)} · {hace(r.get('createdAt'))}",
              tema.ROJO_ALERTA if vencido(r) else COLOR_PRIORIDAD.get(r.get("prioridad"), tema.TEXTO_TENUE), "reportes")
             for r in elegidos]
    caidos = [n for n in nodos if n.get("estado") != "en_linea"]
    filas = [(f"Nodo {n.get('nombre') or n.get('uid', '')} sin conexión",
              f"Último contacto {hace(n.get('ultimoContacto'))}", tema.AMBAR, "monitor") for n in caidos] + filas
    return filas


class Vista(QScrollArea):
    """Base: área con scroll y una columna con márgenes como los de la web."""

    ir = Signal(str)

    def __init__(self) -> None:
        super().__init__()
        self.setWidgetResizable(True)
        self.setFrameShape(QScrollArea.Shape.NoFrame)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)  # la columna se ajusta al ancho, nunca se desplaza de lado
        raiz = QWidget()
        raiz.setObjectName("raiz")
        self.col = QVBoxLayout(raiz)
        self.col.setContentsMargins(40, 28, 40, 28)
        self.col.setSpacing(16)
        self.setWidget(raiz)

    def al_mostrar(self) -> None:
        """Se llama cada vez que la vista pasa al frente."""

    def en_vivo(self, nodos: list[Datos], eventos: list[Datos]) -> None:
        """Se llama con cada cambio del stream."""


def fila_clicable(titulo: str, detalle: str, color: str, al_click: Callable[[], None]) -> QPushButton:
    """Fila de lista con un punto de color, título y detalle; toda la fila es el botón."""
    b = QPushButton()
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    b.setStyleSheet(
        f"QPushButton {{ background: transparent; border: none; border-bottom: 1px solid {tema.BORDE}; border-radius: 0;"
        f" text-align: left; padding: 0; }} QPushButton:hover {{ background: rgba(255,255,255,0.04); }}"
    )
    h = QHBoxLayout(b)
    h.setContentsMargins(4, 9, 4, 9)
    punto = QLabel("●")
    punto.setStyleSheet(f"color: {color}; background: transparent; font-size: 10px;")
    punto.setFixedWidth(14)
    textos = QVBoxLayout()
    textos.setSpacing(1)
    t = QLabel(titulo)
    t.setStyleSheet("background: transparent; font-weight: 500;")
    d = QLabel(detalle)
    d.setStyleSheet(f"background: transparent; color: {tema.TEXTO_TENUE}; font-size: 12px;")
    textos.addWidget(t)
    textos.addWidget(d)
    flecha = QLabel()
    flecha.setPixmap(pixmap_lucide("arrow-right", tema.TEXTO_TENUE, 14))
    flecha.setStyleSheet("background: transparent;")
    for w in (punto, t, d, flecha):
        w.setAttribute(Qt.WidgetAttribute.WA_TransparentForMouseEvents)
    h.addWidget(punto, 0, Qt.AlignmentFlag.AlignTop)
    h.addLayout(textos, 1)
    h.addWidget(flecha)
    b.setMinimumHeight(h.sizeHint().height())  # el sizeHint de un QPushButton no cuenta su layout
    b.clicked.connect(al_click)
    return b


class BarrasHora(QWidget):
    """Actividad de las últimas 24 h: una barra por hora, la hora en curso a la derecha."""

    def __init__(self) -> None:
        super().__init__()
        self.conteo = [0] * 24
        self.setFixedHeight(70)

    def fijar(self, conteo: list[int]) -> None:
        self.conteo = conteo
        self.update()

    def paintEvent(self, _e) -> None:  # noqa: N802 — nombre de Qt
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        alto, maximo = self.height() - 16, max(self.conteo) or 1
        ancho = self.width() / 24
        p.setPen(Qt.PenStyle.NoPen)
        for i, n in enumerate(self.conteo):
            h = max(2.0, alto * n / maximo) if n else 2.0
            p.setBrush(QColor(tema.AMBAR) if n else QColor(tema.BORDE))
            p.drawRoundedRect(QRectF(i * ancho + 1.5, alto - h, ancho - 3, h), 2, 2)
        fuente = QFont(tema.MONO)
        fuente.setPixelSize(10)
        p.setFont(fuente)
        p.setPen(QColor(tema.TEXTO_TENUE))
        p.drawText(QRectF(0, alto + 2, self.width(), 14), Qt.AlignmentFlag.AlignLeft, "hace 24 h")
        p.drawText(QRectF(0, alto + 2, self.width(), 14), Qt.AlignmentFlag.AlignRight, "ahora")
        if not any(self.conteo):
            p.drawText(QRectF(0, 0, self.width(), alto - 8), Qt.AlignmentFlag.AlignCenter, "Sin actividad en las últimas 24 h")
        p.end()


def barras(titulo: str, datos: list[tuple[str, int, str]]) -> QWidget:
    """Barras horizontales sin pintar a mano: el largo sale del stretch de cada lado."""
    caja = QWidget()
    col = QVBoxLayout(caja)
    col.setContentsMargins(0, 0, 0, 0)
    col.setSpacing(6)
    col.addWidget(rotulo(titulo))
    maximo = max((n for _, n, _ in datos), default=0) or 1
    for nombre, n, color in datos:
        fila = QHBoxLayout()
        etq = QLabel(nombre)
        etq.setFixedWidth(100)
        etq.setStyleSheet(f"color: {tema.TEXTO_SUAVE}; font-size: 13px;")
        barra = QWidget()
        barra.setFixedHeight(10)
        barra.setStyleSheet(f"background: {color if n else tema.BORDE}; border-radius: 3px;")
        pista = QHBoxLayout()
        pista.setSpacing(0)
        if n:
            pista.addWidget(barra, n)
            pista.addStretch(maximo - n)
        else:
            barra.setFixedWidth(4)
            pista.addWidget(barra)
            pista.addStretch(1)
        cifra = etiqueta_con("mono", str(n))
        cifra.setFixedWidth(28)
        cifra.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        fila.addWidget(etq)
        fila.addLayout(pista, 1)
        fila.addWidget(cifra)
        col.addLayout(fila)
    return caja


# ---------------------------------------------------------------- Inicio
class VistaInicio(Vista):
    """Centro de mando: ¿está todo bien y qué necesita mi atención?"""

    def __init__(self, cliente: ClienteCentinela, usuario: Datos) -> None:
        super().__init__()
        self.cliente = cliente
        self.usuario = usuario
        permisos = set(usuario.get("permisos", []))
        self.ve_nodos = any(p.startswith("dispositivos.") for p in permisos)
        self.ve_todos = "reportes.ver_todos" in permisos
        self.reportes: list[Datos] | None = None
        self.eventos: list[Datos] = []
        self.nodos: list[Datos] = []

        cabeza, self.tit, self.baj = encabezado("Hola")
        self.col.addWidget(cabeza)

        # Banda de estado: una frase con lo más importante y a dónde ir a resolverlo.
        self.banda = Tarjeta()
        fila = QHBoxLayout()
        self.banda_icono = QLabel()
        self.banda_texto = QLabel()
        self.banda_texto.setStyleSheet("font-size: 15px; font-weight: 600;")
        self.banda_texto.setWordWrap(True)
        self.banda_boton = QPushButton()
        self.banda_destino = "inicio"
        self.banda_boton.clicked.connect(lambda: self.ir.emit(self.banda_destino))
        fila.addWidget(self.banda_icono)
        fila.addWidget(self.banda_texto, 1)
        fila.addWidget(self.banda_boton)
        self.banda.cuerpo.addLayout(fila)
        self.col.addWidget(self.banda)

        if self.ve_nodos:
            tercera = "Altas sin asignar" if self.ve_todos else "Asignados a ti" if usuario.get("role") == "Operador" else "Tus pendientes"
            self.cifras = FranjaCifras(["Nodos en línea", "Reportes pendientes", tercera, "Alertas altas hoy"])
        else:
            self.cifras = FranjaCifras(["Reportes pendientes", "Resueltos", "Reportes en total"])
        self.col.addWidget(self.cifras)

        columnas = QHBoxLayout()
        columnas.setSpacing(16)
        izq = Tarjeta()
        izq.cuerpo.addWidget(rotulo("Requiere atención"))
        self.lista_atencion = QVBoxLayout()
        self.lista_atencion.setSpacing(0)
        izq.cuerpo.addLayout(self.lista_atencion)
        izq.cuerpo.addStretch()
        columnas.addWidget(izq, 3)

        der = QVBoxLayout()
        der.setSpacing(16)
        visita = Tarjeta()
        visita.cuerpo.addWidget(rotulo("Desde tu última visita"))
        self.texto_visita = etiqueta_con("", "", ajustar=True)
        self.texto_visita.setTextFormat(Qt.TextFormat.RichText)
        visita.cuerpo.addWidget(self.texto_visita)
        der.addWidget(visita)
        if self.ve_nodos:
            actividad = Tarjeta()
            actividad.cuerpo.addWidget(rotulo("Actividad de los nodos · 24 h"))
            self.barras_hora = BarrasHora()
            actividad.cuerpo.addWidget(self.barras_hora)
            der.addWidget(actividad)
            ultimos = Tarjeta()
            ultimos.cuerpo.addWidget(rotulo("Últimos eventos"))
            self.lista_eventos = QVBoxLayout()
            self.lista_eventos.setSpacing(6)
            ultimos.cuerpo.addLayout(self.lista_eventos)
            der.addWidget(ultimos)
        der.addStretch()
        columnas.addLayout(der, 2)
        self.col.addLayout(columnas)
        self.col.addStretch()

        nombre = nombre_corto(usuario.get("nombre", ""), usuario.get("apellido", "")) or usuario.get("username") or ""
        ahora = datetime.now()
        fijar_titular(self.tit, saludo(ahora.hour, nombre, ahora.toordinal()))
        anterior = usuario.get("ultimoLoginAnterior")
        self.baj.setText(f"{hoy_largo().capitalize()} · " + (f"Tu visita anterior: {hace(anterior)}" if anterior else "Es tu primera visita: bienvenido a Centinela."))
        self._pintar()

    def al_mostrar(self) -> None:
        en_segundo_plano(self.cliente.reportes, self._con_reportes)
        if self.ve_nodos:
            en_segundo_plano(lambda: self.cliente.eventos(200), self._con_eventos)

    def _con_reportes(self, valor: object) -> None:
        if not isinstance(valor, ErrorCentinela):
            self.reportes = list(valor)  # type: ignore[arg-type]
            self._pintar()

    def _con_eventos(self, valor: object) -> None:
        if not isinstance(valor, ErrorCentinela):
            self.eventos = list(valor)  # type: ignore[arg-type]
            self._pintar()

    def en_vivo(self, nodos: list[Datos], eventos: list[Datos]) -> None:
        self.nodos = nodos
        vistos = {e["id"] for e in self.eventos}
        self.eventos = [e for e in eventos if e["id"] not in vistos] + self.eventos
        self._pintar()

    def _fijar_banda(self, texto: str, color: str, icono: str, boton: str = "", destino: str = "inicio") -> None:
        self.banda.setStyleSheet(f"QFrame#tarjeta {{ border-left: 3px solid {color}; }}")
        self.banda_icono.setPixmap(pixmap_lucide(icono, color, 20))
        self.banda_texto.setText(texto)
        self.banda_boton.setText(boton)
        self.banda_boton.setVisible(bool(boton))
        self.banda_destino = destino

    def _pintar(self) -> None:
        reportes = self.reportes or []
        pendientes = [r for r in reportes if r.get("estado") == "pendiente"]
        criticos = [r for r in pendientes if r.get("prioridad") == "critica"]
        en_linea = sum(1 for n in self.nodos if n.get("estado") == "en_linea")
        total = len(self.nodos)
        altas_hoy = sum(1 for e in self.eventos if es_hoy(e.get("ocurridoEn")) and e.get("severidad") == "alta")
        filas = atencion(reportes, self.nodos if self.ve_nodos else [], self.usuario)

        if self.reportes is not None:
            if self.ve_nodos:
                propios = sum(1 for f in filas if f[3] == "reportes")
                self.cifras.fijar(1, len(pendientes), "senal" if pendientes else "normal")
                self.cifras.fijar(2, propios, ("alerta" if self.ve_todos else "senal") if propios else "normal")
            else:
                self.cifras.fijar(0, len(pendientes), "senal" if pendientes else "normal")
                self.cifras.fijar(1, len(reportes) - len(pendientes), "ok")
                self.cifras.fijar(2, len(reportes))
        if self.ve_nodos:
            self.cifras.fijar(0, f"{en_linea}/{total}", "ok" if total and en_linea == total else "senal")
            self.cifras.fijar(3, altas_hoy, "alerta" if altas_hoy else "normal")

        def plural(n: int, palabra: str) -> str:
            return f"{n} {palabra}" + ("" if n == 1 else "s" if palabra[-1] in "aeiou" else "es")

        # Lo más grave primero: alertas de hoy, nodos que no vigilan, incidencias críticas.
        if self.ve_nodos and altas_hoy:
            self._fijar_banda(f"{plural(altas_hoy, 'alerta')} alta{'s' if altas_hoy != 1 else ''} hoy.",
                              tema.CARMESI_TEXTO, "triangle-alert", "Ver Bitácora", "bitacora")
        elif self.ve_nodos and total == 0:
            self._fijar_banda("Aún no hay nodos vinculados: Centinela todavía no vigila nada.", tema.AMBAR, "router",
                              "Vincular una Pi", "dispositivos")
        elif self.ve_nodos and en_linea < total:
            caidos = [n for n in self.nodos if n.get("estado") != "en_linea"]
            ultimo = max((n.get("ultimoContacto") or "" for n in caidos), default="")
            self._fijar_banda(f"{len(caidos)} de {total} nodos sin conexión · último contacto {hace(ultimo or None)}",
                              tema.AMBAR, "wifi", "Ver Monitor", "monitor")
        elif criticos:
            self._fijar_banda(f"{plural(len(criticos), 'reporte')} crítico{'s' if len(criticos) != 1 else ''} pendiente{'s' if len(criticos) != 1 else ''}.",
                              tema.CARMESI_TEXTO, "triangle-alert", "Ver reportes", "reportes")
        elif self.ve_nodos:
            self._fijar_banda(f"Todo en calma: {en_linea} de {total} nodos en línea y ninguna alerta alta hoy.",
                              tema.VERDE, "shield-check")
        else:
            n = len(pendientes)
            self._fijar_banda(f"Tienes {plural(n, 'reporte')} pendiente{'s' if n != 1 else ''}." if n else "Sin reportes pendientes por ahora.",
                              tema.AMBAR if n else tema.VERDE, "file-text" if n else "shield-check",
                              "Ver reportes" if n else "", "reportes")

        limpiar(self.lista_atencion)
        for titulo, detalle, color, destino in filas[:6]:
            self.lista_atencion.addWidget(fila_clicable(titulo, detalle, color, lambda d=destino: self.ir.emit(d)))
        if len(filas) > 6:
            mas = QPushButton(f"y {len(filas) - 6} más en Reportes")
            mas.setObjectName("enlace")
            mas.clicked.connect(lambda: self.ir.emit("reportes"))
            self.lista_atencion.addWidget(mas)
        if not filas:
            self.lista_atencion.addWidget(etiqueta_con("suave", "Nada pendiente de tu lado." if self.reportes is not None else "Cargando…"))

        anterior = _dt(self.usuario.get("ultimoLoginAnterior"))
        if anterior is None:
            self.texto_visita.setText("Es tu primera visita.")
        else:
            cifra = f'<span style="font-family:{tema.MONO};font-size:17px">{{}}</span>&nbsp; {{}}'
            nuevos = sum(1 for r in reportes if (d := _dt(r.get("createdAt"))) and d > anterior)
            lineas = [cifra.format(nuevos, "reporte nuevo" if nuevos == 1 else "reportes nuevos")]
            if self.ve_nodos:
                ev = sum(1 for e in self.eventos if (d := _dt(e.get("ocurridoEn"))) and d > anterior)
                lineas.append(cifra.format(ev, "evento de los nodos" if ev == 1 else "eventos de los nodos"))
            self.texto_visita.setText("<br>".join(lineas))

        if self.ve_nodos:
            self.barras_hora.fijar(por_hora(self.eventos))
            limpiar(self.lista_eventos)
            for e in self.eventos[:5]:
                fila = QLabel(
                    f'<span style="font-family:{tema.MONO};font-size:11px;color:{COLOR_SEVERIDAD.get(e.get("severidad"), tema.TEXTO_TENUE)}">'
                    f'{cuando_corto(e.get("ocurridoEn"))} · {str(e.get("tipo", "")).upper()}</span><br>'
                    f'{e.get("dispositivoNombre", "")}{": " + e["detalle"] if e.get("detalle") else ""}'
                )
                fila.setTextFormat(Qt.TextFormat.RichText)
                self.lista_eventos.addWidget(fila)
            if not self.eventos:
                self.lista_eventos.addWidget(etiqueta_con("tenue", "Los nodos todavía no reportan eventos."))


# ---------------------------------------------------------------- Monitor
def telemetria_legible(tele: Datos) -> list[str]:
    """Las cifras de abajo del recuadro, con el mismo formato que la web."""
    partes = []
    if (t := tele.get("temp_c")) is not None:
        partes.append(f"{t} °C")
    if (r := tele.get("rssi_dbm")) is not None:
        partes.append(f"{r} dBm")
    if (u := tele.get("uptime_s")) is not None:
        m, s = divmod(int(u), 60)
        partes.append(f"{m} min {s} s")
    return partes


class CuadroCamara(QWidget):
    """Recuadro 16:9 como el del Monitor web: rayas, estado, nombre, "sin cámara" y telemetría."""

    def __init__(self, nodo: Datos) -> None:
        super().__init__()
        self.nodo = nodo
        self.setMinimumHeight(180)
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.icono = pixmap_lucide("video-off", tema.TEXTO_TENUE, 18)

    def sizeHint(self) -> QSize:  # noqa: N802 — nombre de Qt
        return QSize(420, 220)

    def resizeEvent(self, e) -> None:  # noqa: N802
        self.setFixedHeight(max(180, self.width() * 9 // 16))
        super().resizeEvent(e)

    def paintEvent(self, _e) -> None:  # noqa: N802
        texto_estado, color = ESTADO_NODO.get(self.nodo.get("estado", ""), ("—", tema.TEXTO_TENUE))
        en_linea = self.nodo.get("estado") == "en_linea"
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = QRectF(self.rect()).adjusted(0.5, 0.5, -0.5, -0.5)
        camino = QPainterPath()
        camino.addRoundedRect(r, 16, 16)
        p.fillPath(camino, QColor("#0a0d12"))
        p.save()
        p.setClipPath(camino)
        p.setPen(QPen(QColor(255, 255, 255, 13), 2))
        for x in range(-self.height(), self.width(), 26):  # rayas inclinadas como el repeating-linear-gradient de la web
            p.drawLine(x, self.height(), x + int(self.height() * 0.47), 0)
        p.restore()
        p.setPen(QPen(QColor(tema.BORDE) if en_linea else QColor(242, 184, 75, 100), 1))
        p.drawPath(camino)

        # estado (arriba a la izquierda)
        fuente = QFont(tema.MONO)
        fuente.setPixelSize(10)
        fuente.setWeight(QFont.Weight.DemiBold)
        p.setFont(fuente)
        etq = texto_estado.upper()
        chip = QRectF(12, 12, p.fontMetrics().horizontalAdvance(etq) + 20, 22)
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(color))
        p.drawRoundedRect(chip, 6, 6)
        p.setPen(QColor("#0a0d12"))
        p.drawText(chip, Qt.AlignmentFlag.AlignCenter, etq)

        # nombre y Pi (arriba a la derecha)
        p.setPen(QColor(tema.TEXTO_SUAVE))
        p.drawText(QRectF(0, 12, self.width() - 14, 30), Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignTop,
                   f"{self.nodo.get('nombre') or self.nodo.get('uid', '')}\nvía {self.nodo.get('gatewayNombre') or 'sin Pi'}")

        # sin cámara (centro)
        centro = self.rect().center()
        p.drawPixmap(centro.x() - 9, centro.y() - 22, self.icono)
        p.setPen(QColor(tema.TEXTO_TENUE))
        p.drawText(QRectF(0, centro.y() + 2, self.width(), 18), Qt.AlignmentFlag.AlignCenter, "SIN CÁMARA CONECTADA")

        # telemetría (abajo); si el nodo está caído es el último valor conocido, no algo en vivo
        partes = telemetria_legible(self.nodo.get("telemetria") or {})
        if partes and not en_linea:
            p.drawText(QRectF(12, self.height() - 48, self.width() - 24, 14), Qt.AlignmentFlag.AlignLeft, "ÚLTIMO VALOR")
        p.setPen(QColor(tema.TEXTO if en_linea else tema.TEXTO_TENUE))
        if partes:
            tramo = (self.width() - 24) / len(partes)
            for i, t in enumerate(partes):
                alin = (Qt.AlignmentFlag.AlignLeft if i == 0 else
                        Qt.AlignmentFlag.AlignRight if i == len(partes) - 1 else Qt.AlignmentFlag.AlignHCenter)
                p.drawText(QRectF(12 + i * tramo, self.height() - 30, tramo, 18), alin | Qt.AlignmentFlag.AlignVCenter, t)
        p.end()


class TarjetaNodo(Tarjeta):
    def __init__(self, nodo: Datos, eventos: list[Datos], mandar: Callable[[int, Datos, QLabel], None]) -> None:
        super().__init__()
        self.setMinimumWidth(320)
        self.cuerpo.addWidget(CuadroCamara(nodo))
        self.cuerpo.addWidget(etiqueta_con("tenue", f"Último contacto {hace(nodo.get('ultimoContacto'))}"))

        for e in [e for e in eventos if e.get("dispositivoId") == nodo.get("id")][:3]:
            fila = QLabel(
                f'<span style="font-family:{tema.MONO};font-size:11px;color:{COLOR_SEVERIDAD.get(e.get("severidad"), tema.TEXTO_TENUE)}">'
                f'{fecha(e.get("ocurridoEn"), "%d %b %H:%M")} · {str(e.get("tipo", "")).upper()}</span>'
                f'&nbsp; <span style="color:{tema.TEXTO_SUAVE}">{e.get("detalle") or ""}</span>'
            )
            fila.setTextFormat(Qt.TextFormat.RichText)
            self.cuerpo.addWidget(fila)

        if nodo.get("estado") != "en_linea":
            self.cuerpo.addWidget(etiqueta_con("tenue", "Sin conexión: comandos no disponibles."))
            return
        resultado = etiqueta_con("tenue", "")
        botones = QHBoxLayout()
        for texto_b, cmd in (
            ("LED on", {"tipo": "system", "payload": {"accion": "led", "encendido": True}}),
            ("LED off", {"tipo": "system", "payload": {"accion": "led", "encendido": False}}),
            ("Ping", {"tipo": "system", "payload": {"accion": "ping"}}),
            ("Pan/tilt a casa", {"tipo": "pantilt", "payload": {"mode": "home", "pan_deg": 0, "tilt_deg": 0}}),
        ):
            b = QPushButton(texto_b)
            b.clicked.connect(lambda _=False, c=cmd: mandar(int(nodo["id"]), c, resultado))
            botones.addWidget(b)
        self.cuerpo.addLayout(botones)
        self.cuerpo.addWidget(resultado)


class VistaMonitor(Vista):
    def __init__(self, cliente: ClienteCentinela) -> None:
        super().__init__()
        self.cliente = cliente
        cabeza, _, _ = encabezado("Monitor en vivo", "Nodos reportados por tus Raspberry Pi, en tiempo real.")
        self.cifras = CifrasLinea(["en línea", "eventos recientes", "alertas altas"])
        cabeza.acciones.addWidget(self.cifras)
        self.col.addWidget(cabeza)
        self.rejilla = QGridLayout()
        self.rejilla.setSpacing(14)
        self.col.addLayout(self.rejilla)
        self.vacio = etiqueta_con("suave", "Esperando los nodos…")
        self.col.addWidget(self.vacio)
        self.col.addStretch()
        self._firma = None

    def en_vivo(self, nodos: list[Datos], eventos: list[Datos]) -> None:
        en_linea = sum(1 for n in nodos if n.get("estado") == "en_linea")
        altas = sum(1 for e in eventos if e.get("severidad") == "alta")
        self.cifras.fijar(0, f"{en_linea}/{len(nodos)}", "ok" if nodos and en_linea == len(nodos) else "senal")
        self.cifras.fijar(1, len(eventos))
        self.cifras.fijar(2, altas, "alerta" if altas else "normal")
        # Repintar solo si cambió algo visible (el snapshot llega cada 5 s).
        firma = (tuple((n.get("id"), n.get("estado"), str(n.get("telemetria")), n.get("ultimoContacto")) for n in nodos),
                 eventos[0].get("id") if eventos else None)
        if firma == self._firma:
            return
        self._firma = firma
        limpiar(self.rejilla)
        for i, n in enumerate(nodos):
            self.rejilla.addWidget(TarjetaNodo(n, eventos, self._mandar), i // 2, i % 2)
        self.vacio.setVisible(not nodos)
        self.vacio.setText("Todavía no hay nodos vinculados a tus Raspberry Pi." if not nodos else "")

    def _mandar(self, nodo_id: int, comando: Datos, resultado: QLabel) -> None:
        resultado.setText("Enviando…")

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                resultado.setText(f"✗ {valor}")
            elif valor.get("estado") == "ok":  # type: ignore[union-attr]
                resultado.setText(f"✓ Listo en {valor.get('latenciaMs', '?')} ms")  # type: ignore[union-attr]
            else:
                resultado.setText(f"✗ {valor.get('error') or 'El nodo no respondió'}")  # type: ignore[union-attr]

        en_segundo_plano(lambda: self.cliente.comando(nodo_id, comando), listo)


# ---------------------------------------------------------------- Bitácora
ANCHOS_BITACORA = (110, 110, 170)  # hora, tipo, nodo


class VistaBitacora(Vista):
    FILTROS = (("Todos", None), ("Críticos", "alta"), ("Advertencias", "media"))

    def __init__(self, cliente: ClienteCentinela) -> None:
        super().__init__()
        self.cliente = cliente
        self.eventos: list[Datos] = []
        self.filtro: str | None = None
        cabeza, _, _ = encabezado("Bitácora de incidentes",
                                  "Lo que reportan tus nodos: conexiones, alarmas y fallas de hardware.")
        self.cifras = CifrasLinea(["eventos", "alertas altas"])
        cabeza.acciones.addWidget(self.cifras)
        cabeza.acciones.addSpacing(8)
        exportar = QPushButton("Exportar CSV")
        exportar.clicked.connect(self._exportar)
        cabeza.acciones.addWidget(exportar)
        self.col.addWidget(cabeza)

        panel = Tarjeta()
        fila = QHBoxLayout()
        self.busqueda = QLineEdit()
        self.busqueda.setPlaceholderText("Filtrar por nodo, tipo o detalle…")
        self.busqueda.textChanged.connect(self._pintar)
        fila.addWidget(self.busqueda, 1)
        self.chips: list[QPushButton] = []
        for nombre, sev in self.FILTROS:
            chip = QPushButton(nombre)
            chip.setObjectName("chip")
            chip.setCheckable(True)
            chip.setChecked(sev is None)
            chip.clicked.connect(lambda _=False, s=sev, c=chip: self._filtrar(s, c))
            self.chips.append(chip)
            fila.addWidget(chip)
        panel.cuerpo.addLayout(fila)

        cab = QHBoxLayout()
        cab.setContentsMargins(4, 8, 4, 0)
        for texto, ancho in zip(("HORA", "TIPO", "NODO"), ANCHOS_BITACORA):
            columna = etiqueta_con("grupo", texto)
            columna.setStyleSheet("padding-left: 0;")
            columna.setFixedWidth(ancho)
            cab.addWidget(columna)
        cab.addWidget(etiqueta_con("grupo", "DETALLE"), 1)
        cab.addWidget(etiqueta_con("grupo", "SEVERIDAD"))
        panel.cuerpo.addLayout(cab)

        self.visibles: list[Datos] = []
        self.lista = QVBoxLayout()
        self.lista.setSpacing(0)
        panel.cuerpo.addLayout(self.lista)
        self.col.addWidget(panel)
        self.col.addStretch()

    def _exportar(self) -> None:
        # Lo que se ve con el filtro y la búsqueda actuales (cada evento, sin agrupar)
        guardar_archivo(self, f"bitacora-{datetime.now():%Y-%m-%d}.csv", csv_bitacora(self.visibles).encode("utf-8-sig"))

    def _filtrar(self, severidad: str | None, chip: QPushButton) -> None:
        self.filtro = severidad
        for c in self.chips:
            c.setChecked(c is chip)
        self._pintar()

    def al_mostrar(self) -> None:
        en_segundo_plano(lambda: self.cliente.eventos(200), self._con_eventos)

    def _con_eventos(self, valor: object) -> None:
        if isinstance(valor, ErrorCentinela):
            limpiar(self.lista)
            self.lista.addWidget(etiqueta_con("error", str(valor)))
            return
        self.eventos = list(valor)  # type: ignore[arg-type]
        self._pintar()

    def en_vivo(self, nodos: list[Datos], eventos: list[Datos]) -> None:
        vistos = {e["id"] for e in self.eventos}
        nuevos = [e for e in eventos if e["id"] not in vistos]
        if nuevos:
            self.eventos = nuevos + self.eventos
            self._pintar()

    @staticmethod
    def _fila(e: Datos, hora: str, n: int = 1, hijo: bool = False) -> QWidget:
        fila = QWidget()
        fila.setStyleSheet(f"border-bottom: 1px solid {tema.BORDE};")
        h = QHBoxLayout(fila)
        h.setContentsMargins(4, 9, 4, 9)
        cuando = etiqueta_con("mono", ("   " if hijo else "") + hora)
        cuando.setStyleSheet(f"color: {tema.TEXTO_TENUE}; border: none;")
        tipo = QLabel(str(e.get("tipo", "")).upper())
        tipo.setStyleSheet(f"border: none; font-size: 11px; color: {COLOR_SEVERIDAD.get(e.get('severidad'), tema.TEXTO_SUAVE)};")
        nodo = etiqueta_con("mono", e.get("dispositivoNombre", ""))
        nodo.setStyleSheet(f"border: none; color: {tema.TEXTO_SUAVE};")
        for w, ancho in zip((cuando, tipo, nodo), ANCHOS_BITACORA):
            w.setFixedWidth(ancho)
            h.addWidget(w)
        detalle = QLabel(e.get("detalle") or "—")
        detalle.setStyleSheet(f"border: none; color: {tema.TEXTO_SUAVE if hijo else tema.TEXTO};")
        h.addWidget(detalle, 1)
        if n > 1:
            h.addWidget(chip_texto(f"×{n}", tema.AMBAR))
        h.addWidget(chip_texto(str(e.get("severidad", "")), COLOR_SEVERIDAD.get(e.get("severidad"), tema.TEXTO_TENUE)))
        return fila

    def _pintar(self) -> None:
        q = self.busqueda.text().strip().lower()
        visibles = [
            e for e in self.eventos
            if (self.filtro is None or e.get("severidad") == self.filtro)
            and (not q or q in f"{e.get('dispositivoNombre', '')} {e.get('tipo', '')} {e.get('detalle', '')}".lower())
        ]
        self.visibles = visibles
        self.cifras.fijar(0, len(self.eventos))
        altas = sum(1 for e in self.eventos if e.get("severidad") == "alta")
        self.cifras.fijar(1, altas, "alerta" if altas else "normal")
        limpiar(self.lista)
        dia_actual = None
        for grupo in agrupar_rafagas(visibles[:300])[:150]:
            e = grupo[0]
            dia = dia_legible(e.get("ocurridoEn"))
            if dia != dia_actual:
                dia_actual = dia
                sep = rotulo(dia)
                sep.setContentsMargins(4, 14, 0, 4)
                self.lista.addWidget(sep)
            if len(grupo) == 1:
                self.lista.addWidget(self._fila(e, fecha(e.get("ocurridoEn"), "%H:%M:%S")))
                continue
            # Ráfaga: una fila "×N · desde–hasta" que se despliega con cada evento
            fila = self._fila(e, f"{fecha(grupo[-1].get('ocurridoEn'), '%H:%M')}–{fecha(e.get('ocurridoEn'), '%H:%M')}", len(grupo))
            caja = QWidget()
            col = QVBoxLayout(caja)
            col.setContentsMargins(0, 0, 0, 0)
            col.setSpacing(0)
            for hijo in grupo:
                col.addWidget(self._fila(hijo, fecha(hijo.get("ocurridoEn"), "%H:%M:%S"), hijo=True))
            caja.setVisible(False)
            boton = QPushButton()
            boton.setObjectName("enlace")
            boton.setIcon(lucide("chevron-right", tema.TEXTO_SUAVE, 14))
            boton.setToolTip("Ver cada evento")
            boton.setCursor(Qt.CursorShape.PointingHandCursor)

            def alternar(_: bool = False, caja: QWidget = caja, boton: QPushButton = boton) -> None:
                caja.setVisible(caja.isHidden())
                boton.setIcon(lucide("chevron-right" if caja.isHidden() else "chevron-down", tema.TEXTO_SUAVE, 14))

            boton.clicked.connect(alternar)
            fila.layout().addWidget(boton)
            self.lista.addWidget(fila)
            self.lista.addWidget(caja)
        if not visibles:
            self.lista.addWidget(etiqueta_con("suave", "Ningún evento coincide." if self.eventos else "Todavía no hay eventos."))


# ---------------------------------------------------------------- Reportes
class DialogoReporte(QDialog):
    """Nuevo reporte: se abre con un botón en vez de ocupar la pantalla todo el tiempo."""

    def __init__(self, padre: QWidget, cliente: ClienteCentinela) -> None:
        super().__init__(padre)
        self.cliente = cliente
        self.setWindowTitle("Nuevo reporte")
        self.setMinimumWidth(560)
        col = QVBoxLayout(self)
        col.setContentsMargins(24, 22, 24, 22)
        col.setSpacing(10)
        col.addWidget(rotulo("Nuevo reporte"))
        self.titulo = QLineEdit()
        self.titulo.setPlaceholderText("Título")
        self.descripcion = QTextEdit()
        self.descripcion.setPlaceholderText("Qué pasó, dónde y cuándo")
        self.descripcion.setFixedHeight(120)
        fila = QHBoxLayout()
        self.prioridad = QComboBox()
        for clave in ("media", "baja", "alta", "critica"):
            self.prioridad.addItem(NOMBRE_PRIORIDAD[clave], clave)
        self.categoria = QComboBox()
        self.categoria.addItem("Sin categoría", None)
        for c in CATEGORIAS:
            self.categoria.addItem(c, c)
        fila.addWidget(self.prioridad)
        fila.addWidget(self.categoria)
        fila.addStretch()
        self.aviso = etiqueta_con("tenue", "", ajustar=True)
        pie = QHBoxLayout()
        pie.addWidget(self.aviso, 1)
        cancelar = QPushButton("Cancelar")
        cancelar.clicked.connect(self.reject)
        self.boton = QPushButton("Crear reporte")
        self.boton.setObjectName("primario")
        self.boton.clicked.connect(self._crear)
        pie.addWidget(cancelar)
        pie.addWidget(self.boton)
        for w in (self.titulo, self.descripcion):
            col.addWidget(w)
        col.addLayout(fila)
        col.addLayout(pie)

    def _crear(self) -> None:
        titulo, desc = self.titulo.text().strip(), self.descripcion.toPlainText().strip()
        if not titulo or not desc:
            self.aviso.setStyleSheet(f"color: {tema.ROJO_ALERTA};")
            self.aviso.setText("Escribe un título y una descripción.")
            return
        self.boton.setEnabled(False)
        self.aviso.setStyleSheet("")
        self.aviso.setText("Enviando…")

        def listo(valor: object) -> None:
            self.boton.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                self.aviso.setStyleSheet(f"color: {tema.ROJO_ALERTA};")
                self.aviso.setText(str(valor))
                return
            self.accept()

        prioridad, categoria = self.prioridad.currentData(), self.categoria.currentData()
        en_segundo_plano(lambda: self.cliente.crear_reporte(titulo, desc, prioridad, categoria), listo)


# El historial guarda la asignación con el nombre del Operador (app/api/reportes/[id]/route.ts)
CAMPOS_HISTORIAL = {"estado": "Estado", "prioridad": "Prioridad", "categoria": "Categoría", "operadorAsignado": "Asignación"}


class DetalleReporte(Tarjeta):
    """Panel a la derecha de la tabla: el reporte elegido, sus acciones, comentarios e historial."""

    def __init__(self, vista: "VistaReportes") -> None:
        super().__init__()
        self.vista = vista
        self.actual: int | None = None
        self.setFixedWidth(400)
        self.contenido = QVBoxLayout()
        self.contenido.setSpacing(10)
        self.cuerpo.addLayout(self.contenido)
        self.cuerpo.addStretch()
        self.vacio()

    def vacio(self) -> None:
        # Sin reporte elegido el panel no ocupa lugar: la tabla usa todo el ancho
        self.actual = None
        limpiar(self.contenido)
        self.setVisible(False)
        self._columnas(True)

    def _columnas(self, todas: bool) -> None:
        # Con el detalle abierto, categoría y asignado se ven ahí: la tabla deja espacio al título
        for i in (4, 5):
            self.vista.tabla.setColumnHidden(i, not todas)

    def mostrar(self, r: Datos) -> None:
        v = self.vista
        self.actual = rid = int(r["id"])
        limpiar(self.contenido)
        self.setVisible(True)
        self._columnas(False)
        meta = QHBoxLayout()
        estado = r.get("estado", "")
        meta.addWidget(chip_texto(*estado_respuesta(r)))
        prioridad = r.get("prioridad", "baja")
        meta.addWidget(chip_texto(NOMBRE_PRIORIDAD.get(prioridad, prioridad), COLOR_PRIORIDAD.get(prioridad, tema.TEXTO_TENUE)))
        meta.addStretch()
        meta.addWidget(etiqueta_con("tenue", f"#{rid}"))
        cerrar = QPushButton()
        cerrar.setObjectName("enlace")
        cerrar.setIcon(lucide("x", tema.TEXTO_SUAVE, 16))
        cerrar.setToolTip("Cerrar el detalle")
        cerrar.clicked.connect(lambda: (v.tabla.clearSelection(), self.vacio()))
        meta.addWidget(cerrar)
        self.contenido.addLayout(meta)
        titulo = QLabel(r.get("titulo", ""))
        titulo.setStyleSheet("font-weight: 600; font-size: 16px;")
        titulo.setWordWrap(True)
        self.contenido.addWidget(titulo)
        autor = (r.get("usuario") or {}).get("nombre") or "—"
        self.contenido.addWidget(etiqueta_con("tenue", f"Creado por {autor} · {hace(r.get('createdAt'))}", ajustar=True))
        desc = etiqueta_con("suave", r.get("descripcion", ""), ajustar=True)
        desc.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        self.contenido.addWidget(desc)
        if linea := linea_respuesta(r):
            self.contenido.addWidget(etiqueta_con("tenue", linea, ajustar=True))
        # Foto de la cámara que abrió la incidencia (evidencia, GET /api/evidencia/[id]).
        if r.get("eventoId") and (r.get("evento") or {}).get("evidencia"):
            foto = etiqueta_con("tenue", "Cargando foto…")
            self.contenido.addWidget(foto)
            eid = r["eventoId"]
            en_segundo_plano(lambda: v.cliente.evidencia(eid), lambda valor: self._con_foto(rid, foto, valor))

        rejilla = QGridLayout()
        rejilla.setHorizontalSpacing(10)
        rejilla.setVerticalSpacing(6)
        fila = 0
        if v.puede_asignar and v.operadores is not None:
            combo = QComboBox()
            combo.addItem("Sin asignar", None)
            for o in v.operadores:
                carga = (o.get("_count") or {}).get("reportesAsignados")
                combo.addItem(o.get("nombre", "") + (f" ({carga} pend.)" if carga is not None else ""), o.get("id"))
            combo.setCurrentIndex(max(0, combo.findData(r.get("operadorAsignadoId"))))
            combo.currentIndexChanged.connect(lambda _i: v._cambiar(rid, {"operadorAsignadoId": combo.currentData()}, combo))
            rejilla.addWidget(etiqueta_con("tenue", "Asignado a"), fila, 0)
            rejilla.addWidget(combo, fila, 1)
            fila += 1
        elif r.get("operadorAsignado"):
            rejilla.addWidget(etiqueta_con("tenue", "Asignado a"), fila, 0)
            rejilla.addWidget(QLabel(r["operadorAsignado"].get("nombre", "")), fila, 1)
            fila += 1
        if v.puede_reclasificar:
            prio = QComboBox()
            for clave in ("critica", "alta", "media", "baja"):
                prio.addItem(NOMBRE_PRIORIDAD[clave], clave)
            prio.setCurrentIndex(max(0, prio.findData(prioridad)))
            prio.currentIndexChanged.connect(lambda _i: v._cambiar(rid, {"prioridad": prio.currentData()}, prio))
            cat = QComboBox()
            cat.addItem("Sin categoría", None)
            for c in CATEGORIAS:
                cat.addItem(c, c)
            cat.setCurrentIndex(max(0, cat.findData(r.get("categoria"))))
            cat.currentIndexChanged.connect(lambda _i: v._cambiar(rid, {"categoria": cat.currentData()}, cat))
            rejilla.addWidget(etiqueta_con("tenue", "Prioridad"), fila, 0)
            rejilla.addWidget(prio, fila, 1)
            rejilla.addWidget(etiqueta_con("tenue", "Categoría"), fila + 1, 0)
            rejilla.addWidget(cat, fila + 1, 1)
        else:
            rejilla.addWidget(etiqueta_con("tenue", "Categoría"), fila, 0)
            rejilla.addWidget(QLabel(r.get("categoria") or "Sin categoría"), fila, 1)
        rejilla.setColumnStretch(1, 1)
        self.contenido.addLayout(rejilla)
        if v.puede_resolver and estado == "pendiente":
            # Atender = acuse de recibo; Cerrar pide el motivo (real, falsa alarma, prueba).
            acciones = QHBoxLayout()
            if not r.get("atendidoEn"):
                atender = QPushButton("Atender")
                atender.clicked.connect(lambda: v._responder(rid, None, atender))
                acciones.addWidget(atender)
            b_cerrar = QPushButton("Cerrar como…")
            b_cerrar.setObjectName("primario")
            menu = QMenu(b_cerrar)
            for clave, nombre in MOTIVOS_CIERRE.items():
                menu.addAction(nombre, lambda c=clave: v._responder(rid, c, b_cerrar))
            b_cerrar.setMenu(menu)
            acciones.addWidget(b_cerrar)
            acciones.addStretch()
            self.contenido.addLayout(acciones)

        self.contenido.addSpacing(6)
        self.contenido.addWidget(rotulo("Comentarios"))
        self.lista_comentarios = QVBoxLayout()
        self.lista_comentarios.setSpacing(4)
        self.lista_comentarios.addWidget(etiqueta_con("tenue", "Cargando…"))
        self.contenido.addLayout(self.lista_comentarios)
        escribir = QHBoxLayout()
        self.nuevo = QLineEdit()
        self.nuevo.setPlaceholderText("Escribe un comentario…")
        self.nuevo.setMaxLength(2000)  # MAX_LONGITUD_COMENTARIO de la web
        enviar = QPushButton("Enviar")
        enviar.clicked.connect(lambda: self._comentar(rid, enviar))
        self.nuevo.returnPressed.connect(enviar.click)
        escribir.addWidget(self.nuevo, 1)
        escribir.addWidget(enviar)
        self.contenido.addLayout(escribir)

        self.contenido.addSpacing(6)
        self.contenido.addWidget(rotulo("Historial"))
        self.lista_historial = QVBoxLayout()
        self.lista_historial.setSpacing(4)
        self.lista_historial.addWidget(etiqueta_con("tenue", "Cargando…"))
        self.contenido.addLayout(self.lista_historial)
        en_segundo_plano(lambda: v.cliente.comentarios(rid), lambda valor: self._con_comentarios(rid, valor))
        en_segundo_plano(lambda: v.cliente.historial(rid), lambda valor: self._con_historial(rid, valor))

    def _con_foto(self, rid: int, etiqueta: QLabel, valor: object) -> None:
        if rid != self.actual:
            return  # llegó tarde: ya se eligió otro reporte
        pix = QPixmap()
        if isinstance(valor, ErrorCentinela) or not pix.loadFromData(valor):  # type: ignore[arg-type]
            etiqueta.setText("No se pudo cargar la foto de evidencia.")
            return
        etiqueta.setPixmap(pix.scaledToWidth(360, Qt.TransformationMode.SmoothTransformation))
        etiqueta.setToolTip("Foto tomada por la cámara del nodo")

    def _con_comentarios(self, rid: int, valor: object) -> None:
        if rid != self.actual:
            return  # llegó tarde: ya se eligió otro reporte
        limpiar(self.lista_comentarios)
        if isinstance(valor, ErrorCentinela):
            self.lista_comentarios.addWidget(etiqueta_con("error", str(valor), ajustar=True))
            return
        for c in valor:  # type: ignore[union-attr]
            self.lista_comentarios.addWidget(etiqueta_con("tenue", f"{(c.get('autor') or {}).get('nombre', '—')} · {hace(c.get('createdAt'))}"))
            texto = etiqueta_con("", "", ajustar=True)
            texto.setTextFormat(Qt.TextFormat.PlainText)  # lo escribe otra persona: nunca como HTML
            texto.setText(c.get("contenido", ""))
            texto.setContentsMargins(0, 0, 0, 6)
            self.lista_comentarios.addWidget(texto)
        if not valor:
            self.lista_comentarios.addWidget(etiqueta_con("tenue", "Sin comentarios todavía."))

    def _con_historial(self, rid: int, valor: object) -> None:
        if rid != self.actual:
            return
        limpiar(self.lista_historial)
        if isinstance(valor, ErrorCentinela):
            self.lista_historial.addWidget(etiqueta_con("error", str(valor), ajustar=True))
            return
        def legible(campo: str, val: object) -> str:
            if val in (None, ""):
                return "sin asignar" if campo == "operadorAsignado" else "—"
            return NOMBRE_PRIORIDAD.get(str(val), str(val)) if campo == "prioridad" else str(val)

        for h in valor:  # type: ignore[union-attr]
            campo = h.get("campo", "")
            cambio = ("Acusó recibo" if campo == "atencion"
                      else f"Cerró como {MOTIVOS_CIERRE.get(h.get('valorNuevo') or '', h.get('valorNuevo'))}" if campo == "motivoCierre"
                      else f"{CAMPOS_HISTORIAL.get(campo, campo)}: {legible(campo, h.get('valorAnterior'))} a {legible(campo, h.get('valorNuevo'))}")
            texto = f"{cambio} · {(h.get('autor') or {}).get('nombre', '—')}, {hace(h.get('createdAt'))}"
            self.lista_historial.addWidget(etiqueta_con("tenue", texto, ajustar=True))
        if not valor:
            self.lista_historial.addWidget(etiqueta_con("tenue", "Sin cambios desde que se creó."))

    def _comentar(self, rid: int, boton: QPushButton) -> None:
        texto = self.nuevo.text().strip()
        if not texto:
            return
        boton.setEnabled(False)

        def listo(valor: object) -> None:
            boton.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                self.vista.avisar(str(valor), "error")
                return
            self.nuevo.clear()
            en_segundo_plano(lambda: self.vista.cliente.comentarios(rid), lambda val: self._con_comentarios(rid, val))

        en_segundo_plano(lambda: self.vista.cliente.comentar(rid, texto), listo)


class VistaReportes(Vista):
    COLUMNAS = ("#", "ESTADO", "PRIORIDAD", "TÍTULO", "CATEGORÍA", "ASIGNADO", "CREADO")

    def __init__(self, cliente: ClienteCentinela, usuario: Datos) -> None:
        super().__init__()
        self.cliente = cliente
        permisos = usuario.get("permisos", [])
        self.puede_resolver = "reportes.resolver" in permisos
        self.puede_reclasificar = "reportes.reclasificar" in permisos
        # Para elegir Operador hace falta la lista de cuentas (usuarios.gestionar), igual que en la web
        self.puede_asignar = "reportes.asignar" in permisos and "usuarios.gestionar" in permisos
        self.operadores: list[Datos] | None = None
        self.reportes: list[Datos] = []
        self.visibles: list[Datos] = []
        ve_todos = "reportes.ver_todos" in permisos
        cabeza, _, _ = encabezado("Reportes", "Todas las incidencias del sistema." if ve_todos else "Tus incidencias y cómo avanzan.")
        self.cifras = CifrasLinea(["en total", "pendientes", "resueltos"])
        cabeza.acciones.addWidget(self.cifras)
        cabeza.acciones.addSpacing(8)
        self.boton_exportar = QPushButton("Exportar CSV")
        self.boton_exportar.clicked.connect(self._exportar)
        nuevo = QPushButton("Nuevo reporte")
        nuevo.setObjectName("primario")
        nuevo.clicked.connect(self._nuevo)
        cabeza.acciones.addWidget(self.boton_exportar)
        cabeza.acciones.addWidget(nuevo)
        self.col.addWidget(cabeza)
        self.aviso = etiqueta_con("tenue")
        self.aviso.setVisible(False)
        self.col.addWidget(self.aviso)

        filtros = QHBoxLayout()
        self.busqueda = QLineEdit()
        self.busqueda.setPlaceholderText("Buscar por título, descripción o #número…")
        self.busqueda.setMinimumWidth(200)
        self.busqueda.textChanged.connect(self._pintar)
        filtros.addWidget(self.busqueda, 1)
        # La primera opción de cada filtro es "todos" y lleva el nombre del filtro
        self.f_estado = self._combo([("Estado", None), ("Pendientes", "pendiente"), ("Resueltos", "resuelto")])
        self.f_prioridad = self._combo([("Prioridad", None)] + [(NOMBRE_PRIORIDAD[k], k) for k in ("critica", "alta", "media", "baja")])
        self.f_categoria = self._combo([("Categoría", None)] + [(c, c) for c in CATEGORIAS])
        self.f_asignado = self._combo([("Asignación", None), ("Sin asignar", "sin")])
        self.f_asignado.setVisible(ve_todos)
        for w in (self.f_estado, self.f_prioridad, self.f_categoria, self.f_asignado):
            filtros.addWidget(w)
        self.ocultar_sim = QPushButton("Sin simulados")
        self.ocultar_sim.setObjectName("chip")
        self.ocultar_sim.setCheckable(True)
        self.ocultar_sim.setToolTip("Los reportes [SIMULADO] los crea la simulación del prototipo en la web.")
        self.ocultar_sim.clicked.connect(self._pintar)
        self.ver_graficas = QPushButton("Gráficas")
        self.ver_graficas.setObjectName("chip")
        self.ver_graficas.setCheckable(True)
        self.ver_graficas.clicked.connect(lambda: self.graficas.setVisible(self.ver_graficas.isChecked()))
        filtros.addWidget(self.ocultar_sim)
        filtros.addWidget(self.ver_graficas)
        self.col.addLayout(filtros)

        self.graficas = Tarjeta()
        self.fila_graficas = QHBoxLayout()
        self.fila_graficas.setSpacing(32)
        self.graficas.cuerpo.addLayout(self.fila_graficas)
        self.graficas.setVisible(False)
        self.col.addWidget(self.graficas)

        cuerpo = QHBoxLayout()
        cuerpo.setSpacing(16)
        marco = Tarjeta()
        marco.cuerpo.setContentsMargins(8, 6, 8, 6)
        self.tabla = QTableWidget(0, len(self.COLUMNAS))
        self.tabla.setHorizontalHeaderLabels(self.COLUMNAS)
        self.tabla.verticalHeader().setVisible(False)
        self.tabla.verticalHeader().setDefaultSectionSize(38)
        self.tabla.setShowGrid(False)
        self.tabla.setWordWrap(False)
        self.tabla.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tabla.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.tabla.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tabla.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.tabla.setMinimumHeight(420)
        cabecera = self.tabla.horizontalHeader()
        cabecera.setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        cabecera.setHighlightSections(False)
        for i in range(len(self.COLUMNAS)):
            cabecera.setSectionResizeMode(i, QHeaderView.ResizeMode.Stretch if i == 3 else QHeaderView.ResizeMode.ResizeToContents)
        self.tabla.itemSelectionChanged.connect(self._elegido)
        marco.cuerpo.addWidget(self.tabla)
        self.vacio = etiqueta_con("suave", "")
        self.vacio.setVisible(False)
        marco.cuerpo.addWidget(self.vacio)
        cuerpo.addWidget(marco, 1)
        self.detalle = DetalleReporte(self)
        cuerpo.addWidget(self.detalle, 0, Qt.AlignmentFlag.AlignTop)
        self.col.addLayout(cuerpo, 1)

    def _combo(self, opciones: list[tuple[str, object]]) -> QComboBox:
        c = QComboBox()
        c.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToContents)
        for texto, dato in opciones:
            c.addItem(texto, dato)
        c.currentIndexChanged.connect(self._pintar)
        return c

    def avisar(self, texto: str, tono: str = "") -> None:
        colores = {"ok": tema.VERDE, "error": tema.ROJO_ALERTA}
        self.aviso.setStyleSheet(f"color: {colores[tono]};" if tono in colores else "")
        self.aviso.setText(texto)
        self.aviso.setVisible(bool(texto))

    def al_mostrar(self) -> None:
        if self.puede_asignar:
            en_segundo_plano(lambda: (self.cliente.usuarios(), self.cliente.reportes()), self._con_operadores_y_reportes)
        else:
            en_segundo_plano(self.cliente.reportes, self._con_reportes)

    def _con_operadores_y_reportes(self, valor: object) -> None:
        if isinstance(valor, ErrorCentinela):
            self._con_reportes(valor)
            return
        usuarios, reportes = valor  # type: ignore[misc]
        self.operadores = [u for u in usuarios if (u.get("rol") or {}).get("nombre") == "Operador"]
        actual = self.f_asignado.currentData()
        self.f_asignado.blockSignals(True)
        while self.f_asignado.count() > 2:
            self.f_asignado.removeItem(2)
        for o in self.operadores:
            self.f_asignado.addItem(o.get("nombre", ""), o.get("id"))
        self.f_asignado.setCurrentIndex(max(0, self.f_asignado.findData(actual)))
        self.f_asignado.blockSignals(False)
        self._con_reportes(reportes)

    def _con_reportes(self, valor: object) -> None:
        if isinstance(valor, ErrorCentinela):
            self.avisar(str(valor), "error")
            return
        self.reportes = list(valor)  # type: ignore[arg-type]
        pendientes = sum(1 for r in self.reportes if r.get("estado") == "pendiente")
        self.cifras.fijar(0, len(self.reportes))
        self.cifras.fijar(1, pendientes, "senal" if pendientes else "normal")
        self.cifras.fijar(2, len(self.reportes) - pendientes, "ok")
        limpiar(self.fila_graficas)
        self.fila_graficas.addWidget(barras("Por prioridad", [
            (NOMBRE_PRIORIDAD[k], sum(1 for r in self.reportes if r.get("prioridad") == k), COLOR_PRIORIDAD[k])
            for k in ("critica", "alta", "media", "baja")]), 1)
        self.fila_graficas.addWidget(barras("Por categoría", [
            (c, sum(1 for r in self.reportes if r.get("categoria") == c), tema.AMBAR) for c in CATEGORIAS]
            + [("Sin categoría", sum(1 for r in self.reportes if not r.get("categoria")), tema.TEXTO_TENUE)]), 1)
        self._pintar()

    def _pintar(self) -> None:
        elegido = self.detalle.actual
        self.visibles = filtrar_reportes(
            self.reportes, self.busqueda.text(), self.f_estado.currentData(), self.f_prioridad.currentData(),
            self.f_categoria.currentData(), self.f_asignado.currentData(), self.ocultar_sim.isChecked())
        self.tabla.blockSignals(True)
        self.tabla.clearSelection()
        self.tabla.setRowCount(len(self.visibles))
        fila_elegida = None
        for i, r in enumerate(self.visibles):
            prioridad, estado = r.get("prioridad", "baja"), r.get("estado", "")
            asignado = (r.get("operadorAsignado") or {}).get("nombre")
            celdas = [
                (f"#{r.get('id')}", tema.TEXTO_TENUE),
                estado_respuesta(r),
                (NOMBRE_PRIORIDAD.get(prioridad, prioridad), COLOR_PRIORIDAD.get(prioridad, tema.TEXTO_TENUE)),
                (r.get("titulo", ""), tema.TEXTO),
                (r.get("categoria") or "—", tema.TEXTO_SUAVE),
                (asignado or "Sin asignar", tema.TEXTO_SUAVE if asignado else tema.TEXTO_TENUE),
                (fecha(r.get("createdAt"), "%d %b %H:%M"), tema.TEXTO_TENUE),
            ]
            for j, (texto, color) in enumerate(celdas):
                item = QTableWidgetItem(texto)
                item.setForeground(QColor(color))
                if j == 3:
                    item.setToolTip(texto)
                self.tabla.setItem(i, j, item)
            if r.get("id") == elegido:
                fila_elegida = i
        if fila_elegida is not None:
            self.tabla.selectRow(fila_elegida)
        self.tabla.blockSignals(False)
        self.tabla.setVisible(bool(self.visibles))
        self.vacio.setVisible(not self.visibles)
        self.vacio.setText("Ningún reporte coincide con los filtros." if self.reportes else "No hay reportes todavía.")
        if fila_elegida is not None:
            self.detalle.mostrar(self.visibles[fila_elegida])  # con los datos nuevos (estado, asignación)
        elif elegido is not None:
            self.detalle.vacio()

    def _elegido(self) -> None:
        filas = self.tabla.selectionModel().selectedRows()
        if filas:
            self.detalle.mostrar(self.visibles[filas[0].row()])

    def _nuevo(self) -> None:
        if DialogoReporte(self, self.cliente).exec():
            self.avisar("Reporte creado.", "ok")
            self.al_mostrar()

    def _cambiar(self, reporte_id: int, cambios: Datos, combo: QComboBox) -> None:
        """Asignar o reclasificar desde el panel de detalle (PATCH /api/reportes/[id])."""
        combo.setEnabled(False)

        def listo(valor: object) -> None:
            combo.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                self.avisar(str(valor), "error")
            else:
                self.avisar(f"Reporte #{reporte_id} actualizado.", "ok")
            self.al_mostrar()  # repinta con lo que dice el servidor, también si falló

        en_segundo_plano(lambda: self.cliente.actualizar_reporte(reporte_id, cambios), listo)

    def _exportar(self) -> None:
        self.boton_exportar.setEnabled(False)

        def listo(valor: object) -> None:
            self.boton_exportar.setEnabled(True)
            if isinstance(valor, ErrorCentinela):
                self.avisar(str(valor), "error")
                return
            guardar_archivo(self, f"reportes-{datetime.now():%Y-%m-%d}.csv", valor)  # type: ignore[arg-type]

        en_segundo_plano(self.cliente.exportar_reportes, listo)

    def _responder(self, reporte_id: int, motivo: str | None, boton: QPushButton) -> None:
        """Sin motivo: acuse de recibo. Con motivo: cierra el reporte (lib/respuesta.ts de la web)."""
        texto = boton.text()
        boton.setEnabled(False)
        boton.setText("Guardando…")

        def listo(valor: object) -> None:
            if isinstance(valor, ErrorCentinela):
                boton.setEnabled(True)
                boton.setText(texto)
                self.avisar(str(valor), "error")
                return
            self.avisar(f"Reporte #{reporte_id} {'cerrado' if motivo else 'en atención'}.", "ok")
            self.al_mostrar()

        if motivo:
            en_segundo_plano(lambda: self.cliente.resolver_reporte(reporte_id, motivo), listo)
        else:
            en_segundo_plano(lambda: self.cliente.atender_reporte(reporte_id), listo)

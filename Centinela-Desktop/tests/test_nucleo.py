"""Pruebas de la parte sin interfaz: dirección del servidor, qué avisos mostrar y el cliente HTTP."""
import re

import httpx
import pytest
import respx

from centinela_desktop.avisos import es_panico, nuevos_avisos
from centinela_desktop.cliente import ClienteCentinela, ErrorCentinela
from centinela_desktop.config import MARCA_UA, normalizar_servidor

SERVIDOR = "http://centinela.test"


@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("192.168.1.50:3000/", "http://192.168.1.50:3000"),
        ("  http://localhost:3000/dashboard ", "http://localhost:3000"),
        ("https://centinela.ejemplo.mx", "https://centinela.ejemplo.mx"),
        ("", None),
        ("ftp://algo", None),
        ("http://", None),
    ],
)
def test_normalizar_servidor(texto, esperado):
    assert normalizar_servidor(texto) == esperado


def test_nuevos_avisos_solo_no_leidos_y_no_vistos_en_orden():
    notis = [
        {"id": 3, "mensaje": "c", "leida": False, "createdAt": "2026-10-23T10:00:00Z"},
        {"id": 2, "mensaje": "b", "leida": True, "createdAt": "2026-10-23T09:00:00Z"},
        {"id": 1, "mensaje": "a", "leida": False, "createdAt": "2026-10-23T08:00:00Z"},
    ]
    assert [n["id"] for n in nuevos_avisos(set(), notis)] == [1, 3]
    assert [n["id"] for n in nuevos_avisos({1}, notis)] == [3]


def test_es_panico_usa_el_mismo_prefijo_que_la_web():
    assert es_panico({"mensaje": "PÁNICO: Ana pidió ayuda"})
    assert not es_panico({"mensaje": "Nueva incidencia asignada"})


@respx.mock
def test_cliente_manda_cookie_y_marca_de_la_app():
    ruta = respx.get(f"{SERVIDOR}/api/notificaciones").mock(
        return_value=httpx.Response(200, json={"notificaciones": [{"id": 1, "mensaje": "x", "leida": False}], "noLeidas": 1})
    )
    c = ClienteCentinela(SERVIDOR)
    assert not c.con_sesion
    c.fijar_sesion("abc")
    assert c.con_sesion
    assert c.notificaciones()[0]["id"] == 1
    peticion = ruta.calls.last.request
    assert "token=abc" in peticion.headers["cookie"]
    assert MARCA_UA in peticion.headers["user-agent"]


@respx.mock
def test_cliente_panico_devuelve_avisados():
    respx.post(f"{SERVIDOR}/api/panico").mock(return_value=httpx.Response(201, json={"id": 9, "avisados": 3}))
    c = ClienteCentinela(SERVIDOR)
    c.fijar_sesion("abc")
    assert c.panico() == 3


@respx.mock
@pytest.mark.parametrize(
    ("respuesta", "mensaje"),
    [
        (httpx.Response(401, json={"error": "No autenticado"}), "sesión expiró"),
        (httpx.Response(429, json={"error": "Ya enviaste varias alertas"}), "Ya enviaste varias alertas"),
        (httpx.Response(500, text="boom"), "500"),
    ],
)
def test_cliente_traduce_errores(respuesta, mensaje):
    respx.post(f"{SERVIDOR}/api/panico").mock(return_value=respuesta)
    with pytest.raises(ErrorCentinela, match=mensaje):
        ClienteCentinela(SERVIDOR).panico()


@respx.mock
def test_cliente_sin_red():
    respx.get(f"{SERVIDOR}/api/notificaciones").mock(side_effect=httpx.ConnectError("caído"))
    with pytest.raises(ErrorCentinela, match="No se pudo conectar"):
        ClienteCentinela(SERVIDOR).notificaciones()


# --- app nativa: stream, estado en vivo, saludo y login
from centinela_desktop.estado import aplicar  # noqa: E402
from centinela_desktop.saludo import nombre_corto, saludo  # noqa: E402
from centinela_desktop.sse import LectorSSE  # noqa: E402


def test_lector_sse_arma_eventos_por_bloque_e_ignora_comentarios():
    lector = LectorSSE()
    lineas = [": ping", "event: snapshot", 'data: [{"id": 1}]', "", "event: evento.nuevo", 'data: {"id": "a"}', ""]
    salida = [r for linea in lineas if (r := lector.linea(linea))]
    assert salida == [("snapshot", [{"id": 1}]), ("evento.nuevo", {"id": "a"})]


def test_estado_aplica_snapshot_telemetria_estado_y_eventos_sin_duplicar():
    nodos, eventos = aplicar([], [], "snapshot", [{"id": 1, "estado": "en_linea", "telemetria": None}])
    nodos, eventos = aplicar(nodos, eventos, "dispositivo.telemetria", {"dispositivoId": 1, "telemetria": {"t": 40}, "ultimoContacto": "x"})
    assert nodos[0]["telemetria"] == {"t": 40}
    nodos, eventos = aplicar(nodos, eventos, "dispositivo.estado", {"dispositivoId": 1, "conexion": "DESCONECTADO"})
    assert nodos[0]["estado"] == "desconectado"
    nodos, eventos = aplicar(nodos, eventos, "evento.nuevo", {"id": "e1"})
    nodos, eventos = aplicar(nodos, eventos, "evento.nuevo", {"id": "e1"})
    assert [e["id"] for e in eventos] == ["e1"]


def test_saludo_igual_que_la_web():
    assert saludo(6, "Angel Munguía") == "Desmañanado, Angel Munguía"
    assert saludo(3, "A", 1) == "Desvelado, A"
    assert saludo(9, "") == "Buenos días"
    assert nombre_corto("Angel David", "Munguía Zúñiga") == "Angel Munguía"


@respx.mock
def test_login_guarda_la_cookie_y_luego_la_manda():
    respx.post(f"{SERVIDOR}/api/login").mock(
        return_value=httpx.Response(200, json={"user": {"id": 1}}, headers={"set-cookie": "token=jwt123; Path=/; HttpOnly"})
    )
    yo = respx.get(f"{SERVIDOR}/api/me").mock(return_value=httpx.Response(200, json={"user": {"id": 1, "nombre": "Ana"}}))
    c = ClienteCentinela(SERVIDOR)
    c.iniciar_sesion("a@b.c", "x")
    assert c.con_sesion and c.token == "jwt123"
    assert c.yo()["nombre"] == "Ana"
    assert "token=jwt123" in yo.calls.last.request.headers["cookie"]


@respx.mock
def test_login_con_credenciales_malas():
    respx.post(f"{SERVIDOR}/api/login").mock(return_value=httpx.Response(401, json={"error": "x"}))
    with pytest.raises(ErrorCentinela, match="Correo o contraseña incorrectos"):
        ClienteCentinela(SERVIDOR).iniciar_sesion("a@b.c", "mal")


@respx.mock
def test_cliente_gestion_rutas_y_formas():
    respx.post(f"{SERVIDOR}/api/edge/gateways").mock(return_value=httpx.Response(201, json={"id": 4, "nombre": "Pi", "token": "secreto"}))
    respx.get(f"{SERVIDOR}/api/admin/roles").mock(return_value=httpx.Response(200, json=[{"id": 1, "nombre": "Admin"}]))
    respx.get(f"{SERVIDOR}/api/admin/auditoria").mock(return_value=httpx.Response(200, json={"registros": [{"accion": "cambio_rol"}]}))
    respx.post(f"{SERVIDOR}/api/perfil/password").mock(return_value=httpx.Response(401, json={"error": "x"}))
    c = ClienteCentinela(SERVIDOR)
    assert c.vincular_gateway("Pi", "http://pi:8000")["token"] == "secreto"
    assert c.roles() == [{"id": 1, "nombre": "Admin"}]
    assert c.auditoria()[0]["accion"] == "cambio_rol"
    with pytest.raises(ErrorCentinela, match="contraseña actual es incorrecta"):
        c.cambiar_contrasena("mal", "nueva-de-8")


def test_vistas_de_gestion_se_arman_y_pintan(monkeypatch):
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication

    from centinela_desktop import vistas_gestion as vg

    app = QApplication.instance() or QApplication([])  # noqa: F841
    usuario = {"id": 1, "email": "a@b.c", "nombre": "Ana", "permisos": ["usuarios.gestionar", "auditoria.ver"]}
    c = ClienteCentinela(SERVIDOR)
    vg.VistaAjustes(c, usuario)
    disp = vg.VistaDispositivos(c)
    disp._con_gateways([{"id": 1, "nombre": "Pi", "urlBase": "http://pi", "revocadoEn": None},
                        {"id": 2, "nombre": "Vieja", "urlBase": "http://v", "revocadoEn": "2026-10-01T00:00:00Z"}])
    # Activa + botón "Revocadas (1)" + caja plegada con la revocada
    assert disp.lista.count() == 3
    plegar, caja = disp.lista.itemAt(1).widget(), disp.lista.itemAt(2).widget()
    assert "Revocadas (1)" in plegar.text() and caja.isHidden()
    plegar.click()
    assert not caja.isHidden()
    admin = vg.VistaAdmin(c, usuario)
    admin._con_usuarios(([{"id": 1, "nombre": "Admin"}, {"id": 2, "nombre": "Usuario"}],
                         [{"id": 1, "nombre": "Ana", "email": "a@b.c", "rol": {"nombre": "Admin"}},
                          {"id": 2, "nombre": "Beto", "email": "<b>@x", "rol": {"nombre": "Usuario"}}]))
    assert admin.lista_usuarios.count() == 2
    admin._con_auditoria([{"accion": "cambio_rol", "objetivoEmail": "<b>@x", "adminEmail": "a@b.c",
                           "valorAnterior": "Usuario", "valorNuevo": "Operador", "createdAt": "2026-10-23T10:00:00Z"}])
    assert "&lt;b&gt;@x" in admin.lista_auditoria.itemAt(0).widget().text()


def test_modulos_iguales_a_la_web():
    from pathlib import Path

    from centinela_desktop.modulos import MODULOS

    ts = Path(__file__).parents[2] / "Centinela" / "lib" / "prototipo" / "modulos.ts"
    if not ts.exists():
        pytest.skip("sin el repo de la web al lado")
    nombres_web = re.findall(r"nombre: '([^']+)'", ts.read_text(encoding="utf-8"))
    assert [m[1] for m in MODULOS] == nombres_web


def test_vista_prototipo_pinta_los_17_modulos(monkeypatch):
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication

    from centinela_desktop.vista_prototipo import VistaPrototipo

    app = QApplication.instance() or QApplication([])  # noqa: F841
    assert VistaPrototipo().tarjetas == 17


def test_permisos_iguales_a_la_web():
    from pathlib import Path

    from centinela_desktop.vistas_gestion import PERMISOS

    ts = Path(__file__).parents[2] / "Centinela" / "lib" / "permisos.ts"
    if not ts.exists():
        pytest.skip("sin el repo de la web al lado")
    assert [p[0] for p in PERMISOS] == re.findall(r'clave: "([^"]+)"', ts.read_text(encoding="utf-8"))


@respx.mock
def test_dialogo_permisos_bloquea_y_envia_estados(monkeypatch):
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication, QWidget

    from centinela_desktop import vistas_gestion as vg

    app = QApplication.instance() or QApplication([])  # noqa: F841
    monkeypatch.setattr(vg, "en_segundo_plano", lambda trabajo, listo: None)  # pintamos a mano
    padre = QWidget()  # sin referencia, Qt borra el diálogo junto con su padre
    dlg = vg.DialogoPermisos(padre, ClienteCentinela(SERVIDOR), {"id": 7, "email": "op@x", "nombre": "Op"},
                             es_admin=False, mis_permisos=["reportes.resolver", "usuarios.gestionar"])
    estados = {p[0]: "defecto" for p in vg.PERMISOS} | {"reportes.resolver": "quitado"}
    dlg.pintar({"rol": "Operador", "estados": estados, "porDefecto": ["reportes.resolver"]})
    assert dlg.estados() == estados
    botones = {k: g.buttons() for k, g in dlg.grupos.items()}
    assert botones["reportes.resolver"][0].isEnabled()          # lo tiene: puede tocarlo
    assert not botones["usuarios.gestionar"][0].isEnabled()     # nunca, si no es Admin
    assert not botones["auditoria.ver"][0].isEnabled()          # no lo tiene
    botones["reportes.resolver"][1].click()                     # Otorgado
    assert dlg.estados()["reportes.resolver"] == "otorgado"

    ruta = respx.put(f"{SERVIDOR}/api/admin/usuarios/7/permisos").mock(return_value=httpx.Response(200, json={"rol": "Operador"}))
    ClienteCentinela(SERVIDOR).guardar_permisos(7, dlg.estados())
    assert ruta.calls.last.request.content.decode().count("otorgado") == 1


def test_respuesta_tardia_a_un_widget_cerrado_no_truena():
    from centinela_desktop.tareas import _entregar

    def borrado(_valor):
        raise RuntimeError("Internal C++ object (QLabel) already deleted.")

    _entregar(borrado, 1)  # se ignora
    with pytest.raises(RuntimeError, match="otro"):
        _entregar(lambda _v: (_ for _ in ()).throw(RuntimeError("otro")), 1)


def test_csv_bitacora_igual_que_la_web():
    from centinela_desktop.vistas import csv_bitacora

    csv = csv_bitacora([{"ocurridoEn": "2026-10-24T01:00:00Z", "tipo": "movimiento", "dispositivoNombre": "nodo-1",
                         "severidad": "alta", "detalle": 'dijo "hola"', "id": 9}])
    assert csv.splitlines() == ['"fecha","tipo","nodo","severidad","detalle","id"',
                                '"2026-10-24T01:00:00Z","movimiento","nodo-1","alta","dijo ""hola""","9"']


@respx.mock
def test_asignar_y_exportar_reportes():
    c = ClienteCentinela(SERVIDOR)
    ruta = respx.patch(f"{SERVIDOR}/api/reportes/5").mock(return_value=httpx.Response(200, json={"id": 5}))
    c.asignar_reporte(5, None)
    assert ruta.calls.last.request.content == b'{"operadorAsignadoId":null}'
    respx.get(f"{SERVIDOR}/api/reportes/export").mock(return_value=httpx.Response(200, content=b"id,titulo\n1,a"))
    assert c.exportar_reportes() == b"id,titulo\n1,a"
    respx.get(f"{SERVIDOR}/api/reportes/export").mock(return_value=httpx.Response(401))
    with pytest.raises(ErrorCentinela, match="sesión expiró"):
        c.exportar_reportes()


def test_campanita_cuenta_y_lista_avisos(monkeypatch):
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtCore import QSettings
    from PySide6.QtWidgets import QApplication

    from centinela_desktop import ventana as v

    app = QApplication.instance() or QApplication([])  # noqa: F841
    monkeypatch.setattr(v, "en_segundo_plano", lambda trabajo, listo: None)
    monkeypatch.setattr(v.VentanaConsola, "_conectar_stream", lambda self: None, raising=False)
    w = v.VentanaConsola(ClienteCentinela(SERVIDOR), {"id": 1, "nombre": "Ana", "permisos": []}, QSettings("CentinelaPrueba", "tmp"))
    w.fijar_notificaciones([{"id": 2, "mensaje": "PÁNICO: ayuda", "leida": False}, {"id": 1, "mensaje": "viejo", "leida": True}])
    assert w.campana.text().strip() == "1"
    textos = [a.text() for a in w.campana.menu().actions() if a.text()]
    assert textos[0].endswith("PÁNICO: ayuda") and textos[-1] == "Marcar todas como leídas"
    w.fijar_notificaciones([])
    assert w.campana.text() == "" and w.campana.menu().actions()[0].text() == "No tienes avisos."


def test_telemetria_legible_como_la_web():
    from centinela_desktop.vistas import telemetria_legible

    assert telemetria_legible({"temp_c": 42.3, "rssi_dbm": -55, "uptime_s": 78, "ts_ms": 1}) == ["42.3 °C", "-55 dBm", "1 min 18 s"]
    assert telemetria_legible({}) == []


@respx.mock
def test_401_con_sesion_avisa_que_vencio_pero_el_login_no():
    c = ClienteCentinela(SERVIDOR)
    vencio = []
    c.al_expirar = lambda: vencio.append(1)
    respx.post(f"{SERVIDOR}/api/login").mock(return_value=httpx.Response(401, json={"error": "x"}))
    with pytest.raises(ErrorCentinela, match="incorrectos"):
        c.iniciar_sesion("a@b.c", "mala")
    assert vencio == []  # contraseña mala: no había sesión
    c.fijar_sesion("tok")
    respx.get(f"{SERVIDOR}/api/notificaciones").mock(return_value=httpx.Response(401, json={"error": "x"}))
    with pytest.raises(ErrorCentinela, match="sesión expiró"):
        c.notificaciones()
    assert vencio == [1]


def test_hace_relativo_y_con_fecha():
    from datetime import datetime, timezone

    from centinela_desktop.vistas import hace

    ahora = datetime(2026, 10, 24, 12, 0, tzinfo=timezone.utc).astimezone()
    assert hace("2026-10-24T11:59:30Z", ahora).startswith("hace un momento")
    assert hace("2026-10-24T11:15:00Z", ahora).startswith("hace 45 min")
    hace_dos = hace("2026-10-22T12:00:00Z", ahora)
    assert hace_dos.startswith("hace 2 días (22 oct") or hace_dos.startswith("hace 2 días (21 oct")  # depende de la zona
    assert hace(None) == "nunca"


def test_rafagas_se_agrupan_por_clave_y_ventana():
    from centinela_desktop.vistas import agrupar_rafagas

    def ev(i, nodo, hora):
        return {"id": i, "tipo": "movimiento", "dispositivoNombre": nodo, "detalle": "x", "severidad": "baja",
                "ocurridoEn": f"2026-10-22T{hora}Z"}

    # Dos nodos intercalados, como en la Bitácora real; el último llega 20 min después
    eventos = [ev(1, "a", "19:22:46"), ev(2, "b", "19:22:46"), ev(3, "a", "19:20:30"), ev(4, "b", "19:20:30"), ev(5, "a", "19:00:00")]
    grupos = agrupar_rafagas(eventos)
    assert [[e["id"] for e in g] for g in grupos] == [[1, 3], [2, 4], [5]]


def test_por_hora_cuenta_las_ultimas_24():
    from datetime import datetime, timezone

    from centinela_desktop.vistas import por_hora

    ahora = datetime(2026, 10, 24, 12, 30, tzinfo=timezone.utc)
    conteo = por_hora([{"ocurridoEn": "2026-10-24T12:05:00Z"}, {"ocurridoEn": "2026-10-24T10:59:00Z"},
                       {"ocurridoEn": "2026-10-23T12:00:00Z"}], ahora)
    assert conteo[23] == 1 and conteo[21] == 1 and sum(conteo) == 2


def test_filtrar_reportes_y_atencion_por_rol():
    from centinela_desktop.vistas import atencion, filtrar_reportes

    reportes = [
        {"id": 1, "titulo": "[SIMULADO] ave", "estado": "pendiente", "prioridad": "alta", "operadorAsignadoId": None},
        {"id": 2, "titulo": "Cámara caída", "estado": "pendiente", "prioridad": "critica", "operadorAsignadoId": 7, "categoria": "Hardware"},
        {"id": 3, "titulo": "Viejo", "estado": "resuelto", "prioridad": "baja", "operadorAsignadoId": None},
    ]
    assert [r["id"] for r in filtrar_reportes(reportes, ocultar_simulados=True)] == [2, 3]
    assert [r["id"] for r in filtrar_reportes(reportes, asignado="sin")] == [1, 3]
    assert [r["id"] for r in filtrar_reportes(reportes, asignado=7, categoria="Hardware")] == [2]
    assert [r["id"] for r in filtrar_reportes(reportes, texto="#3")] == [3]

    admin = {"id": 1, "role": "Admin", "permisos": ["reportes.ver_todos", "reportes.asignar"]}
    operador = {"id": 7, "role": "Operador", "permisos": ["reportes.ver_todos"]}
    nodos = [{"id": 9, "nombre": "n1", "estado": "desconectado", "ultimoContacto": None}]
    filas_admin = atencion(reportes, nodos, admin)
    assert filas_admin[0][3] == "monitor"                       # el nodo caído va primero
    assert [f[0] for f in filas_admin[1:]] == ["Alta · [SIMULADO] ave"]  # solo críticos/altos sin asignar
    filas_op = atencion(reportes, [], operador)
    assert [f[0] for f in filas_op] == ["Crítica · Cámara caída", "Alta · [SIMULADO] ave"]  # lo suyo primero
    assert "asignado a ti" in filas_op[0][1] and "sin asignar" in filas_op[1][1]


@respx.mock
def test_comentarios_historial_y_reclasificar():
    c = ClienteCentinela(SERVIDOR)
    respx.get(f"{SERVIDOR}/api/reportes/4/comentarios").mock(return_value=httpx.Response(200, json=[{"contenido": "hola"}]))
    nuevo = respx.post(f"{SERVIDOR}/api/reportes/4/comentarios").mock(return_value=httpx.Response(201, json={"id": 1}))
    respx.get(f"{SERVIDOR}/api/reportes/4/historial").mock(return_value=httpx.Response(200, json=[{"campo": "estado"}]))
    patch = respx.patch(f"{SERVIDOR}/api/reportes/4").mock(return_value=httpx.Response(200, json={"id": 4}))
    assert c.comentarios(4)[0]["contenido"] == "hola"
    c.comentar(4, "visto")
    assert nuevo.calls.last.request.content == b'{"contenido":"visto"}'
    assert c.historial(4)[0]["campo"] == "estado"
    c.actualizar_reporte(4, {"prioridad": "alta"})
    assert patch.calls.last.request.content == b'{"prioridad":"alta"}'


def test_vistas_de_operacion_pintan_sin_servidor(monkeypatch):
    monkeypatch.setenv("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication

    from centinela_desktop import vistas as v

    app = QApplication.instance() or QApplication([])  # noqa: F841
    monkeypatch.setattr(v, "en_segundo_plano", lambda trabajo, listo: None)
    usuario = {"id": 1, "role": "Admin", "nombre": "Ana", "ultimoLoginAnterior": "2026-10-20T10:00:00Z",
               "permisos": ["reportes.ver_todos", "reportes.asignar", "reportes.resolver", "reportes.reclasificar",
                            "usuarios.gestionar", "dispositivos.propios"]}
    reportes = [{"id": 2, "titulo": "Cámara caída", "descripcion": "d", "estado": "pendiente", "prioridad": "critica",
                 "createdAt": "2026-10-23T10:00:00Z", "operadorAsignadoId": None}]
    inicio = v.VistaInicio(ClienteCentinela(SERVIDOR), usuario)
    inicio._con_reportes(reportes)
    inicio.en_vivo([{"id": 9, "nombre": "n1", "estado": "en_linea"}], [])
    assert "crítico" in inicio.banda_texto.text() and inicio.lista_atencion.count() == 1

    rep = v.VistaReportes(ClienteCentinela(SERVIDOR), usuario)
    rep._con_operadores_y_reportes(([{"id": 7, "nombre": "Op", "rol": {"nombre": "Operador"}, "_count": {"reportesAsignados": 3}}], reportes))
    assert rep.tabla.rowCount() == 1 and rep.f_asignado.count() == 3
    rep.tabla.selectRow(0)
    assert rep.detalle.actual == 2
    rep.f_estado.setCurrentIndex(2)  # Resueltos: el elegido deja de verse y el detalle se vacía
    assert rep.tabla.rowCount() == 0 and rep.detalle.actual is None


def test_respuesta_a_alarmas_estado_y_linea():
    from datetime import datetime, timezone
    from centinela_desktop.vistas import duracion, estado_respuesta, linea_respuesta, vencido

    ahora = datetime(2026, 10, 24, 10, 10, tzinfo=timezone.utc)
    critica = {"estado": "pendiente", "prioridad": "critica", "createdAt": "2026-10-24T10:00:00Z"}
    assert vencido(critica, ahora) and estado_respuesta(critica, ahora)[0] == "Vencido"
    assert not vencido({**critica, "prioridad": "media"}, ahora)
    atendido = {**critica, "atendidoEn": "2026-10-24T10:03:00Z", "atendidoPor": {"nombre": "Ana"}, "escaladoEn": "x"}
    assert estado_respuesta(atendido, ahora)[0] == "En atención"
    assert linea_respuesta(atendido) == "Atendido por Ana en 3 min · escalado"
    cerrado = {**atendido, "estado": "resuelto", "motivoCierre": "falsa_alarma", "resueltoEn": "2026-10-24T12:05:00Z"}
    assert linea_respuesta(cerrado) == "Atendido por Ana en 3 min · Cerrado como Falsa alarma · resuelto en 2 h 5 min"
    assert duracion("2026-10-24T10:00:00Z", "2026-10-25T14:00:00Z") == "1 d 4 h"


@respx.mock
def test_atender_y_cerrar_con_motivo():
    c = ClienteCentinela(SERVIDOR)
    patch = respx.patch(f"{SERVIDOR}/api/reportes/7").mock(return_value=httpx.Response(200, json={"id": 7}))
    c.atender_reporte(7)
    assert patch.calls.last.request.content == b'{"atender":true}'
    c.resolver_reporte(7, "prueba")
    assert patch.calls.last.request.content == b'{"resolver":true,"motivoCierre":"prueba"}'


def test_describir_armado_por_pi():
    from centinela_desktop.vistas_gestion import describir_armado, leer_horario

    noche = '{"dias": [5, 1, 2], "desde": "22:00", "hasta": "07:00"}'
    assert describir_armado({"modoArmado": "desarmado"}) == "Desarmado"
    assert describir_armado({"modoArmado": "horario", "horarioArmado": noche, "armadoAhora": True}) == "Por horario: Lun Mar Vie 22:00–07:00 · ahora armado"
    assert describir_armado({"modoArmado": "horario", "horarioArmado": "{roto"}) == "Por horario (sin horario válido) · armado"
    assert describir_armado({"modoArmado": "desarmado", "vacacionesHasta": "2999-01-02T05:59:59Z"}).startswith("Modo vacaciones hasta")
    assert describir_armado({"modoArmado": "desarmado", "vacacionesHasta": "2000-01-01T00:00:00Z"}) == "Desarmado"
    assert leer_horario(None) is None and leer_horario('{"dias": []}') is None


@respx.mock
def test_armar_gateway():
    c = ClienteCentinela(SERVIDOR)
    patch = respx.patch(f"{SERVIDOR}/api/edge/gateways/3").mock(return_value=httpx.Response(200, json={"id": 3, "armadoAhora": False}))
    assert c.armar_gateway(3, {"modoArmado": "desarmado"})["armadoAhora"] is False
    assert patch.calls.last.request.content == b'{"modoArmado":"desarmado"}'


@respx.mock
def test_login_con_dos_pasos():
    c = ClienteCentinela(SERVIDOR)
    respx.post(f"{SERVIDOR}/api/login").mock(return_value=httpx.Response(200, json={"requiere2fa": True, "desafio": "d1"}))
    assert c.iniciar_sesion("a@b.c", "x") == {"requiere2fa": True, "desafio": "d1"}
    assert not c.con_sesion
    paso2 = respx.post(f"{SERVIDOR}/api/login/2fa").mock(return_value=httpx.Response(
        200, json={"user": {"id": 1}}, headers={"set-cookie": "token=abc; Path=/; HttpOnly"}))
    assert c.verificar_codigo("d1", "123456") == {"id": 1}
    assert paso2.calls.last.request.content == b'{"desafio":"d1","codigo":"123456"}'
    respx.post(f"{SERVIDOR}/api/login/2fa").mock(return_value=httpx.Response(400, json={"error": "El paso de verificación venció."}))
    with pytest.raises(ErrorCentinela) as e:
        c.verificar_codigo("d1", "123456")
    assert e.value.estado == 400 and "venció" in str(e.value)


@respx.mock
def test_evidencia_descarga_la_foto():
    c = ClienteCentinela(SERVIDOR)
    respx.get(f"{SERVIDOR}/api/evidencia/e1").mock(return_value=httpx.Response(200, content=b"\xff\xd8\xff"))
    assert c.evidencia("e1") == b"\xff\xd8\xff"
    respx.get(f"{SERVIDOR}/api/evidencia/e2").mock(return_value=httpx.Response(404, json={"error": "No encontrada"}))
    with pytest.raises(ErrorCentinela):
        c.evidencia("e2")

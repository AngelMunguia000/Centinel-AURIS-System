"""Cliente de la API de la web de Centinela. Sin Qt: se prueba con respx.

La sesión es la cookie `token` que pone POST /api/login; httpx la guarda y la manda sola, como el navegador.
"""
from __future__ import annotations

from typing import Any, Callable, Iterator

import httpx

from .config import MARCA_UA

Datos = dict[str, Any]


class ErrorCentinela(Exception):
    """La web respondió con error o no se pudo conectar; `str(e)` es un mensaje para el usuario."""

    def __init__(self, mensaje: str, estado: int | None = None) -> None:
        super().__init__(mensaje)
        self.estado = estado


class ClienteCentinela:
    def __init__(self, servidor: str, transport: httpx.BaseTransport | None = None) -> None:
        self.servidor = servidor
        # Lo fija main.py: se llama (desde cualquier hilo) cuando la web dice 401 a una sesión que existía.
        self.al_expirar: Callable[[], None] | None = None
        self._stream: httpx.Response | None = None  # el stream abierto, para poder cortarlo desde otro hilo
        self._http = httpx.Client(
            base_url=servidor, timeout=10.0, transport=transport, headers={"User-Agent": MARCA_UA}
        )

    # --- sesión
    @property
    def token(self) -> str | None:
        return self._http.cookies.get("token")

    @property
    def con_sesion(self) -> bool:
        return self.token is not None

    def fijar_sesion(self, token: str | None) -> None:
        self._http.cookies.clear()
        if token:
            self._http.cookies.set("token", token)

    def iniciar_sesion(self, email: str, password: str) -> Datos:
        """El usuario, o {requiere2fa, desafio} si la cuenta tiene verificación en dos pasos."""
        datos = self._pedir("POST", "/api/login", json={"email": email, "password": password}, al_401="Correo o contraseña incorrectos.")
        if datos.get("requiere2fa"):
            return {"requiere2fa": True, "desafio": datos.get("desafio")}
        if not self.con_sesion:
            raise ErrorCentinela("El servidor no abrió la sesión.")
        return datos.get("user", {})

    def verificar_codigo(self, desafio: str, codigo: str) -> Datos:
        """Segundo paso del login: código de la app o de respaldo."""
        datos = self._pedir("POST", "/api/login/2fa", json={"desafio": desafio, "codigo": codigo}, al_401="Código incorrecto.")
        if not self.con_sesion:
            raise ErrorCentinela("El servidor no abrió la sesión.")
        return datos.get("user", {})

    # --- seguridad de la cuenta (sesiones activas y verificación en dos pasos)
    def sesiones(self) -> list[Datos]:
        return self._pedir("GET", "/api/perfil/sesiones").get("sesiones", [])

    def cerrar_sesion_remota(self, sesion_id: str) -> Datos:
        return self._pedir("DELETE", f"/api/perfil/sesiones/{sesion_id}")

    def cerrar_otras_sesiones(self) -> Datos:
        return self._pedir("POST", "/api/perfil/sesiones/cerrar-otras")

    def estado_2fa(self) -> Datos:
        """{activo, activadoEn, codigosRestantes}"""
        return self._pedir("GET", "/api/perfil/2fa")

    def cerrar_sesion(self) -> None:
        try:
            self._http.post("/api/logout")
        except httpx.HTTPError:
            pass  # la sesión local se borra igual
        self._http.cookies.clear()

    # --- llamadas
    def _pedir(self, metodo: str, ruta: str, al_401: str = "Tu sesión expiró. Vuelve a iniciar sesión.", **kw: Any) -> Datos:
        try:
            res = self._http.request(metodo, ruta, **kw)
        except httpx.HTTPError as e:
            raise ErrorCentinela("No se pudo conectar con el servidor de Centinela.") from e
        es_json = res.headers.get("content-type", "").startswith("application/json")
        datos = res.json() if es_json else {}
        if res.status_code == 401:
            self._expiro()
            raise ErrorCentinela(al_401, 401)
        if res.is_error:
            raise ErrorCentinela((datos.get("error") if isinstance(datos, dict) else None) or f"La web respondió {res.status_code}.", res.status_code)
        return datos

    def _expiro(self) -> None:
        # Solo si había sesión: un 401 del login (contraseña mala) no es una sesión vencida.
        if self.con_sesion and self.al_expirar:
            self.al_expirar()

    def yo(self) -> Datos:
        return self._pedir("GET", "/api/me").get("user", {})

    def notificaciones(self) -> list[Datos]:
        return self._pedir("GET", "/api/notificaciones").get("notificaciones", [])

    def marcar_leida(self, notificacion_id: int) -> None:
        self._pedir("PATCH", f"/api/notificaciones/{notificacion_id}")

    def leer_todas(self) -> None:
        self._pedir("POST", "/api/notificaciones/leer-todas")

    def eventos(self, limite: int = 50) -> list[Datos]:
        return self._pedir("GET", "/api/edge/eventos", params={"limite": limite}).get("eventos", [])

    def reportes(self) -> list[Datos]:
        datos = self._pedir("GET", "/api/reportes")
        return datos if isinstance(datos, list) else datos.get("reportes", [])

    def stats_reportes(self) -> Datos:
        return self._pedir("GET", "/api/reportes/stats")

    def crear_reporte(self, titulo: str, descripcion: str, prioridad: str, categoria: str | None) -> Datos:
        cuerpo = {"titulo": titulo, "descripcion": descripcion, "prioridad": prioridad, "categoria": categoria}
        return self._pedir("POST", "/api/reportes", json=cuerpo)

    def asignar_reporte(self, reporte_id: int, operador_id: int | None) -> Datos:
        return self.actualizar_reporte(reporte_id, {"operadorAsignadoId": operador_id})

    def actualizar_reporte(self, reporte_id: int, cambios: Datos) -> Datos:
        """PATCH con cualquiera de prioridad, categoria u operadorAsignadoId (cada uno con su permiso en la web)."""
        return self._pedir("PATCH", f"/api/reportes/{reporte_id}", json=cambios)

    def comentarios(self, reporte_id: int) -> list[Datos]:
        return self._pedir("GET", f"/api/reportes/{reporte_id}/comentarios")  # type: ignore[return-value]

    def comentar(self, reporte_id: int, contenido: str) -> Datos:
        return self._pedir("POST", f"/api/reportes/{reporte_id}/comentarios", json={"contenido": contenido})

    def historial(self, reporte_id: int) -> list[Datos]:
        return self._pedir("GET", f"/api/reportes/{reporte_id}/historial")  # type: ignore[return-value]

    def exportar_reportes(self) -> bytes:
        """El mismo CSV que descarga la web (GET /api/reportes/export)."""
        return self._bytes("/api/reportes/export")

    def evidencia(self, evento_id: str) -> bytes:
        """Foto JPEG de la cámara que abrió la incidencia (GET /api/evidencia/[id])."""
        return self._bytes(f"/api/evidencia/{evento_id}")

    def _bytes(self, ruta: str) -> bytes:
        try:
            res = self._http.get(ruta)
        except httpx.HTTPError as e:
            raise ErrorCentinela("No se pudo conectar con el servidor de Centinela.") from e
        if res.status_code == 401:
            self._expiro()
            raise ErrorCentinela("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
        if res.is_error:
            raise ErrorCentinela(f"La web respondió {res.status_code}.", res.status_code)
        return res.content

    def resolver_reporte(self, reporte_id: int, motivo: str | None = None) -> Datos:
        """motivo: real | falsa_alarma | prueba (lib/respuesta.ts de la web)."""
        if motivo is None:
            return self._pedir("PATCH", f"/api/reportes/{reporte_id}")
        return self._pedir("PATCH", f"/api/reportes/{reporte_id}", json={"resolver": True, "motivoCierre": motivo})

    def atender_reporte(self, reporte_id: int) -> Datos:
        """Acuse de recibo: el reporte pasa a 'en atención' sin resolverse."""
        return self._pedir("PATCH", f"/api/reportes/{reporte_id}", json={"atender": True})

    def comando(self, nodo_id: int, comando: Datos) -> Datos:
        """Mismo esquema que comandoSchema de la web. Devuelve {estado: ok|error|timeout, error?, latenciaMs}."""
        return self._pedir("POST", f"/api/edge/nodos/{nodo_id}/comandos", json=comando, timeout=15.0)

    def panico(self) -> int:
        """Abre una incidencia crítica y avisa a los responsables. Devuelve a cuántos se avisó."""
        return int(self._pedir("POST", "/api/panico").get("avisados", 0))

    # --- cuenta
    def actualizar_perfil(self, datos: Datos) -> Datos:
        return self._pedir("PATCH", "/api/perfil", json=datos)

    def cambiar_contrasena(self, actual: str, nueva: str) -> None:
        self._pedir("POST", "/api/perfil/password", json={"passwordActual": actual, "passwordNueva": nueva},
                    al_401="La contraseña actual es incorrecta.")

    # --- dispositivos (Raspberry Pi)
    def gateways(self) -> list[Datos]:
        return self._pedir("GET", "/api/edge/gateways").get("gateways", [])

    def vincular_gateway(self, nombre: str, url_base: str) -> Datos:
        """Devuelve la Pi creada con su `token`, que la web muestra una sola vez."""
        return self._pedir("POST", "/api/edge/gateways", json={"nombre": nombre, "urlBase": url_base})

    def revocar_gateway(self, gateway_id: int) -> None:
        self._pedir("DELETE", f"/api/edge/gateways/{gateway_id}")

    def armar_gateway(self, gateway_id: int, cambios: Datos) -> Datos:
        """cambios: modoArmado (armado|desarmado|horario), horario {dias, desde, hasta}, vacacionesHasta."""
        return self._pedir("PATCH", f"/api/edge/gateways/{gateway_id}", json=cambios)

    # --- administración
    def usuarios(self) -> list[Datos]:
        return self._pedir("GET", "/api/admin/usuarios").get("usuarios", [])

    def roles(self) -> list[Datos]:
        datos = self._pedir("GET", "/api/admin/roles")
        return datos if isinstance(datos, list) else datos.get("roles", [])

    def cambiar_rol(self, usuario_id: int, rol_id: int) -> Datos:
        return self._pedir("PATCH", f"/api/admin/usuarios/{usuario_id}", json={"rolId": rol_id})

    def eliminar_usuario(self, usuario_id: int) -> None:
        self._pedir("DELETE", f"/api/admin/usuarios/{usuario_id}")

    def permisos_usuario(self, usuario_id: int) -> Datos:
        """{rol, estados: {clave: defecto|otorgado|quitado}, porDefecto: [clave]}"""
        return self._pedir("GET", f"/api/admin/usuarios/{usuario_id}/permisos")

    def guardar_permisos(self, usuario_id: int, estados: dict[str, str]) -> Datos:
        return self._pedir("PUT", f"/api/admin/usuarios/{usuario_id}/permisos", json={"permisos": estados})

    def auditoria(self) -> list[Datos]:
        return self._pedir("GET", "/api/admin/auditoria").get("registros", [])

    def lineas_stream(self) -> Iterator[str]:
        """Líneas crudas de GET /api/stream (SSE). Lanza ErrorCentinela si no se puede abrir."""
        try:
            with self._http.stream("GET", "/api/stream", timeout=httpx.Timeout(10.0, read=30.0)) as res:
                self._stream = res
                if res.status_code == 401:
                    self._expiro()
                    raise ErrorCentinela("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
                if res.status_code == 403:
                    raise ErrorCentinela("Esta cuenta no gestiona nodos.", 403)
                if res.is_error:
                    raise ErrorCentinela(f"El stream respondió {res.status_code}.", res.status_code)
                yield from res.iter_lines()
        except (httpx.HTTPError, httpx.StreamClosed) as e:
            raise ErrorCentinela("Se perdió la conexión en vivo.") from e
        finally:
            self._stream = None

    def cortar_stream(self) -> None:
        """Cierra el stream en curso: la lectura bloqueada (hasta 30 s) termina al instante."""
        if res := self._stream:
            try:
                res.close()
            except Exception:  # noqa: BLE001 — cerrando al salir, cualquier error da igual
                pass

    def cerrar(self) -> None:
        self._http.close()

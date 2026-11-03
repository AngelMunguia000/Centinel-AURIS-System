// La consola (login y vistas internas) solo se abre desde la app de escritorio o desde un teléfono;
// desde un navegador de computadora la web es solo la vitrina (decisión del PO, 2026-10-23).
// Spec: docs/diseno/2026-10-23-centinela-desktop-v02-design.md §9.
// shortcut: el User-Agent se puede falsificar; es separación de producto, no seguridad (la sesión y los
// permisos siguen protegiendo todo). Si algún día importa, usar un token de dispositivo.

export const MARCA_DESKTOP = "CentinelaDesktop/"

const RUTAS_CONSOLA = [
  "/iniciar-sesion", "/registrarse", "/dashboard", "/reportes", "/admin", "/operador",
  "/ajustes", "/bitacora", "/dispositivos", "/monitor", "/prototipo", "/vision", "/auris-chat",
]

export function esRutaConsola(pathname: string): boolean {
  return RUTAS_CONSOLA.some((r) => pathname === r || pathname.startsWith(r + "/"))
}

export function esClienteDeApp(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return userAgent.includes(MARCA_DESKTOP) || /Mobi|Android|iPhone|iPad/i.test(userAgent)
}

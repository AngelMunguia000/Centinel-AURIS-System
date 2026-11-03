import jwt from "jsonwebtoken"
import { prisma } from "./prisma"
import { permisosEfectivos, type Permiso } from "./permisos"

interface TokenPayload {
  userId: number
  email: string
  role: string
  // Fase 46: valor de Usuario.ultimoLogin capturado ANTES de sobrescribirlo en este
  // login — permite distinguir "nuevo desde la sesión anterior" durante toda esta
  // sesión, en vez de una base que cambiaría en cada recarga de página.
  ultimoLoginAnterior?: string | null
  // Sesiones activas (lib/sesiones.ts): id de la fila Sesion; sin él el token no vale.
  sid?: string
}

/**
 * Interfaz mínima que satisfacen tanto `NextRequest.cookies` (Route Handlers)
 * como el resultado de `cookies()` de `next/headers` (Server Components) —
 * ambos exponen `.get(name)` con esta misma forma. Permite una única
 * estrategia de identidad válida en los dos contextos, sin simular ninguno.
 */
interface CookieJar {
  get(name: string): { value?: string } | undefined
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error(
      "JWT_SECRET no está configurado. La aplicación no puede firmar ni verificar identidad de forma segura."
    )
  }
  return secret
}

export function signToken(payload: TokenPayload, expiresIn: jwt.SignOptions["expiresIn"] = "1h"): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

/**
 * Única fuente de verdad de identidad y Rol, válida tanto en Route Handlers
 * (pasar `request.cookies`) como en Server Components (pasar `await cookies()`
 * de `next/headers`) (17§4.1, 19§3.2). Devuelve la Cuenta autenticada (con su
 * Rol) o null si no hay identidad válida.
 */
export async function getAuthenticatedUsuario(cookieJar: CookieJar) {
  const token = cookieJar.get("token")?.value
  if (!token) return null

  let decoded: TokenPayload
  try {
    decoded = jwt.verify(token, getJwtSecret()) as TokenPayload
  } catch {
    return null
  }

  // Un token sin sesión (emitido antes de las sesiones activas) se rechaza: obliga a entrar
  // de nuevo una vez, pero ningún token queda fuera del alcance de "cerrar sesión a distancia".
  if (!decoded.sid) return null

  let usuario
  try {
    const sesion = await prisma.sesion.findUnique({
      where: { id: decoded.sid },
      include: { usuario: { include: { rol: true, permisosCuenta: { select: { permiso: true, otorgado: true } } } } },
    })
    const ahora = Date.now()
    if (!sesion || sesion.revocadaEn || sesion.expiraEn.getTime() <= ahora || sesion.usuarioId !== decoded.userId) return null
    usuario = sesion.usuario
    // Se anota la actividad como mucho cada 5 min: no una escritura por request.
    if (ahora - sesion.ultimaActividad.getTime() > 5 * 60_000) {
      await prisma.sesion.update({ where: { id: sesion.id }, data: { ultimaActividad: new Date(ahora) } })
    }
  } catch (error) {
    // Falla cerrado, igual que el catch de jwt.verify arriba: un hiccup
    // transitorio de la base de datos durante la verificación de identidad
    // no debe propagarse sin capturar por todo el árbol de rutas protegidas
    // que dependen de esta función (AUD2-01, auditoría integral 26 ago).
    console.error("Error verificando identidad:", error)
    return null
  }
  if (!usuario) return null

  // 06_UI_UX.md §F: permisos efectivos calculados una sola vez por request.
  const permisos = permisosEfectivos(usuario.rol.nombre, usuario.permisosCuenta)
  return { ...usuario, permisos, ultimoLoginAnterior: decoded.ultimoLoginAnterior ?? null, sesionId: decoded.sid }
}

type RequireRoleResult =
  | { authorized: true; usuario: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUsuario>>>; reason: null }
  | { authorized: false; usuario: null; reason: "no_autenticado" }
  | { authorized: false; usuario: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUsuario>>>; reason: "no_autorizado" }

/**
 * Verifica identidad y, sobre el Rol persistido de esa Cuenta (nunca por correo
 * ni por ningún otro criterio), si pertenece a `allowedRoles` (16§7.2, 17§6.1, 19§6.1).
 */
export async function requireRole(cookieJar: CookieJar, allowedRoles: string[]): Promise<RequireRoleResult> {
  const usuario = await getAuthenticatedUsuario(cookieJar)
  if (!usuario) {
    return { authorized: false, usuario: null, reason: "no_autenticado" }
  }
  if (!allowedRoles.includes(usuario.rol.nombre)) {
    return { authorized: false, usuario, reason: "no_autorizado" }
  }
  return { authorized: true, usuario, reason: null }
}

/**
 * Como requireRole, pero sobre permisos efectivos (06_UI_UX.md §F). Con un
 * array basta con tener cualquiera. requireRole se conserva solo para lo que
 * es identidad, no capacidad (p. ej. la cola de /operador).
 */
export async function requirePermiso(
  cookieJar: CookieJar,
  permiso: Permiso | Permiso[]
): Promise<RequireRoleResult> {
  const usuario = await getAuthenticatedUsuario(cookieJar)
  if (!usuario) {
    return { authorized: false, usuario: null, reason: "no_autenticado" }
  }
  const requeridos = Array.isArray(permiso) ? permiso : [permiso]
  if (!requeridos.some((p) => usuario.permisos.has(p))) {
    return { authorized: false, usuario, reason: "no_autorizado" }
  }
  return { authorized: true, usuario, reason: null }
}

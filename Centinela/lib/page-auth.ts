import { cookies } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { getAuthenticatedUsuario } from "@/lib/auth"
import type { Permiso, RolNombre } from "@/lib/permisos"

export type { RolNombre } from "@/lib/permisos"

/**
 * Identidad de la Cuenta para Server Components de página (`cookies()` de
 * `next/headers`). Devuelve null si no hay sesión válida o si falla la
 * verificación — el llamador decide el redirect. Antes cada página
 * (`/dashboard`, `/reportes`) tenía su propia copia de esta función.
 */
export async function getPageUser() {
  try {
    const cookieStore = await cookies()
    const usuario = await getAuthenticatedUsuario(cookieStore)

    if (!usuario) {
      return null
    }

    return {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      ultimoLoginAnterior: usuario.ultimoLoginAnterior,
      role: usuario.rol.nombre as RolNombre,
      permisos: Array.from(usuario.permisos) as Permiso[],
    }
  } catch (error) {
    // La sonda de render estático de Next llega como error: hay que devolvérsela, no registrarla.
    unstable_rethrow(error)
    console.error("Error getting user:", error)
    return null
  }
}

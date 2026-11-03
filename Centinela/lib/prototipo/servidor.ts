import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUsuario } from '@/lib/auth'

// Solo servidor. Límites de los endpoints de simulación (spec §8).
export const LIMITE_EVENTOS_15MIN = 30
export const LIMITE_ESTADO_15MIN = 600
export const LIMITE_REPORTES_SIMULADOS = 50

type UsuarioAuth = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUsuario>>>

// Mismo patrón de 401/403 que el resto de la API: usar `'error' in auth` para discriminar.
// Nombre histórico: ya no exige rol Admin sino el permiso prototipo.ejecutar.
export async function autenticarAdmin(
  request: NextRequest,
): Promise<{ usuario: UsuarioAuth } | { error: NextResponse }> {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  // 06_UI_UX.md §F: permiso prototipo.ejecutar (por defecto solo Admin).
  if (!usuario.permisos.has('prototipo.ejecutar')) {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }
  return { usuario }
}

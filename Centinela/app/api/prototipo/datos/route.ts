import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PREFIJO_SIMULADO, PREFIJO_UID_SIMULADO } from '@/lib/prototipo/eventos'
import { autenticarAdmin } from '@/lib/prototipo/servidor'

// Limpia lo simulado. Solo toca reportes y dispositivos SIM- con el prefijo y
// creados por un Admin o por quien ejecuta la limpieza (06_UI_UX.md §F:
// prototipo.ejecutar puede otorgarse a un no-Admin): un usuario común que use
// el mismo texto, sin ser el autor, queda a salvo.
export async function DELETE(request: NextRequest) {
  const auth = await autenticarAdmin(request)
  if ('error' in auth) return auth.error

  try {
    const reportes = await prisma.reporte.findMany({
      where: {
        titulo: { startsWith: PREFIJO_SIMULADO },
        OR: [{ usuario: { rol: { nombre: 'Admin' } } }, { usuarioId: auth.usuario.id }],
      },
      select: { id: true },
    })
    const ids = reportes.map((r) => r.id)

    await prisma.$transaction([
      prisma.historialReporte.deleteMany({ where: { reporteId: { in: ids } } }),
      prisma.comentario.deleteMany({ where: { reporteId: { in: ids } } }),
      prisma.notificacion.deleteMany({ where: { reporteId: { in: ids } } }),
      prisma.reporte.deleteMany({ where: { id: { in: ids } } }),
      prisma.dispositivo.deleteMany({
        where: {
          uid: { startsWith: PREFIJO_UID_SIMULADO },
          OR: [{ usuario: { rol: { nombre: 'Admin' } } }, { usuarioId: auth.usuario.id }],
        },
      }),
    ])

    return NextResponse.json({ reportesEliminados: ids.length })
  } catch (error) {
    console.error('Error al limpiar los datos simulados:', error)
    return NextResponse.json({ error: 'Error al limpiar los datos simulados' }, { status: 500 })
  }
}

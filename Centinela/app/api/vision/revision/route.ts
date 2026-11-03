import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { filtroNodos } from '@/lib/edge/resumen'
import { TIPOS_CAMARA, metricasVision } from '@/lib/edge/revision'

const LIMITE = 200

// Fotos de cámara para revisar (más nuevas primero) y las métricas sobre TODAS las ya revisadas.
export async function GET(request: NextRequest) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, 'vision.revisar')
  if (!authorized) {
    return NextResponse.json(
      { error: reason === 'no_autenticado' ? 'No autenticado' : 'Acceso denegado' },
      { status: reason === 'no_autenticado' ? 401 : 403 },
    )
  }

  const where = { tipo: { in: [...TIPOS_CAMARA] }, evidencia: { not: null }, dispositivo: filtroNodos(usuario) }
  const [filas, revisadas, pendientes] = await Promise.all([
    prisma.eventoDispositivo.findMany({
      where,
      include: { dispositivo: { select: { nombre: true } } },
      orderBy: { ocurridoEn: 'desc' },
      take: LIMITE,
    }),
    prisma.eventoDispositivo.findMany({ where: { ...where, revision: { not: null } }, select: { tipo: true, revision: true } }),
    prisma.eventoDispositivo.count({ where: { ...where, revision: null } }),
  ])

  return NextResponse.json({
    metricas: metricasVision(revisadas),
    pendientes,
    fotos: filas.map((e) => ({
      id: e.id,
      tipo: e.tipo,
      detalle: e.detalle,
      dispositivoNombre: e.dispositivo.nombre,
      ocurridoEn: e.ocurridoEn.toISOString(),
      revision: e.revision,
    })),
  })
}

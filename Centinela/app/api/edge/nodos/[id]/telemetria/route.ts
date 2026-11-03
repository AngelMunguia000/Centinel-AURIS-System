import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { historialDe } from '@/lib/edge/historial'

// Historial de telemetría de un nodo (?horas=24, máximo un año). Misma regla de dueño que video y comandos.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, ['dispositivos.propios', 'dispositivos.otros'])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }
  const id = Number((await params).id)
  const nodo = Number.isInteger(id) ? await prisma.dispositivo.findUnique({ where: { id }, select: { usuarioId: true } }) : null
  if (!nodo || (nodo.usuarioId !== usuario.id && !usuario.permisos.has('dispositivos.otros'))) {
    return NextResponse.json({ error: 'Nodo no encontrado' }, { status: 404 })
  }
  const pedido = Number(request.nextUrl.searchParams.get('horas') ?? 24)
  const horas = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 24 * 365) : 24
  return NextResponse.json(await historialDe(id, horas))
}

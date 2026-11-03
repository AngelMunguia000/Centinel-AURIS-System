import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { idValido } from '@/lib/edge/evidencia'
import { filtroNodos } from '@/lib/edge/resumen'
import { TIPOS_CAMARA, esRevision } from '@/lib/edge/revision'

// Marca (o desmarca con null) si en la foto había un objetivo. Ajeno o inexistente = 404.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, 'vision.revisar')
  if (!authorized) {
    return NextResponse.json(
      { error: reason === 'no_autenticado' ? 'No autenticado' : 'Acceso denegado' },
      { status: reason === 'no_autenticado' ? 401 : 403 },
    )
  }

  const { eventoId } = await params
  const cuerpo = await request.json().catch(() => null)
  const revision = cuerpo?.revision
  if (revision !== null && !esRevision(revision)) {
    return NextResponse.json({ error: 'revision debe ser "objetivo", "nada" o null' }, { status: 400 })
  }
  if (!idValido(eventoId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { count } = await prisma.eventoDispositivo.updateMany({
    where: { id: eventoId, tipo: { in: [...TIPOS_CAMARA] }, evidencia: { not: null }, dispositivo: filtroNodos(usuario) },
    data: { revision },
  })
  if (count === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true, revision })
}

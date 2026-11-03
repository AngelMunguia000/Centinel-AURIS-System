import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autenticarGateway } from '@/lib/edge/token'
import { EVIDENCIA_MAX_BYTES, esJpeg, guardarEvidencia, idValido } from '@/lib/edge/evidencia'

// La Pi sube la foto de un evento (edge/pi-gateway application/camaras.py). 404 mientras el evento
// no haya llegado por la cola: la Pi reintenta. Solo eventos de nodos de esta misma Pi.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  const auth = await autenticarGateway(request)
  if ('error' in auth) return auth.error

  const { eventoId } = await params
  if (!idValido(eventoId)) return NextResponse.json({ error: 'Id de evento inválido' }, { status: 400 })
  if (request.headers.get('content-type') !== 'image/jpeg') {
    return NextResponse.json({ error: 'Se espera image/jpeg' }, { status: 415 })
  }
  if (Number(request.headers.get('content-length') ?? 0) > EVIDENCIA_MAX_BYTES) {
    return NextResponse.json({ error: 'La foto pasa de 2 MB' }, { status: 413 })
  }

  const evento = await prisma.eventoDispositivo.findUnique({ where: { id: eventoId }, select: { dispositivo: { select: { gatewayId: true } } } })
  if (!evento || evento.dispositivo.gatewayId !== auth.gateway.id) {
    return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 })
  }

  const jpeg = new Uint8Array(await request.arrayBuffer())
  if (jpeg.length > EVIDENCIA_MAX_BYTES) return NextResponse.json({ error: 'La foto pasa de 2 MB' }, { status: 413 })
  if (!esJpeg(jpeg)) return NextResponse.json({ error: 'No es un JPEG' }, { status: 400 })

  const archivo = await guardarEvidencia(eventoId, jpeg)
  await prisma.eventoDispositivo.update({ where: { id: eventoId }, data: { evidencia: archivo } })
  return NextResponse.json({ ok: true })
}

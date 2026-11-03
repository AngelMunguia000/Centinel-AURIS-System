import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'

// Video en vivo de la cámara de un nodo (Monitor): navegador → web → Pi → nodo. El nodo nunca queda
// expuesto y se aplica la misma regla de dueño que a los comandos (app/api/edge/nodos/[id]/comandos).
// Es MJPEG: un <img> lo reproduce tal cual, sin reproductor.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, ['dispositivos.propios', 'dispositivos.otros'])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }

  const id = Number((await params).id)
  const nodo = Number.isInteger(id) ? await prisma.dispositivo.findUnique({ where: { id }, include: { gateway: true } }) : null
  if (!nodo || (nodo.usuarioId !== usuario.id && !usuario.permisos.has('dispositivos.otros'))) {
    return NextResponse.json({ error: 'Nodo no encontrado' }, { status: 404 })
  }
  if (!nodo.gateway || !nodo.nodeId || nodo.gateway.revocadoEn) {
    return NextResponse.json({ error: 'El nodo no tiene una Raspberry Pi vinculada activa' }, { status: 409 })
  }

  let res: Response
  try {
    // request.signal: si el usuario cierra el Monitor, se corta también la conexión con la Pi.
    res = await fetch(`${nodo.gateway.urlBase}/v1/camaras/${nodo.nodeId}/stream`, {
      headers: { authorization: `Bearer ${nodo.gateway.tokenHash}` },
      signal: request.signal,
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ error: 'No hay conexión con la Pi' }, { status: 502 })
  }
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'La cámara no responde' }, { status: 502 })
  }
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'multipart/x-mixed-replace',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

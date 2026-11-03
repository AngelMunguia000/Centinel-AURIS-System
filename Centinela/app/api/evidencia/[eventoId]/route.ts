import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { idValido, leerEvidencia } from '@/lib/edge/evidencia'
import { filtroNodos, veDispositivos } from '@/lib/edge/resumen'

// Foto de evidencia de un evento. La ve quien ve ese evento en la Bitácora (dueño del nodo o
// dispositivos.otros) y quien atiende incidencias (reportes.ver_todos). Ajena = 404, no revela que existe.
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { eventoId } = await params
  if (!idValido(eventoId)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const puedeVerTodo = usuario.permisos.has('reportes.ver_todos')
  if (!puedeVerTodo && !veDispositivos(usuario)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const evento = await prisma.eventoDispositivo.findFirst({
    where: { id: eventoId, ...(puedeVerTodo ? {} : { dispositivo: filtroNodos(usuario) }) },
    select: { evidencia: true },
  })
  const jpeg = evento?.evidencia ? await leerEvidencia(evento.evidencia) : null
  if (!jpeg) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return new NextResponse(new Uint8Array(jpeg), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  })
}

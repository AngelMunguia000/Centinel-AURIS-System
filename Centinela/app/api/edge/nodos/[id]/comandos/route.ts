import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from '@/lib/rate-limit'
import { comandoSchema } from '@/lib/edge/contrato'
import { enviarComando } from '@/lib/edge/comandos'

// Spec 2026-10-16-enlace-edge-design.md §4.3 y §7. Cierra el bloqueante 5 de la
// auditoría 2026-10-08: el dueño del nodo se valida en el servidor en cada comando.
const MAX_COMANDOS = 120

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, ['dispositivos.propios', 'dispositivos.otros'])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }

  const id = Number((await params).id)
  const nodo = Number.isInteger(id) ? await prisma.dispositivo.findUnique({ where: { id }, include: { gateway: true } }) : null
  // Ajeno sin dispositivos.otros responde igual que inexistente: no revela que existe.
  if (!nodo || (nodo.usuarioId !== usuario.id && !usuario.permisos.has('dispositivos.otros'))) {
    return NextResponse.json({ error: 'Nodo no encontrado' }, { status: 404 })
  }
  if (!nodo.gateway || !nodo.nodeId || nodo.gateway.revocadoEn) {
    return NextResponse.json({ error: 'El nodo no tiene una Raspberry Pi vinculada activa' }, { status: 409 })
  }

  const limiteId = getRateLimitIdentifier('edge-comando', request, String(usuario.id))
  const limite = checkRateLimit(limiteId, MAX_COMANDOS)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }, { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } })
  }
  recordAttempt(limiteId)

  const parsed = comandoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Comando inválido', detalles: parsed.error.issues }, { status: 400 })
  }

  const resultado = await enviarComando({
    dispositivo: { id: nodo.id, nodeId: nodo.nodeId, gateway: nodo.gateway },
    usuarioId: usuario.id,
    comando: parsed.data,
  })
  return NextResponse.json(resultado)
}

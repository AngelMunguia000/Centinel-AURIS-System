import { NextRequest, NextResponse } from 'next/server'
import { autenticarGateway } from '@/lib/edge/token'
import { eventosLoteSchema } from '@/lib/edge/contrato'
import { registrarEventos, NodoAjenoError } from '@/lib/edge/ingesta'
import { eventosVisibles } from '@/lib/edge/resumen'
import { getAuthenticatedUsuario } from '@/lib/auth'

// GET (sesión de usuario): historial para la Bitácora, más nuevos primero (spec §6.3).
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const pedido = Number(request.nextUrl.searchParams.get('limite') ?? 50)
  const limite = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, 200) : 50
  return NextResponse.json(await eventosVisibles(usuario, limite))
}

// Spec 2026-10-16-enlace-edge-design.md §4.2: idempotente por id de evento, para la cola offline de la Pi.
export async function POST(request: NextRequest) {
  const auth = await autenticarGateway(request)
  if ('error' in auth) return auth.error

  const parsed = eventosLoteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contrato inválido', detalles: parsed.error.issues }, { status: 400 })
  }
  try {
    const { nuevos } = await registrarEventos(auth.gateway, parsed.data)
    return NextResponse.json({ ok: true, nuevos })
  } catch (error) {
    if (error instanceof NodoAjenoError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[edge] error al registrar eventos:', error)
    return NextResponse.json({ error: 'Error al registrar eventos' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { autenticarGateway } from '@/lib/edge/token'
import { telemetriaLoteSchema } from '@/lib/edge/contrato'
import { registrarTelemetria, NodoAjenoError } from '@/lib/edge/ingesta'
import { estaArmado } from '@/lib/edge/armado'

// Spec 2026-10-16-enlace-edge-design.md §4.2: la Pi lo llama cada 2 s (también es su latido).
export async function POST(request: NextRequest) {
  const auth = await autenticarGateway(request)
  if ('error' in auth) return auth.error

  const parsed = telemetriaLoteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Contrato inválido', detalles: parsed.error.issues }, { status: 400 })
  }
  try {
    await registrarTelemetria(auth.gateway, parsed.data)
    // La Pi se entera en cada latido (2 s) de si debe disuadir; no hace falta un comando aparte.
    return NextResponse.json({ ok: true, armado: estaArmado(auth.gateway) })
  } catch (error) {
    if (error instanceof NodoAjenoError) return NextResponse.json({ error: error.message }, { status: 403 })
    console.error('[edge] error al registrar telemetría:', error)
    return NextResponse.json({ error: 'Error al registrar telemetría' }, { status: 500 })
  }
}

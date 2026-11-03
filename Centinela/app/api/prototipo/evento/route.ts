import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordAttempt } from '@/lib/rate-limit'
import { EVENTOS, PREFIJO_SIMULADO, esCodigoEvento } from '@/lib/prototipo/eventos'
import { LIMITE_EVENTOS_15MIN, LIMITE_REPORTES_SIMULADOS, autenticarAdmin } from '@/lib/prototipo/servidor'

// Simulación del prototipo (spec 2026-09-21-prototipo-fisico-design.md §8): el cliente
// solo elige un `codigo` de una lista cerrada; título, prioridad y categoría los decide
// el servidor, así el prefijo [SIMULADO] no depende del cliente.
export async function POST(request: NextRequest) {
  const auth = await autenticarAdmin(request)
  if ('error' in auth) return auth.error
  const { usuario } = auth

  const identificador = `prototipo-evento:${usuario.id}`
  const limite = checkRateLimit(identificador, LIMITE_EVENTOS_15MIN)
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'Demasiados eventos simulados. Espera un momento.', retryAfterSeconds: limite.retryAfterSeconds },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { codigo, estadoFsm } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>

  if (!esCodigoEvento(codigo)) {
    return NextResponse.json({ error: 'Código de evento inválido' }, { status: 400 })
  }
  if (typeof estadoFsm !== 'string' || !/^[A-Z_]{1,32}$/.test(estadoFsm)) {
    return NextResponse.json({ error: 'estadoFsm inválido' }, { status: 400 })
  }

  recordAttempt(identificador)

  try {
    const pendientes = await prisma.reporte.count({
      where: { titulo: { startsWith: PREFIJO_SIMULADO }, estado: 'pendiente' },
    })
    if (pendientes >= LIMITE_REPORTES_SIMULADOS) {
      return NextResponse.json(
        { error: 'Hay demasiados reportes simulados pendientes. Limpia los datos simulados.' },
        { status: 409 },
      )
    }

    const def = EVENTOS[codigo]
    const operadores = await prisma.usuario.findMany({
      where: { rol: { nombre: 'Operador' } },
      select: { id: true },
    })

    const reporte = await prisma.$transaction(async (tx) => {
      const creado = await tx.reporte.create({
        data: {
          titulo: `${PREFIJO_SIMULADO} ${def.titulo}`,
          descripcion: `${def.descripcion}\n\nEstado de la FSM: ${estadoFsm}. Severidad ${def.severidad}. Evento generado por la simulación del prototipo.`,
          prioridad: def.prioridad,
          categoria: def.categoria,
          usuarioId: usuario.id,
        },
      })
      if (operadores.length > 0) {
        await tx.notificacion.createMany({
          data: operadores.map((o) => ({
            destinatarioId: o.id,
            mensaje: `Prototipo (simulado): ${def.titulo}`,
            reporteId: creado.id,
          })),
        })
      }
      return creado
    })

    return NextResponse.json({ reporteId: reporte.id }, { status: 201 })
  } catch (error) {
    console.error('Error al guardar el evento simulado:', error)
    return NextResponse.json({ error: 'Error al guardar el evento' }, { status: 500 })
  }
}

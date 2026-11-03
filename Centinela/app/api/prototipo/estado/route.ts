import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CONEXIONES_VALIDAS, type ConexionDispositivo } from '@/lib/dispositivos-ejemplos'
import { checkRateLimit, recordAttempt } from '@/lib/rate-limit'
import { uidDispositivoSimulado } from '@/lib/prototipo/eventos'
import { LIMITE_ESTADO_15MIN, autenticarAdmin } from '@/lib/prototipo/servidor'

// Refleja el estado de la FSM en un único Dispositivo simulado por Admin.
export async function PUT(request: NextRequest) {
  const auth = await autenticarAdmin(request)
  if ('error' in auth) return auth.error
  const { usuario } = auth

  const identificador = `prototipo-estado:${usuario.id}`
  const limite = checkRateLimit(identificador, LIMITE_ESTADO_15MIN)
  if (!limite.allowed) {
    return NextResponse.json({ error: 'Demasiadas actualizaciones', retryAfterSeconds: limite.retryAfterSeconds }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }
  const { conexion, estadoFsm } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>

  if (typeof conexion !== 'string' || !(CONEXIONES_VALIDAS as string[]).includes(conexion)) {
    return NextResponse.json({ error: 'Conexión inválida' }, { status: 400 })
  }
  if (typeof estadoFsm !== 'string' || !/^[A-Z_]{1,32}$/.test(estadoFsm)) {
    return NextResponse.json({ error: 'estadoFsm inválido' }, { status: 400 })
  }

  recordAttempt(identificador)

  try {
    const uid = uidDispositivoSimulado(usuario.id)
    await prisma.dispositivo.upsert({
      where: { uid },
      create: {
        nombre: 'Centinel v2 (simulado)',
        uid,
        tipo: 'camara',
        conexion: conexion as ConexionDispositivo,
        bateria: null,
        variableLabel: 'Estado FSM',
        variableValor: estadoFsm,
        usuarioId: usuario.id,
      },
      update: { conexion, variableValor: estadoFsm },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error al actualizar el dispositivo simulado:', error)
    return NextResponse.json({ error: 'Error al actualizar el dispositivo' }, { status: 500 })
  }
}

import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { Gateway } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from '@/lib/rate-limit'

// Spec 2026-10-16-enlace-edge-design.md §5 y §7. El token es aleatorio de alta
// entropía, así que SHA-256 basta (bcrypt es para contraseñas elegidas por humanos).

export function generarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Entradas /api/edge/*: telemetría cada 2 s = 450 por ventana de 15 min, más eventos y reintentos.
const MAX_INGESTA = 1200

const noAutorizado = () => NextResponse.json({ error: 'Token de gateway inválido' }, { status: 401 })

export async function autenticarGateway(request: Request): Promise<{ gateway: Gateway } | { error: NextResponse }> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { error: noAutorizado() }

  const gateway = await prisma.gateway.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!gateway || gateway.revocadoEn) {
    // Nunca se registra el token: solo que hubo un intento.
    console.warn(`[edge] token de gateway ${gateway ? 'revocado' : 'desconocido'} rechazado`)
    return { error: noAutorizado() }
  }

  const id = getRateLimitIdentifier('edge-ingesta', request, String(gateway.id))
  const limite = checkRateLimit(id, MAX_INGESTA)
  if (!limite.allowed) {
    return {
      error: NextResponse.json(
        { error: 'Demasiadas solicitudes' },
        { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } },
      ),
    }
  }
  recordAttempt(id)
  return { gateway }
}

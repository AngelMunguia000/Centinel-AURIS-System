/**
 * Rate limiting en memoria, generalizado para POST /api/login, POST /api/forgot-password,
 * POST /api/register, POST /api/reset-password y POST /api/chat-auris. Parámetros por
 * defecto sin cambios respecto a la Fase 23: máximo 5 intentos por identificador, ventana
 * de 15 minutos. `checkRateLimit` acepta un `maxAttempts` opcional para acciones con un
 * perfil de uso distinto (Fase 36: chat-auris usa 20, ver ese route.ts). La ventana de 15
 * minutos es fija para todas las acciones. Ver Brain/21_ChangeRecoveryLog.md.
 *
 * Cada acción usa su propio espacio de nombres (prefijo `action:`) para que ninguna
 * comparta contador con otra.
 *
 * Limitación conocida: el contador vive en memoria del proceso Node — no se
 * comparte entre múltiples instancias/réplicas. Aceptable porque no existe
 * evidencia documentada de un despliegue multi-instancia para Centinela
 * (Brain/09_KnownIssues.md no lo menciona). Si eso cambia, esta estrategia
 * debe revisarse (Redis u otro almacén compartido), decisión que corresponde
 * al Product Owner, no a esta fase.
 */

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface AttemptRecord {
  count: number
  windowStart: number
}

const attempts = new Map<string, AttemptRecord>()

// Purga oportunista (Fase 30 — hallazgo P2 de la Fase 27: el Map crecía sin
// límite porque nada quitaba las entradas ya expiradas). Sin timers: cada
// SWEEP_INTERVAL_OPS llamadas a recordAttempt, se recorre el Map una vez y se
// eliminan las entradas vencidas. Evita tanto el crecimiento indefinido como
// el riesgo de acumular varios setInterval entre recargas de Next.js en dev.
const SWEEP_INTERVAL_OPS = 100
let opsSinceLastSweep = 0

function isExpired(record: AttemptRecord, now: number): boolean {
  return now - record.windowStart > WINDOW_MS
}

function sweepExpired(now: number): void {
  for (const [identifier, record] of attempts) {
    if (isExpired(record, now)) {
      attempts.delete(identifier)
    }
  }
}

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = MAX_ATTEMPTS,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const record = attempts.get(identifier)

  if (!record || isExpired(record, now)) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(0, Math.ceil((record.windowStart + WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfterSeconds }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function recordAttempt(identifier: string): void {
  const now = Date.now()
  const record = attempts.get(identifier)

  if (!record || isExpired(record, now)) {
    attempts.set(identifier, { count: 1, windowStart: now })
  } else {
    record.count += 1
  }

  opsSinceLastSweep += 1
  if (opsSinceLastSweep >= SWEEP_INTERVAL_OPS) {
    opsSinceLastSweep = 0
    sweepExpired(now)
  }
}

export function resetRateLimit(identifier: string): void {
  attempts.delete(identifier)
}

/**
 * Identifica al cliente por IP (headers de proxy estándar) combinada opcionalmente con
 * una clave adicional (ej. el correo intentado), separado por acción (`action`) para que
 * login/forgot-password/register no compartan contador. Sin `key`, el identificador es
 * solo `action:ip` (uso previsto: register, donde limitar por correo individual no protege
 * contra creación masiva con correos distintos).
 */
export function getRateLimitIdentifier(action: string, request: Request, key?: string): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ip = forwardedFor
    ? forwardedFor.split(",")[0].trim()
    : request.headers.get("x-real-ip") ?? "unknown"
  const keyPart = typeof key === "string" && key.length > 0 ? key.toLowerCase() : "any"
  return `${action}:${ip}:${keyPart}`
}

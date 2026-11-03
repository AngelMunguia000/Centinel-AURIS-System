import { describe, it, expect } from 'vitest'
import { checkRateLimit, recordAttempt, resetRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'

// Prioridad 5 (auditoría integral 26 ago, AUD2-15): podría dejar de aplicarse
// silenciosamente sin que nada lo note — cubre lib/rate-limit.ts en memoria
// (puro, sin DB) y la construcción del identificador por IP/acción.

describe('checkRateLimit / recordAttempt', () => {
  it('permite intentos por debajo del máximo', () => {
    const id = `vitest:${crypto.randomUUID()}`
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit(id, 5).allowed).toBe(true)
      recordAttempt(id)
    }
    // 4 intentos registrados, el 5to (índice 4) sigue permitido
    expect(checkRateLimit(id, 5).allowed).toBe(true)
  })

  it('bloquea al llegar al máximo de intentos', () => {
    const id = `vitest:${crypto.randomUUID()}`
    for (let i = 0; i < 5; i++) recordAttempt(id)

    const result = checkRateLimit(id, 5)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('cada identificador tiene su propio contador', () => {
    const a = `vitest:${crypto.randomUUID()}`
    const b = `vitest:${crypto.randomUUID()}`
    for (let i = 0; i < 5; i++) recordAttempt(a)

    expect(checkRateLimit(a, 5).allowed).toBe(false)
    expect(checkRateLimit(b, 5).allowed).toBe(true)
  })

  it('resetRateLimit limpia el contador de un identificador', () => {
    const id = `vitest:${crypto.randomUUID()}`
    for (let i = 0; i < 5; i++) recordAttempt(id)
    expect(checkRateLimit(id, 5).allowed).toBe(false)

    resetRateLimit(id)

    expect(checkRateLimit(id, 5).allowed).toBe(true)
  })

  it('respeta un maxAttempts distinto del default (ej. chat-auris: 20)', () => {
    const id = `vitest:${crypto.randomUUID()}`
    for (let i = 0; i < 19; i++) recordAttempt(id)

    expect(checkRateLimit(id, 20).allowed).toBe(true)
    recordAttempt(id)
    expect(checkRateLimit(id, 20).allowed).toBe(false)
  })
})

describe('getRateLimitIdentifier', () => {
  function requestWithIp(ip?: string) {
    const headers = new Headers()
    if (ip) headers.set('x-forwarded-for', ip)
    return new Request('http://localhost/api/login', { headers })
  }

  it('separa el identificador por acción, aunque compartan IP', () => {
    const req = requestWithIp('1.2.3.4')
    expect(getRateLimitIdentifier('login', req)).not.toBe(getRateLimitIdentifier('register', req))
  })

  it('usa "unknown" cuando no hay ningún header de IP', () => {
    const id = getRateLimitIdentifier('login', requestWithIp())
    expect(id).toBe('login:unknown:any')
  })

  it('toma solo la primera IP de x-forwarded-for (lista separada por comas)', () => {
    const id = getRateLimitIdentifier('login', requestWithIp('1.2.3.4, 5.6.7.8'))
    expect(id).toBe('login:1.2.3.4:any')
  })

  it('incorpora la key (ej. correo) en minúsculas', () => {
    const req = requestWithIp('1.2.3.4')
    const id = getRateLimitIdentifier('register', req, 'Usuario@Ejemplo.com')
    expect(id).toBe('register:1.2.3.4:usuario@ejemplo.com')
  })
})

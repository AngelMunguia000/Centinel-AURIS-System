import { describe, it, expect } from 'vitest'
import { base32, cifrarSecreto, codigoTotp, descifrarSecreto, hashRespaldo, nuevosCodigosRespaldo, verificarTotp } from '@/lib/totp'

// Vector de prueba de RFC 6238 (apéndice B, SHA1): secreto ASCII "12345678901234567890".
const SECRETO = base32(Buffer.from('12345678901234567890'))

describe('TOTP', () => {
  it('coincide con los vectores de RFC 6238 (últimos 6 dígitos)', () => {
    expect(codigoTotp(SECRETO, 59_000)).toBe('287082')
    expect(codigoTotp(SECRETO, 1_111_111_109_000)).toBe('081804')
    expect(codigoTotp(SECRETO, 1_234_567_890_000)).toBe('005924')
    expect(codigoTotp(SECRETO, 2_000_000_000_000)).toBe('279037')
  })

  it('acepta ±30 s y rechaza lo demás', () => {
    const t = 1_234_567_890_000
    expect(verificarTotp(SECRETO, codigoTotp(SECRETO, t - 30_000), t)).toBe(true)
    expect(verificarTotp(SECRETO, '005 924', t)).toBe(true)
    expect(verificarTotp(SECRETO, codigoTotp(SECRETO, t - 90_000), t)).toBe(false)
    expect(verificarTotp(SECRETO, 'abc123', t)).toBe(false)
  })

  it('cifra el secreto y los códigos de respaldo no distinguen formato', () => {
    process.env.JWT_SECRET ??= 'secreto-de-prueba'
    const guardado = cifrarSecreto(SECRETO)
    expect(guardado).not.toContain(SECRETO)
    expect(descifrarSecreto(guardado)).toBe(SECRETO)
    const { codigos, hashes } = nuevosCodigosRespaldo()
    expect(codigos).toHaveLength(8)
    expect(hashRespaldo(codigos[0].toLowerCase().replace('-', ''))).toBe(hashes[0])
  })
})

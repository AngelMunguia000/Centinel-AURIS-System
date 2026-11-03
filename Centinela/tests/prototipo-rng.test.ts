import { describe, it, expect } from 'vitest'
import { crearRng } from '@/lib/prototipo/rng'

describe('crearRng', () => {
  it('es determinista para la misma semilla', () => {
    const a = crearRng(42)
    const b = crearRng(42)
    expect(Array.from({ length: 5 }, () => a())).toEqual(Array.from({ length: 5 }, () => b()))
  })
  it('devuelve valores en [0, 1)', () => {
    const r = crearRng(7)
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('semillas distintas dan secuencias distintas', () => {
    expect(crearRng(1)()).not.toBe(crearRng(2)())
  })
})

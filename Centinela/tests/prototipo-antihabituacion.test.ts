import { describe, it, expect } from 'vitest'
import { elegirPatron, sectorDePan } from '@/lib/prototipo/antihabituacion'
import { crearRng } from '@/lib/prototipo/rng'
import type { FamiliaPatron } from '@/lib/prototipo/tipos'

describe('sectorDePan', () => {
  it('divide 0–180° en 12 sectores de 15°', () => {
    expect(sectorDePan(0)).toBe(0)
    expect(sectorDePan(14.9)).toBe(0)
    expect(sectorDePan(15)).toBe(1)
    expect(sectorDePan(90)).toBe(6)
    expect(sectorDePan(180)).toBe(11) // el extremo no crea un sector 12
  })
})

describe('elegirPatron', () => {
  it('nunca repite una familia usada en los últimos 3 eventos del sector', () => {
    const rng = crearRng(1)
    const historial: FamiliaPatron[] = ['sweep_chirp', 'tone_am', 'distress']
    for (let i = 0; i < 200; i++) {
      expect(['sweep_log', 'random_mix']).toContain(elegirPatron(historial, rng).familia)
    }
  })
  it('solo mira los últimos 3 del historial', () => {
    const rng = crearRng(2)
    const historial: FamiliaPatron[] = ['sweep_log', 'sweep_chirp', 'tone_am', 'distress']
    for (let i = 0; i < 100; i++) {
      expect(['sweep_log', 'random_mix']).toContain(elegirPatron(historial, rng).familia)
    }
  })
  it('aleatoriza dentro de los rangos del PDF §5.2.4', () => {
    const rng = crearRng(3)
    for (let i = 0; i < 300; i++) {
      const p = elegirPatron([], rng)
      expect(p.duracionMs).toBeGreaterThanOrEqual(1800)
      expect(p.duracionMs).toBeLessThanOrEqual(3000)
      expect(p.gapMs).toBeGreaterThanOrEqual(250)
      expect(p.gapMs).toBeLessThanOrEqual(900)
      expect(p.amRateHz).toBeGreaterThanOrEqual(4)
      expect(p.amRateHz).toBeLessThanOrEqual(12)
      expect(p.gain).toBeGreaterThanOrEqual(0.7)
      expect(p.gain).toBeLessThanOrEqual(0.95)
    }
  })
  it('es determinista con la misma semilla', () => {
    expect(elegirPatron([], crearRng(9))).toEqual(elegirPatron([], crearRng(9)))
  })
})

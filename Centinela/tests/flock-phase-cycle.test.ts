import { describe, it, expect, vi, afterEach } from 'vitest'
import { startFlockPhaseCycle, CYCLE_MS, type FlockPhase } from '@/lib/flock-phase-cycle'

// Bug C5 (auditoría 14 sep): el ciclo real duraba ~19s en vez de 15s.
afterEach(() => vi.useRealTimers())

// Avanza de a 1s registrando el instante exacto de cada cambio de fase.
function correr(ms: number, detenerEn?: number) {
  vi.useFakeTimers()
  const timeline: Array<[number, FlockPhase]> = []
  let elapsed = 0
  const stop = startFlockPhaseCycle((p) => timeline.push([elapsed, p]))
  for (let i = 0; i < ms; i += 1000) {
    if (detenerEn === elapsed) stop()
    elapsed += 1000
    vi.advanceTimersByTime(1000)
  }
  stop()
  return timeline
}

describe('startFlockPhaseCycle', () => {
  it('dispara las fases en 4s, 8s y 9s, y reinicia a los 15s', () => {
    expect(correr(CYCLE_MS)).toEqual([
      [4000, 'LANDED'],
      [8000, 'DETERRED'],
      [9000, 'SCATTER'],
      [15000, 'APPROACH'],
    ])
  })

  it('el segundo ciclo repite exactamente el primero (no se alarga a ~19s)', () => {
    const t = correr(2 * CYCLE_MS)
    const de = (fase: FlockPhase) => t.filter(([, p]) => p === fase).map(([ms]) => ms)
    expect(de('APPROACH')).toEqual([15000, 30000])
    expect(de('LANDED')).toEqual([4000, 19000])
    expect(de('SCATTER')).toEqual([9000, 24000])
  })

  it('la limpieza cancela todo: no hay más cambios de fase', () => {
    // Se detiene a los 5s (tras LANDED); no debe llegar DETERRED ni nada más.
    expect(correr(60000, 5000)).toEqual([[4000, 'LANDED']])
  })
})

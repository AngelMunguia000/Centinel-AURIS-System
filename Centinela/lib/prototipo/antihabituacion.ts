import { C } from './constantes'
import type { FamiliaPatron, Patron } from './tipos'

// PDF §5.2.3: cinco familias de patrón.
const FAMILIAS: FamiliaPatron[] = ['sweep_chirp', 'sweep_log', 'tone_am', 'random_mix', 'distress']

// PDF §5.2.4: 12 sectores de 15° sobre el Pan (0–180°).
export function sectorDePan(pan: number): number {
  return Math.min(11, Math.max(0, Math.floor(pan / 15)))
}

// Simplificación documentada: el PDF pondera por uso en 24 h (peso = 1/(1+usos));
// la simulación no guarda 24 h de historia, así que elige uniforme entre candidatos.
export function elegirPatron(historial: FamiliaPatron[], rng: () => number): Patron {
  const recientes = historial.slice(-C.HISTORIAL_POR_SECTOR)
  const candidatos = FAMILIAS.filter((f) => !recientes.includes(f))
  const familia = candidatos[Math.floor(rng() * candidatos.length)]
  const u = (a: number, b: number) => a + rng() * (b - a)
  return {
    familia,
    duracionMs: Math.round(u(1800, 3000)),
    gapMs: Math.round(u(250, 900)),
    amRateHz: Math.round(u(4, 12) * 10) / 10,
    gain: Math.round(u(0.7, 0.95) * 100) / 100,
    seed: Math.floor(rng() * 4294967296) >>> 0,
  }
}

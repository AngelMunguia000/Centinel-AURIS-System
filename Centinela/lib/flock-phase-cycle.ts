export type FlockPhase = 'APPROACH' | 'LANDED' | 'DETERRED' | 'SCATTER'

// Duración total del ciclo de la simulación de disuasión (landing 3D). Los
// tiempos por fase son offsets desde el inicio del ciclo.
export const CYCLE_MS = 15000
const PHASE_OFFSETS: ReadonlyArray<readonly [FlockPhase, number]> = [
  ['LANDED', 4000],   // Se posan en el suelo
  ['DETERRED', 8000], // Pulso sonoro
  ['SCATTER', 9000],  // Despegue asustadas
]

/**
 * Programa el ciclo completo una sola vez y lo repite cada CYCLE_MS.
 * Devuelve la función de limpieza. No depende de la fase actual: antes el
 * efecto se re-disparaba al cambiar de fase y reprogramaba los timers, lo que
 * alargaba el ciclo real a ~19s (auditoría 14 sep, bug C5).
 */
export function startFlockPhaseCycle(setPhase: (phase: FlockPhase) => void): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>()

  const runCycle = () => {
    for (const [phase, offset] of PHASE_OFFSETS) {
      timers.add(setTimeout(() => setPhase(phase), offset))
    }
  }

  runCycle()
  const interval = setInterval(() => {
    setPhase('APPROACH')
    runCycle()
  }, CYCLE_MS)

  return () => {
    clearInterval(interval)
    timers.forEach(clearTimeout)
    timers.clear()
  }
}

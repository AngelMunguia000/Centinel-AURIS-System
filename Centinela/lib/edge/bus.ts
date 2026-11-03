// Bus de eventos en vivo para el stream SSE — spec 2026-10-16-enlace-edge-design.md §4.4.
// shortcut: vive en memoria de un solo proceso; pasar a Redis/pub-sub si el servidor corre en más de una instancia.

export interface EventoBus {
  tipo: 'dispositivo.estado' | 'dispositivo.telemetria' | 'evento.nuevo'
  usuarioId: number
  dispositivoId: number
  datos: unknown
}

type Oyente = (e: EventoBus) => void

// En globalThis por el mismo motivo que lib/prisma.ts: Next recarga módulos en dev
// y cada recarga crearía un bus distinto, dejando suscriptores huérfanos.
const g = globalThis as unknown as { __centinelaBus?: Set<Oyente> }
const oyentes = (g.__centinelaBus ??= new Set<Oyente>())

export function publicar(e: EventoBus): void {
  for (const fn of oyentes) {
    try {
      fn(e)
    } catch (error) {
      // Un suscriptor roto (p. ej. un stream ya cerrado) no debe cortar al resto.
      console.error('[edge] suscriptor del bus falló:', error)
    }
  }
}

export function suscribir(fn: Oyente): () => void {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

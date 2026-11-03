// Revisión de la detección por cámara (2026-10-30, pedido del PO): una persona marca en cada foto si
// había un objetivo (un ave) y con eso se mide el modelo de la Pi. Las aves que el modelo no vio quedan
// como `movimiento` y sin esta revisión nadie las ve: la sensibilidad sale de ahí.

export const REVISIONES = ['objetivo', 'nada'] as const
export type Revision = (typeof REVISIONES)[number]

// Eventos que trae la cámara con foto: `deteccion` = el modelo vio un objetivo; `movimiento` = no lo vio.
export const TIPOS_CAMARA = ['deteccion', 'movimiento'] as const

export function esRevision(valor: unknown): valor is Revision {
  return typeof valor === 'string' && (REVISIONES as readonly string[]).includes(valor)
}

const pct = (parte: number, todo: number) => (todo ? Math.round((100 * parte) / todo) : null)

/** precision: de lo que el modelo llamó ave, cuánto lo era. sensibilidad: de las aves que hubo, cuántas vio. */
export function metricasVision(eventos: { tipo: string; revision: string | null }[]) {
  let aciertos = 0, falsas = 0, escapadas = 0, descartes = 0
  for (const e of eventos) {
    if (!esRevision(e.revision)) continue
    const dijoObjetivo = e.tipo === 'deteccion'
    const habia = e.revision === 'objetivo'
    if (dijoObjetivo && habia) aciertos++
    else if (dijoObjetivo) falsas++
    else if (habia) escapadas++
    else descartes++
  }
  return {
    revisadas: aciertos + falsas + escapadas + descartes,
    aciertos,
    falsas,
    escapadas,
    descartes,
    precision: pct(aciertos, aciertos + falsas),
    sensibilidad: pct(aciertos, aciertos + escapadas),
  }
}

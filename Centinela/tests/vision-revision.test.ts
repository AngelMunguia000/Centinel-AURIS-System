import { describe, it, expect } from 'vitest'
import { esRevision, metricasVision } from '@/lib/edge/revision'

describe('lib/edge/revision', () => {
  it('cruza lo que dijo el modelo con lo que vio la persona', () => {
    const m = metricasVision([
      { tipo: 'deteccion', revision: 'objetivo' }, // acierto
      { tipo: 'deteccion', revision: 'objetivo' }, // acierto
      { tipo: 'deteccion', revision: 'nada' }, // falsa alarma
      { tipo: 'movimiento', revision: 'objetivo' }, // se escapó
      { tipo: 'movimiento', revision: 'nada' }, // bien descartado
      { tipo: 'deteccion', revision: null }, // sin revisar: no cuenta
    ])
    expect(m).toEqual({ revisadas: 5, aciertos: 2, falsas: 1, escapadas: 1, descartes: 1, precision: 67, sensibilidad: 67 })
  })

  it('sin datos no inventa porcentajes', () => {
    expect(metricasVision([])).toMatchObject({ revisadas: 0, precision: null, sensibilidad: null })
  })

  it('solo acepta las dos marcas', () => {
    expect(esRevision('objetivo')).toBe(true)
    expect(esRevision('nada')).toBe(true)
    expect(esRevision('quizas')).toBe(false)
    expect(esRevision(null)).toBe(false)
  })
})

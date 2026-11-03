import { describe, it, expect } from 'vitest'
import { vencido, duracion, metricas, esMotivo } from '@/lib/respuesta'

const T0 = new Date('2026-10-24T10:00:00Z')
const mas = (min: number) => new Date(T0.getTime() + min * 60_000)

describe('respuesta a alarmas', () => {
  it('vence según el plazo de su prioridad, solo si nadie acusó', () => {
    const critica = { estado: 'pendiente', prioridad: 'critica', createdAt: T0 }
    expect(vencido(critica, mas(4).getTime())).toBe(false)
    expect(vencido(critica, mas(6).getTime())).toBe(true)
    expect(vencido({ ...critica, atendidoEn: mas(1) }, mas(60).getTime())).toBe(false)
    expect(vencido({ ...critica, estado: 'resuelto' }, mas(60).getTime())).toBe(false)
    expect(vencido({ estado: 'pendiente', prioridad: 'baja', createdAt: T0 }, mas(200).getTime())).toBe(false)
  })

  it('formatea duraciones', () => {
    expect(duracion(T0, mas(3))).toBe('3 min')
    expect(duracion(T0, mas(125))).toBe('2 h 5 min')
    expect(duracion(T0, mas(60 * 28))).toBe('1 d 4 h')
  })

  it('promedia acuse y resolución y cuenta falsas alarmas solo entre los cerrados con motivo', () => {
    const m = metricas([
      { createdAt: T0, atendidoEn: mas(2), resueltoEn: mas(30), motivoCierre: 'falsa_alarma' },
      { createdAt: T0, atendidoEn: mas(4), resueltoEn: mas(90), motivoCierre: 'real' },
      { createdAt: T0, atendidoEn: null, resueltoEn: null, motivoCierre: null },
    ])
    expect(m).toEqual({ acuseMin: 3, resolucionMin: 60, falsasPct: 50 })
    expect(metricas([])).toEqual({ acuseMin: null, resolucionMin: null, falsasPct: null })
  })

  it('valida el motivo de cierre', () => {
    expect(esMotivo('falsa_alarma')).toBe(true)
    expect(esMotivo('otro')).toBe(false)
  })
})

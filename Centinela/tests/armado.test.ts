import { describe, it, expect } from 'vitest'
import { avisaSiempre, describirArmado, estaArmado, horarioSchema } from '@/lib/edge/armado'

// Fechas en hora local: 2026-10-26 es lunes.
const lunes = (h: number, m = 0) => new Date(2026, 9, 26, h, m)
const noche = JSON.stringify({ dias: [1, 2, 3, 4, 5], desde: '22:00', hasta: '07:00' })
const g = (modoArmado: string, horarioArmado: string | null = null, vacacionesHasta: Date | null = null) => ({ modoArmado, horarioArmado, vacacionesHasta })

describe('armado por Pi', () => {
  it('armado y desarmado fijos', () => {
    expect(estaArmado(g('armado'), lunes(12))).toBe(true)
    expect(estaArmado(g('desarmado'), lunes(12))).toBe(false)
  })

  it('horario que cruza la medianoche cuenta desde el día de inicio', () => {
    expect(estaArmado(g('horario', noche), lunes(23))).toBe(true)
    expect(estaArmado(g('horario', noche), lunes(12))).toBe(false)
    expect(estaArmado(g('horario', noche), new Date(2026, 9, 27, 6, 30))).toBe(true) // martes de madrugada, empezó el lunes
    expect(estaArmado(g('horario', noche), lunes(6))).toBe(false) // el domingo no estaba en la lista
    expect(estaArmado(g('horario', noche), new Date(2026, 9, 31, 23))).toBe(false) // sábado
  })

  it('horario de día, sin cruzar medianoche', () => {
    const oficina = JSON.stringify({ dias: [1], desde: '09:00', hasta: '18:00' })
    expect(estaArmado(g('horario', oficina), lunes(9))).toBe(true)
    expect(estaArmado(g('horario', oficina), lunes(18))).toBe(false)
  })

  it('vacaciones arma aunque esté desarmado; un horario roto queda armado', () => {
    expect(estaArmado(g('desarmado', null, lunes(20)), lunes(12))).toBe(true)
    expect(estaArmado(g('desarmado', null, lunes(10)), lunes(12))).toBe(false)
    expect(estaArmado(g('horario', '{roto'), lunes(12))).toBe(true)
  })

  it('pánico, manipulación y desconexión avisan siempre', () => {
    expect(avisaSiempre({ tipo: 'panico' })).toBe(true)
    expect(avisaSiempre({ tipo: 'manipulacion' })).toBe(true)
    expect(avisaSiempre({ tipo: 'conexion', detalle: 'offline' })).toBe(true)
    expect(avisaSiempre({ tipo: 'conexion', detalle: 'online' })).toBe(false)
    expect(avisaSiempre({ tipo: 'movimiento' })).toBe(false)
  })

  it('valida y describe el horario', () => {
    expect(horarioSchema.safeParse({ dias: [], desde: '22:00', hasta: '07:00' }).success).toBe(false)
    expect(horarioSchema.safeParse({ dias: [1], desde: '25:00', hasta: '07:00' }).success).toBe(false)
    expect(horarioSchema.safeParse({ dias: [1], desde: '07:00', hasta: '07:00' }).success).toBe(false)
    expect(describirArmado(g('horario', noche), lunes(23))).toBe('Por horario: Lun Mar Mié Jue Vie 22:00–07:00 · ahora armado')
  })
})

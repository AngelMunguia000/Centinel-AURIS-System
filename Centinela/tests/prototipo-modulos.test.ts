import { describe, it, expect } from 'vitest'
import { GRUPOS_MODULO, MODULOS } from '@/lib/prototipo/modulos'

describe('catálogo de módulos', () => {
  it('tiene 17 módulos con id único', () => {
    expect(MODULOS).toHaveLength(17)
    expect(new Set(MODULOS.map((m) => m.id)).size).toBe(17)
  })
  it('cada módulo cita secciones del PDF con formato válido', () => {
    for (const m of MODULOS) expect(m.pdf).toMatch(/^§[0-9A-D][0-9.]*(, §[0-9A-D][0-9.]*)*$/)
  })
  it('ningún campo de texto está vacío', () => {
    for (const m of MODULOS) {
      for (const k of ['nombre', 'funcion', 'especificacion', 'conexion'] as const) {
        expect(m[k].trim().length).toBeGreaterThan(0)
      }
    }
  })
  it('usa los 9 grupos y ninguno vacío', () => {
    expect(GRUPOS_MODULO).toHaveLength(9)
    for (const g of GRUPOS_MODULO) expect(MODULOS.some((m) => m.grupo === g)).toBe(true)
  })
})

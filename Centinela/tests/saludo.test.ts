import { describe, expect, it } from 'vitest'
import { nombreCorto, saludo } from '@/lib/saludo'

describe('saludo del Inicio', () => {
  it('usa la frase de cada franja horaria', () => {
    expect(saludo(3, 'Angel Munguía')).toBe('Trasnochando, Angel Munguía')
    expect(saludo(6, 'Angel Munguía')).toBe('Desmañanado, Angel Munguía')
    expect(saludo(9, 'Angel Munguía')).toBe('Buenos días, Angel Munguía')
    expect(saludo(15, 'Angel Munguía')).toBe('Buenas tardes, Angel Munguía')
    expect(saludo(22, 'Angel Munguía')).toBe('Buenas noches, Angel Munguía')
  })

  it('cambia de variante con el día y aguanta días negativos', () => {
    expect(saludo(6, 'A', 1)).toBe('Madrugaste, A')
    expect(saludo(6, 'A', -4)).toBe('Madrugaste, A')
  })

  it('sin nombre no deja una coma colgando', () => {
    expect(saludo(9, '')).toBe('Buenos días')
  })

  it('toma el primer nombre y el primer apellido', () => {
    expect(nombreCorto('Angel David', 'Munguía Zúñiga')).toBe('Angel Munguía')
    expect(nombreCorto('  Ana ', '')).toBe('Ana')
  })
})

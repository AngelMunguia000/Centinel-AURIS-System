import { describe, expect, it } from 'vitest'
import { hace } from '@/lib/tiempo'
import { atencion } from '@/lib/atencion'

const AHORA = new Date(2026, 9, 24, 12, 0).getTime()

describe('hace()', () => {
  it('es relativo y lleva la fecha cuando no es hoy', () => {
    expect(hace(new Date(2026, 9, 24, 11, 59, 30), AHORA)).toBe('hace un momento (11:59)')
    expect(hace(new Date(2026, 9, 24, 11, 15), AHORA)).toBe('hace 45 min (11:15)')
    expect(hace(new Date(2026, 9, 22, 12, 0), AHORA)).toBe('hace 2 días (22 oct, 12:00)')
    expect(hace(new Date(2026, 9, 23, 12, 0), AHORA)).toBe('hace 1 día (23 oct, 12:00)')
    expect(hace(null, AHORA)).toBe('nunca')
  })
})

describe('atencion() del Inicio', () => {
  const reportes = [
    { id: 1, titulo: '[SIMULADO] ave', prioridad: 'alta', operadorAsignadoId: null, createdAt: new Date(AHORA) },
    { id: 2, titulo: 'Cámara caída', prioridad: 'critica', operadorAsignadoId: 7, createdAt: new Date(AHORA) },
    { id: 3, titulo: 'Duda', prioridad: 'baja', operadorAsignadoId: null, createdAt: new Date(AHORA) },
  ]
  const caidos = [{ nombre: 'n1', ultimoContacto: null }]

  it('Admin: nodos caídos primero y luego críticos/altos sin asignar', () => {
    const filas = atencion(reportes, caidos, { id: 1, role: 'Admin', permisos: new Set(['reportes.ver_todos', 'reportes.asignar']) }, AHORA)
    expect(filas.map((f) => f.href)).toEqual(['/monitor', '/reportes'])
    expect(filas[1].titulo).toBe('Alta · [SIMULADO] ave')
  })

  it('Operador: lo suyo primero y lo urgente sin dueño después', () => {
    const filas = atencion(reportes, [], { id: 7, role: 'Operador', permisos: new Set(['reportes.ver_todos']) }, AHORA)
    expect(filas.map((f) => f.titulo)).toEqual(['Crítica · Cámara caída', 'Alta · [SIMULADO] ave'])
    expect(filas[0].detalle).toContain('asignado a ti')
    expect(filas[1].detalle).toContain('sin asignar')
  })

  it('Usuario: todos sus pendientes', () => {
    expect(atencion(reportes, [], { id: 9, role: 'Usuario', permisos: new Set() }, AHORA)).toHaveLength(3)
  })
})

import { describe, it, expect } from 'vitest'
import {
  PERMISOS,
  PERMISOS_POR_ROL,
  permisosEfectivos,
  esPermisoValido,
  estadoActual,
  normalizarEstado,
} from '@/lib/permisos'

// 06_UI_UX.md §F — spec 2026-09-24-permisos-granulares-design.md §3.
describe('lib/permisos', () => {
  // 10ª clave: vision.revisar (revisión de visión, 2026-10-30).
  it('catálogo con exactamente las 10 claves', () => {
    expect(PERMISOS.map((p) => p.clave).sort()).toEqual([
      'auditoria.ver',
      'dispositivos.otros',
      'dispositivos.propios',
      'prototipo.ejecutar',
      'reportes.asignar',
      'reportes.reclasificar',
      'reportes.resolver',
      'reportes.ver_todos',
      'usuarios.gestionar',
      'vision.revisar',
    ])
  })

  it('defaults de Usuario y Operador', () => {
    expect([...PERMISOS_POR_ROL.Usuario].sort()).toEqual(['dispositivos.propios'])
    expect([...PERMISOS_POR_ROL.Operador].sort()).toEqual([
      'reportes.reclasificar',
      'reportes.resolver',
      'reportes.ver_todos',
    ])
  })

  it('Admin tiene todo y es inmune a excepciones', () => {
    const efectivos = permisosEfectivos('Admin', [{ permiso: 'usuarios.gestionar', otorgado: false }])
    expect(efectivos.size).toBe(PERMISOS.length)
    expect(efectivos.has('usuarios.gestionar')).toBe(true)
  })

  it('otorgar suma y quitar resta sobre el default del rol', () => {
    const efectivos = permisosEfectivos('Operador', [
      { permiso: 'reportes.asignar', otorgado: true },
      { permiso: 'reportes.resolver', otorgado: false },
    ])
    expect(efectivos.has('reportes.asignar')).toBe(true)
    expect(efectivos.has('reportes.resolver')).toBe(false)
    expect(efectivos.has('reportes.reclasificar')).toBe(true)
  })

  it('ignora claves desconocidas y roles desconocidos', () => {
    expect(permisosEfectivos('Usuario', [{ permiso: 'hackear.todo', otorgado: true }])).toEqual(
      new Set(['dispositivos.propios'])
    )
    expect(permisosEfectivos('Invitado', []).size).toBe(0)
  })

  it('esPermisoValido', () => {
    expect(esPermisoValido('reportes.asignar')).toBe(true)
    expect(esPermisoValido('reportes.borrar')).toBe(false)
  })

  it('estadoActual lee la excepción o devuelve defecto', () => {
    const exc = [{ permiso: 'reportes.asignar', otorgado: true }]
    expect(estadoActual('reportes.asignar', exc)).toBe('otorgado')
    expect(estadoActual('reportes.resolver', [{ permiso: 'reportes.resolver', otorgado: false }])).toBe('quitado')
    expect(estadoActual('auditoria.ver', exc)).toBe('defecto')
  })

  it('normalizarEstado: otorgar lo que el rol ya trae o quitar lo que no trae es "defecto"', () => {
    expect(normalizarEstado('Operador', 'reportes.resolver', 'otorgado')).toBe('defecto')
    expect(normalizarEstado('Usuario', 'reportes.asignar', 'quitado')).toBe('defecto')
    expect(normalizarEstado('Operador', 'reportes.resolver', 'quitado')).toBe('quitado')
    expect(normalizarEstado('Usuario', 'reportes.asignar', 'otorgado')).toBe('otorgado')
  })

  it('ignora roles que son propiedades heredadas (toString, constructor, hasOwnProperty)', () => {
    expect(permisosEfectivos('toString', []).size).toBe(0)
    expect(permisosEfectivos('constructor', []).size).toBe(0)
    expect(permisosEfectivos('hasOwnProperty', []).size).toBe(0)
  })

  it('normalizarEstado con roles heredados devuelve estado sin error', () => {
    expect(normalizarEstado('toString', 'reportes.asignar', 'otorgado')).toBe('otorgado')
    expect(normalizarEstado('constructor', 'reportes.resolver', 'quitado')).toBe('defecto')
  })
})

import { describe, it, expect } from 'vitest'
import { esCategoria, esPrioridad } from '@/lib/reportes-catalogos'
import {
  CODIGOS_EVENTO, EVENTOS, PREFIJO_SIMULADO, conexionDe, esCodigoEvento, uidDispositivoSimulado,
} from '@/lib/prototipo/eventos'

describe('EVENTOS', () => {
  it('define los 4 códigos persistibles con prioridad y categoría válidas', () => {
    expect([...CODIGOS_EVENTO].sort()).toEqual(['broker_caido', 'fault', 'persistencia_objetivo', 'sobrecorriente'])
    for (const c of CODIGOS_EVENTO) {
      expect(esPrioridad(EVENTOS[c].prioridad)).toBe(true)
      expect(esCategoria(EVENTOS[c].categoria)).toBe(true)
      expect(EVENTOS[c].titulo.startsWith(PREFIJO_SIMULADO)).toBe(false) // el prefijo lo agrega el servidor
    }
  })
  it('mapea la severidad S1–S4 del PDF a la prioridad', () => {
    expect(EVENTOS.persistencia_objetivo.prioridad).toBe('alta')
    expect(EVENTOS.broker_caido.prioridad).toBe('media')
    expect(EVENTOS.sobrecorriente.prioridad).toBe('alta')
    expect(EVENTOS.fault.prioridad).toBe('critica')
  })
})

describe('esCodigoEvento', () => {
  it('acepta solo códigos de la lista cerrada', () => {
    expect(esCodigoEvento('fault')).toBe(true)
    expect(esCodigoEvento('drop table')).toBe(false)
    expect(esCodigoEvento(undefined)).toBe(false)
    expect(esCodigoEvento(3)).toBe(false)
  })
})

describe('conexionDe', () => {
  it('traduce el estado de la FSM a la conexión del Dispositivo', () => {
    expect(conexionDe('DETERRING')).toBe('ACTIVA')
    expect(conexionDe('SAFE_MUTE')).toBe('LATENCIA')
    expect(conexionDe('AUTONOMOUS')).toBe('DESCONECTADO')
    expect(conexionDe('FAULT')).toBe('DESCONECTADO')
    expect(conexionDe('IDLE')).toBe('ESTABLE')
    expect(conexionDe('SCANNING')).toBe('ESTABLE')
  })
})

describe('uidDispositivoSimulado', () => {
  it('incluye el id del Admin para no chocar con otros (uid es único en toda la BD)', () => {
    expect(uidDispositivoSimulado(5)).toBe('SIM-CENTINEL-5')
    expect(uidDispositivoSimulado(5)).not.toBe(uidDispositivoSimulado(6))
  })
})

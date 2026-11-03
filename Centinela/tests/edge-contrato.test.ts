import { describe, it, expect } from 'vitest'
import {
  telemetriaLoteSchema,
  eventosLoteSchema,
  comandoSchema,
  respuestaComandoSchema,
  NODE_ID_RE,
} from '@/lib/edge/contrato'

// Spec docs/diseno/2026-10-16-enlace-edge-design.md §4.
const telemetria = { ts_ms: 1, temp_c: 41.5, rssi_dbm: -60, uptime_s: 10, heap_libre: 200000, pan_deg: 90, tilt_deg: 0 }
const loteValido = { v: 1, nodos: [{ node_id: 'node-a1b2c3d4e5f6', telemetria }] }

const pantilt = (pan_deg: number, tilt_deg: number) => ({
  tipo: 'pantilt',
  payload: { mode: 'absolute', pan_deg, tilt_deg },
})

describe('contrato edge v1', () => {
  it('acepta un lote de telemetría válido', () => {
    expect(telemetriaLoteSchema.safeParse(loteValido).success).toBe(true)
  })

  it('rechaza v distinto de 1', () => {
    expect(telemetriaLoteSchema.safeParse({ ...loteValido, v: 2 }).success).toBe(false)
  })

  it('rechaza node_id que no cumple NODE_ID_RE', () => {
    expect(NODE_ID_RE.test('node-A1B2C3D4E5F6')).toBe(false)
    const malo = { v: 1, nodos: [{ node_id: 'esp32', telemetria }] }
    expect(telemetriaLoteSchema.safeParse(malo).success).toBe(false)
  })

  it('rechaza pan 181 y tilt -21; acepta pan 0, 180 y tilt -20, 45', () => {
    expect(comandoSchema.safeParse(pantilt(181, 0)).success).toBe(false)
    expect(comandoSchema.safeParse(pantilt(90, -21)).success).toBe(false)
    expect(comandoSchema.safeParse(pantilt(0, -20)).success).toBe(true)
    expect(comandoSchema.safeParse(pantilt(180, 45)).success).toBe(true)
  })

  it('audio exige pattern de las familias de lib/prototipo/tipos.ts y acota duracion_ms 100–10000 y ganancia 0–1', () => {
    const audio = (payload: object) => comandoSchema.safeParse({ tipo: 'audio', payload })
    expect(audio({ pattern: 'sweep_chirp' }).success).toBe(true)
    expect(audio({ pattern: 'sirena' }).success).toBe(false)
    expect(audio({ pattern: 'tone_am', duracion_ms: 99 }).success).toBe(false)
    expect(audio({ pattern: 'tone_am', duracion_ms: 10000, ganancia: 1 }).success).toBe(true)
    expect(audio({ pattern: 'tone_am', ganancia: 1.1 }).success).toBe(false)
  })

  it('system acepta led, ping y reboot y nada más', () => {
    expect(comandoSchema.safeParse({ tipo: 'system', payload: { accion: 'led', encendido: true } }).success).toBe(true)
    expect(comandoSchema.safeParse({ tipo: 'system', payload: { accion: 'ping' } }).success).toBe(true)
    expect(comandoSchema.safeParse({ tipo: 'system', payload: { accion: 'formatear' } }).success).toBe(false)
  })

  it('evento sin id uuid o con severidad desconocida es inválido', () => {
    const evento = {
      id: '0b7f3c1e-8a1d-4c2b-9f4e-2d6a1b3c5e7f',
      node_id: 'node-a1b2c3d4e5f6',
      tipo: 'boton',
      severidad: 'alta',
      ocurrido_en: '2026-10-16T12:00:00.000Z',
    }
    expect(eventosLoteSchema.safeParse({ v: 1, eventos: [evento] }).success).toBe(true)
    expect(eventosLoteSchema.safeParse({ v: 1, eventos: [{ ...evento, id: 'abc' }] }).success).toBe(false)
    expect(eventosLoteSchema.safeParse({ v: 1, eventos: [{ ...evento, severidad: 'critica' }] }).success).toBe(false)
  })

  it('respuesta de comando exige estado conocido y latencia', () => {
    expect(respuestaComandoSchema.safeParse({ estado: 'ok', latencia_ms: 12 }).success).toBe(true)
    expect(respuestaComandoSchema.safeParse({ estado: 'quizas', latencia_ms: 12 }).success).toBe(false)
  })
})

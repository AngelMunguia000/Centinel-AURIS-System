import { z } from 'zod'
import { LIMITES_SERVO } from '@/lib/monitor/servo'
import type { FamiliaPatron } from '@/lib/prototipo/tipos'

// Contrato v1 del enlace edge — spec docs/diseno/2026-10-16-enlace-edge-design.md §4.
// Espejo exacto en edge/pi-gateway/centinela_gateway/domain/modelos.py: cambiar uno obliga a cambiar el otro.

export const NODE_ID_RE = /^node-[0-9a-f]{12}$/

const v1 = z.literal(1)
const nodeId = z.string().regex(NODE_ID_RE)

const capacidad = z.enum(['real', 'simulado', 'ausente'])
export type Capacidad = z.infer<typeof capacidad>
export const capacidadesSchema = z.object({ led: capacidad, pantilt: capacidad, audio: capacidad, camara: capacidad })
export type Capacidades = z.infer<typeof capacidadesSchema>

const pan = z.number().min(LIMITES_SERVO.pan.min).max(LIMITES_SERVO.pan.max)
const tilt = z.number().min(LIMITES_SERVO.tilt.min).max(LIMITES_SERVO.tilt.max)

export const telemetriaSchema = z.object({
  ts_ms: z.number().int().nonnegative(),
  temp_c: z.number(),
  rssi_dbm: z.number(),
  uptime_s: z.number().int().nonnegative(),
  heap_libre: z.number().int().nonnegative(),
  pan_deg: pan,
  tilt_deg: tilt,
})
export type Telemetria = z.infer<typeof telemetriaSchema>

export const telemetriaLoteSchema = z.object({
  v: v1,
  nodos: z
    .array(
      z.object({
        node_id: nodeId,
        fw: z.string().max(32).optional(),
        capacidades: capacidadesSchema.optional(),
        telemetria: telemetriaSchema,
      }),
    )
    .max(50),
})
export type TelemetriaLote = z.infer<typeof telemetriaLoteSchema>

export const severidadSchema = z.enum(['baja', 'media', 'alta'])
export type Severidad = z.infer<typeof severidadSchema>

export const eventosLoteSchema = z.object({
  v: v1,
  eventos: z
    .array(
      z.object({
        id: z.string().uuid(),
        node_id: nodeId,
        tipo: z.string().min(1).max(40),
        severidad: severidadSchema,
        detalle: z.string().max(500).optional(),
        ocurrido_en: z.string().datetime(),
        // Datos estructurados que genera la Pi (actualización de base 2026-10-25, fase 3): la disuasión
        // que decidió y, 20 s después, si funcionó. El firmware no los manda.
        datos: z
          .object({
            ejecutada: z.boolean(),
            motivo: z.string().max(120),
            patron: z.string().max(20),
            duracion_ms: z.number().int().min(0).max(10_000),
            ganancia: z.number().min(0).max(1),
            disuasion_id: z.string().uuid(),
            exito: z.boolean(),
          })
          .partial()
          .optional(),
      }),
    )
    .max(100),
})
export type EventosLote = z.infer<typeof eventosLoteSchema>

const FAMILIAS = ['sweep_chirp', 'sweep_log', 'tone_am', 'random_mix', 'distress'] as const satisfies readonly FamiliaPatron[]

export const comandoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('pantilt'),
    payload: z.object({
      mode: z.enum(['absolute', 'relative', 'home']),
      pan_deg: pan,
      tilt_deg: tilt,
      speed_dps: z.number().positive().max(360).optional(),
      deadline_ms: z.number().int().positive().max(10000).optional(),
    }),
  }),
  z.object({
    tipo: z.literal('audio'),
    payload: z.object({
      pattern: z.enum(FAMILIAS),
      duracion_ms: z.number().int().min(100).max(10000).optional(),
      ganancia: z.number().min(0).max(1).optional(),
    }),
  }),
  z.object({
    tipo: z.literal('system'),
    payload: z.discriminatedUnion('accion', [
      z.object({ accion: z.literal('led'), encendido: z.boolean() }),
      z.object({ accion: z.literal('ping') }),
      z.object({ accion: z.literal('reboot') }),
    ]),
  }),
])
export type Comando = z.infer<typeof comandoSchema>

export const respuestaComandoSchema = z.object({
  estado: z.enum(['ok', 'error', 'timeout']),
  error: z.string().optional(),
  resultado: z.unknown().optional(),
  latencia_ms: z.number().nonnegative(),
})
export type RespuestaComando = z.infer<typeof respuestaComandoSchema>

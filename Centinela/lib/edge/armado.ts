import { z } from 'zod'

// Armado por Raspberry Pi (roadmap de funciones #4, decisiones del PO 2026-10-24): cada Pi es un
// lugar. Desarmado = los eventos se guardan en la Bitácora pero no abren reporte ni avisan, y la Pi
// no disuade. Pánico, desconexión y manipulación avisan siempre. Mismas reglas en Centinela Desktop.

export const MODOS_ARMADO = ['armado', 'desarmado', 'horario'] as const
export type ModoArmado = (typeof MODOS_ARMADO)[number]
export const MODO_LABELS: Record<ModoArmado, string> = { armado: 'Armado', desarmado: 'Desarmado', horario: 'Por horario' }
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:MM)')
export const horarioSchema = z.object({
  dias: z.array(z.number().int().min(0).max(6)).min(1, 'Elige al menos un día').max(7),
  desde: hhmm,
  hasta: hhmm,
}).refine((h) => h.desde !== h.hasta, 'La hora de inicio y la de fin no pueden ser iguales')
export type Horario = z.infer<typeof horarioSchema>

/** Campos de armado que la API devuelve de cada Gateway (select de Prisma). */
export const CAMPOS_ARMADO = { modoArmado: true, horarioArmado: true, vacacionesHasta: true, armadoCambiadoPor: true, armadoCambiadoEn: true } as const

export type ConArmado ={ modoArmado: string; horarioArmado: string | null; vacacionesHasta: Date | string | null }

const minutos = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function leerHorario(json: string | null): Horario | null {
  if (!json) return null
  try {
    const r = horarioSchema.safeParse(JSON.parse(json))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

/** Dentro de la ventana. Si cruza la medianoche (22:00–07:00), el día que cuenta es el de inicio. */
export function dentroDeHorario(h: Horario, ahora: Date): boolean {
  const m = ahora.getHours() * 60 + ahora.getMinutes()
  const dia = ahora.getDay()
  const [desde, hasta] = [minutos(h.desde), minutos(h.hasta)]
  if (desde < hasta) return h.dias.includes(dia) && m >= desde && m < hasta
  return (h.dias.includes(dia) && m >= desde) || (h.dias.includes((dia + 6) % 7) && m < hasta)
}

// shortcut: usa la hora local del servidor (la laptop de la demo); con lugares en otras zonas
// horarias, guardar la zona en el Gateway y convertir aquí.
export function estaArmado(g: ConArmado, ahora: Date = new Date()): boolean {
  if (g.vacacionesHasta && new Date(g.vacacionesHasta).getTime() > ahora.getTime()) return true
  if (g.modoArmado === 'desarmado') return false
  if (g.modoArmado === 'horario') {
    const h = leerHorario(g.horarioArmado)
    return h ? dentroDeHorario(h, ahora) : true // horario roto: mejor armado que desprotegido
  }
  return true
}

/** Eventos que avisan aunque el lugar esté desarmado. */
export function avisaSiempre(e: { tipo: string; detalle?: string | null }): boolean {
  return e.tipo === 'panico' || e.tipo === 'manipulacion' || e.tipo === 'tamper' || (e.tipo === 'conexion' && e.detalle === 'offline')
}

/** "Armado", "Desarmado", "Por horario: Lun Mar 22:00–07:00 · ahora armado", "Modo vacaciones hasta 2 nov · armado". */
export function describirArmado(g: ConArmado, ahora: Date = new Date()): string {
  if (g.vacacionesHasta && new Date(g.vacacionesHasta).getTime() > ahora.getTime()) {
    const d = new Date(g.vacacionesHasta)
    return `Modo vacaciones hasta ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · armado`
  }
  if (g.modoArmado !== 'horario') return MODO_LABELS[g.modoArmado as ModoArmado] ?? g.modoArmado
  const h = leerHorario(g.horarioArmado)
  if (!h) return 'Por horario (sin horario válido) · armado'
  const dias = [...h.dias].sort().map((d) => DIAS_CORTOS[d]).join(' ')
  return `Por horario: ${dias} ${h.desde}–${h.hasta} · ahora ${dentroDeHorario(h, ahora) ? 'armado' : 'desarmado'}`
}

// Respuesta a alarmas (roadmap de funciones, 2026-10-24): lo que distingue una consola
// de vigilancia de un sistema de tickets. Acuse de recibo, cierre con motivo, tiempos de
// respuesta y escalamiento cuando nadie acusa a tiempo. Mismas reglas en Centinela Desktop.

export const MOTIVOS_CIERRE = ['real', 'falsa_alarma', 'prueba'] as const
export type MotivoCierre = (typeof MOTIVOS_CIERRE)[number]
export const MOTIVO_LABELS: Record<string, string> = { real: 'Incidente real', falsa_alarma: 'Falsa alarma', prueba: 'Prueba' }

export function esMotivo(valor: unknown): valor is MotivoCierre {
  return typeof valor === 'string' && (MOTIVOS_CIERRE as readonly string[]).includes(valor)
}

// Minutos para acusar recibo antes de escalar. Decisión de producto, editable aquí.
export const META_ACUSE_MIN: Record<string, number> = { critica: 5, alta: 15, media: 60, baja: 240 }

// shortcut: un reporte más viejo que esto ya no se escala (evita una ráfaga de avisos por el
// atraso acumulado al activar la función); con turnos de guardia reales, quitar el límite.
export const VENTANA_ESCALAMIENTO_MS = 24 * 3_600_000

type ConTiempos = { estado: string; prioridad: string; createdAt: Date | string; atendidoEn?: Date | string | null }

const ms = (d: Date | string) => new Date(d).getTime()

/** Pendiente, sin acuse y pasado su plazo. */
export function vencido(r: ConTiempos, ahora: number = Date.now()): boolean {
  return r.estado === 'pendiente' && !r.atendidoEn && ahora - ms(r.createdAt) > (META_ACUSE_MIN[r.prioridad] ?? 60) * 60_000
}

/** "3 min", "2 h 5 min", "1 d 4 h". */
export function duracion(desde: Date | string, hasta: Date | string): string {
  return minutosATexto((ms(hasta) - ms(desde)) / 60_000)
}

export function minutosATexto(minutos: number): string {
  const min = Math.max(0, Math.round(minutos))
  if (min < 60) return `${min} min`
  if (min < 1_440) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`
  const h = Math.floor((min % 1_440) / 60)
  return `${Math.floor(min / 1_440)} d${h ? ` ${h} h` : ''}`
}

type Cerrado = { createdAt: Date | string; atendidoEn: Date | string | null; resueltoEn: Date | string | null; motivoCierre: string | null }

/** Promedios en minutos (null si no hay datos) y porcentaje de falsas alarmas entre los cerrados con motivo. */
export function metricas(reportes: Cerrado[]) {
  const prom = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const min = (a: Date | string, b: Date | string) => (ms(b) - ms(a)) / 60_000
  const conMotivo = reportes.filter((r) => r.motivoCierre)
  return {
    acuseMin: prom(reportes.filter((r) => r.atendidoEn).map((r) => min(r.createdAt, r.atendidoEn!))),
    resolucionMin: prom(reportes.filter((r) => r.resueltoEn).map((r) => min(r.createdAt, r.resueltoEn!))),
    falsasPct: conMotivo.length ? Math.round((100 * conMotivo.filter((r) => r.motivoCierre === 'falsa_alarma').length) / conMotivo.length) : null,
  }
}

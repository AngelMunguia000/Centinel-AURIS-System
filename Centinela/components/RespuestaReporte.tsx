'use client'

import { useState } from 'react'
import { MOTIVOS_CIERRE, MOTIVO_LABELS, META_ACUSE_MIN, duracion, vencido, type MotivoCierre } from '@/lib/respuesta'

// Respuesta a alarmas (lib/respuesta.ts), compartido por ReportesList y OperadorReportesQueue:
// cada reporte dice en qué punto del ciclo está (pendiente → en atención → cerrado con motivo)
// y cuánto se tardó, como en una central de monitoreo.

export type ReporteConRespuesta = {
  estado: string
  prioridad: string
  createdAt: string
  atendidoEn?: string | null
  atendidoPor?: { nombre: string } | null
  resueltoEn?: string | null
  motivoCierre?: string | null
  escaladoEn?: string | null
}

export function EstadoRespuesta({ reporte }: { reporte: ReporteConRespuesta }) {
  const [etiqueta, clase] =
    reporte.estado === 'resuelto' ? ['Resuelto', 'bg-green-500/15 text-green-300']
    : reporte.atendidoEn ? ['En atención', 'bg-sky-500/15 text-sky-300']
    : vencido(reporte) ? ['Vencido', 'bg-red-500/15 text-red-300']
    : ['Pendiente', 'bg-amber-500/15 text-amber-300']
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${clase}`}>
      {etiqueta}
      {reporte.escaladoEn && reporte.estado !== 'resuelto' && <span className="ml-1 normal-case">· escalado</span>}
    </span>
  )
}

export function LineaRespuesta({ reporte }: { reporte: ReporteConRespuesta }) {
  const partes: string[] = []
  if (reporte.atendidoEn) {
    partes.push(`Atendido${reporte.atendidoPor ? ` por ${reporte.atendidoPor.nombre}` : ''} en ${duracion(reporte.createdAt, reporte.atendidoEn)}`)
  } else if (reporte.estado === 'pendiente') {
    partes.push(`Sin acuse · ${vencido(reporte) ? 'venció el plazo de' : 'plazo'} ${META_ACUSE_MIN[reporte.prioridad] ?? 60} min`)
  }
  if (reporte.estado === 'resuelto') {
    if (reporte.motivoCierre) partes.push(`Cerrado como ${MOTIVO_LABELS[reporte.motivoCierre] ?? reporte.motivoCierre}`)
    if (reporte.resueltoEn) partes.push(`resuelto en ${duracion(reporte.createdAt, reporte.resueltoEn)}`)
  }
  if (partes.length === 0) return null
  return <p className="mt-2 text-xs text-foreground/50">{partes.join(' · ')}</p>
}

const boton = 'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

/** Atender (acuse de recibo) y Cerrar, que pide el motivo antes de resolver. */
export function AccionesRespuesta({
  reporte,
  ocupado,
  onAtender,
  onCerrar,
  textoCerrar = 'Cerrar',
}: {
  reporte: ReporteConRespuesta
  ocupado: boolean
  onAtender: () => void
  onCerrar: (motivo: MotivoCierre) => void
  textoCerrar?: string
}) {
  const [eligiendo, setEligiendo] = useState(false)
  if (reporte.estado !== 'pendiente') return null

  if (eligiendo) {
    return (
      <div role="group" aria-label="Motivo de cierre" className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-foreground/50">¿Qué fue?</span>
        {MOTIVOS_CIERRE.map((m) => (
          <button
            key={m}
            type="button"
            disabled={ocupado}
            onClick={() => { onCerrar(m); setEligiendo(false) }}
            className={`${boton} border border-foreground/15 bg-foreground/[0.04] text-foreground`}
          >
            {MOTIVO_LABELS[m]}
          </button>
        ))}
        <button type="button" onClick={() => setEligiendo(false)} className="text-xs text-foreground/50 hover:text-foreground">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!reporte.atendidoEn && (
        <button type="button" disabled={ocupado} onClick={onAtender} className={`${boton} border border-signal/30 bg-signal/15 text-signal`}>
          Atender
        </button>
      )}
      <button type="button" disabled={ocupado} onClick={() => setEligiendo(true)} className={`${boton} bg-primary text-primary-foreground`}>
        {ocupado ? 'Guardando…' : textoCerrar}
      </button>
    </div>
  )
}

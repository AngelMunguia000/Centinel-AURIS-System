'use client'

import { FranjaCifras } from '@/components/marca'
import { useReportesStats } from '@/hooks/use-reportes-stats'
import { minutosATexto } from '@/lib/respuesta'

export default function StatsCards() {
  const { stats, loading, error } = useReportesStats()

  if (error) {
    return (
      <div className="rounded-lg bg-foreground/[0.04] p-6 mb-6">
        <p role="alert" aria-live="polite" className="text-foreground/50 text-sm">
          No se pudieron cargar las estadísticas. Intenta recargar la página.
        </p>
      </div>
    )
  }

  // Misma franja de cifras que las landings; mientras carga muestra guiones en vez de saltar de alto.
  const v = (n: number | undefined) => (loading || !stats ? '—' : n)
  const t = (min: number | null | undefined) => (loading || min == null ? '—' : minutosATexto(min))
  return (
    <FranjaCifras
      className="mb-6"
      items={[
        { valor: v(stats?.reportesPendientes), etiqueta: 'Pendientes', tono: 'senal' },
        { valor: v(stats?.vencidos), etiqueta: 'Vencidos sin acuse', tono: stats?.vencidos ? 'alerta' : 'normal' },
        // Tiempos de respuesta de los últimos 30 días (lib/respuesta.ts).
        { valor: t(stats?.acuseMin), etiqueta: 'Acuse promedio' },
        { valor: t(stats?.resolucionMin), etiqueta: 'Resolución promedio', tono: 'ok' },
      ]}
    />
  )
}

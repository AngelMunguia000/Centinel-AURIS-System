import { useEffect, useState } from 'react'

export interface Stats {
  totalReportes: number
  reportesPendientes: number
  reportesResueltos: number
  // Respuesta a alarmas (lib/respuesta.ts), últimos 30 días; null = sin datos aún.
  acuseMin: number | null
  resolucionMin: number | null
  falsasPct: number | null
  vencidos: number
}

// Compartido por StatsCards.tsx (/dashboard) y OperadorStats.tsx (/operador):
// mismo endpoint, misma forma de datos — antes cada uno repetía su propio
// useEffect/fetch idéntico (AUD2-11, auditoría integral 26 ago). El render
// y el skeleton de carga siguen siendo distintos a propósito en cada uno
// (Fase 45: OperadorStats usa el sistema visual de vidrio, StatsCards no).
export function useReportesStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/reportes/stats', { credentials: 'include' })
        if (res.ok) {
          setStats(await res.json())
        } else {
          setError(true)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}

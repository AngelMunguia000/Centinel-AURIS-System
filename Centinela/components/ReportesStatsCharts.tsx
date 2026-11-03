'use client'

import { useEffect, useState } from 'react'
import { PRIORIDADES, CATEGORIAS } from '@/lib/reportes-catalogos'
import { GlassPanel } from '@/components/glass-panel'
import { AnimatePresence, motion } from 'motion/react'

interface Reporte {
  estado: string
  prioridad: string
  categoria: string | null
}

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

// Reutiliza exactamente los mismos 4 tokens ya usados en los badges de
// OperadorReportesQueue.tsx (Fase 45.5) — es ordinal, no categórico: el orden
// de severidad ya es la identidad, por eso cada barra lleva su etiqueta de
// texto en vez de depender de una leyenda de color aparte.
const PRIORIDAD_COLOR: Record<string, string> = {
  baja: 'var(--muted-foreground)',
  media: 'var(--color-amber-400)',
  alta: 'var(--color-orange-500)',
  critica: 'var(--destructive)',
}

// Paleta categórica validada (dataviz skill, scripts/validate_palette.js):
// slots 1-4 en orden fijo, PASS en claro y oscuro (peor par CVD ΔE 8.4-9.1).
// "Sin categoría" no es una categoría real — gris neutro, fuera de la secuencia.
const CATEGORIA_COLOR: Record<string, string> = {
  Hardware: '#8a9bb0',
  Software: '#d95926',
  Seguridad: '#199e70',
  Cuenta: '#c98500',
}
const SIN_CATEGORIA_COLOR = 'var(--muted-foreground)'

function Bar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const width = count > 0 ? Math.max(pct, 4) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-foreground/50">{label}</span>
      <div className="relative flex-1 h-4">
        <div
          className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width]"
          style={{ width: `${width}%`, backgroundColor: color, minWidth: count > 0 ? '4px' : 0 }}
        />
      </div>
      <span className="w-5 shrink-0 text-right text-xs font-medium text-foreground tabular-nums">{count}</span>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel padding="md" radius="lg">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </GlassPanel>
  )
}

// Fase 50 (recomendación de la bitácora, #1): estadísticas visuales por
// Prioridad y Categoría — el dato ya existe desde la Fase 20, esto es puro
// front-end. No reemplaza StatsCards.tsx (totales/
// pendientes/resueltos), los complementa.
// 06_UI_UX.md §I (2026-09-22): extendido de solo Operador (/operador) a
// también Usuario y Admin (/reportes) — renombrado de OperadorStatsCharts.
// Sigue siendo el mismo componente sin distinción de rol: pide
// GET /api/reportes, que ya filtra por sesión/rol como el resto del sistema,
// así que cada quien ve sus propias gráficas sin lógica de rol aquí.
export default function ReportesStatsCharts() {
  const [reportes, setReportes] = useState<Reporte[] | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/reportes', { credentials: 'include' })
        if (res.ok) setReportes(await res.json())
      } catch (error) {
        console.error('Error cargando gráficas:', error)
      }
    }
    load()
  }, [])

  const total = reportes?.length ?? 0

  const porPrioridad = reportes
    ? PRIORIDADES.map((p) => ({
        label: PRIORIDAD_LABELS[p],
        count: reportes.filter((r) => r.prioridad === p).length,
        color: PRIORIDAD_COLOR[p],
      }))
    : []

  const porCategoria = reportes
    ? [
        ...CATEGORIAS.map((c) => ({
          label: c,
          count: reportes.filter((r) => r.categoria === c).length,
          color: CATEGORIA_COLOR[c],
        })),
        {
          label: 'Sin categoría',
          count: reportes.filter((r) => !r.categoria).length,
          color: SIN_CATEGORIA_COLOR,
        },
      ]
    : []

  return (
    <AnimatePresence mode="wait">
      {!reportes ? (
        <motion.div
          key="loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
        >
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-foreground/[0.04] p-6 animate-pulse h-40" />
          ))}
        </motion.div>
      ) : total === 0 ? (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4"
        >
          <GlassPanel padding="md" radius="lg">
            <p className="text-sm text-foreground/50">Aún no hay reportes para graficar.</p>
          </GlassPanel>
        </motion.div>
      ) : (
        <motion.div
          key="charts"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
        >
          <ChartCard title="Por Prioridad">
            {porPrioridad.map((row) => (
              <Bar key={row.label} label={row.label} count={row.count} total={total} color={row.color} />
            ))}
          </ChartCard>
          <ChartCard title="Por Categoría">
            {porCategoria.map((row) => (
              <Bar key={row.label} label={row.label} count={row.count} total={total} color={row.color} />
            ))}
          </ChartCard>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

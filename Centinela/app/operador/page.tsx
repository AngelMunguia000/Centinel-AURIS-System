import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { requireRole } from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import StatsCards from '../../components/StatsCards'
import ReportesStatsCharts from '../../components/ReportesStatsCharts'
import OperadorReportesQueue from '../../components/OperadorReportesQueue'
import OperadorAlertaModal from '../../components/OperadorAlertaModal'
import { EncabezadoVista } from "@/components/marca"

export const metadata: Metadata = {
  title: "Panel de Operador — Centinela AURIS",
  description: "Cola de trabajo y estadísticas de incidentes para operadores de Centinela AURIS.",
  robots: { index: false, follow: false },
}

const navLinks = [
  { label: "Resumen", href: "#resumen" },
  { label: "Cola de Trabajo", href: "#cola-trabajo" },
]

export default async function OperadorPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requireRole(cookieStore, ['Operador'])

  if (!authorized) {
    redirect(reason === 'no_autenticado' ? '/iniciar-sesion' : '/dashboard')
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader links={navLinks} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 lg:px-8 py-12 space-y-8">
        <EncabezadoVista
          titulo="Cola de trabajo"
          bajada="Las incidencias por atender, con sus filtros y prioridades. Desde aquí se asignan, comentan y resuelven."
        />

        <div id="resumen" className="scroll-mt-24">
          <StatsCards />
          <ReportesStatsCharts />
        </div>
        <div id="cola-trabajo" className="scroll-mt-24">
          <OperadorReportesQueue />
        </div>
      </div>

      <OperadorAlertaModal ultimoLoginAnterior={usuario.ultimoLoginAnterior} />
    </main>
  )
}

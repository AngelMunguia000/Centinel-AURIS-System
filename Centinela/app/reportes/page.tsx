import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPageUser } from '@/lib/page-auth'
import ReporteForm from '@/components/ReporteForm'
import ReportesList from '@/components/ReportesList'
import StatsCards from '@/components/StatsCards'
import ReportesStatsCharts from '@/components/ReportesStatsCharts'
import { Shield, ClipboardList } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import { SeguridadSidebar } from '@/components/SeguridadSidebar'
import { EncabezadoVista } from '@/components/marca'

export const metadata: Metadata = {
  title: "Reportes — Centinela AURIS",
  description: "Gestiona tus reportes de incidentes de seguridad en Centinela AURIS.",
  robots: { index: false, follow: false },
}

export default async function ReportesPage() {
  const user = await getPageUser()

  if (!user) {
    redirect('/iniciar-sesion')
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="reportes" permisos={user.permisos} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
          <EncabezadoVista
            titulo="Reportes"
            bajada={
              user.permisos.includes('reportes.ver_todos')
                ? 'Todas las incidencias del sistema: crea, clasifica y da seguimiento.'
                : 'Tus incidencias: crea una nueva y sigue cómo avanza.'
            }
            acciones={
              <>
                {user.role === 'Operador' && (
                  <Link
                    href="/operador"
                    className="inline-flex items-center gap-2 rounded-md border border-signal/30 bg-signal/15 px-4 py-2 text-sm font-medium text-signal transition-colors hover:bg-signal/25"
                  >
                    <ClipboardList className="h-4 w-4" strokeWidth={1.5} />
                    Mi cola de trabajo
                  </Link>
                )}
                {(user.permisos.includes('usuarios.gestionar') || user.permisos.includes('auditoria.ver')) && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-foreground/[0.06] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/10"
                  >
                    <Shield className="h-4 w-4" strokeWidth={1.5} />
                    Administración
                  </Link>
                )}
              </>
            }
          />

          <StatsCards />

          {/* Crear y graficar se abren a pedido: lo primero a la vista es la lista (auditoría de la consola, 2026-10-24) */}
          <div className="my-6 flex flex-wrap items-start gap-3">
            <details className="group open:w-full [&[open]>summary]:mb-4">
              <summary className="cursor-pointer list-none rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold hover:border-signal/40 hover:text-signal transition-colors [&::-webkit-details-marker]:hidden inline-block">Nuevo reporte</summary>
              <ReporteForm />
            </details>
            <details className="group open:w-full [&[open]>summary]:mb-4">
              <summary className="cursor-pointer list-none rounded-full border border-foreground/15 px-4 py-2 text-sm font-semibold hover:border-signal/40 hover:text-signal transition-colors [&::-webkit-details-marker]:hidden inline-block">Gráficas por prioridad y categoría</summary>
              <ReportesStatsCharts />
            </details>
          </div>

          <ReportesList />
        </div>
      </div>
    </main>
  )
}

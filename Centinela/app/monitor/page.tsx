import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { requirePermiso } from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import { SeguridadSidebar } from '@/components/SeguridadSidebar'
import { MonitorCamaras } from './MonitorCamaras'
import { EncabezadoVista } from "@/components/marca"

export const metadata: Metadata = {
  title: "Monitor en Vivo — Centinela AURIS",
  description: "Nodos de Centinela AURIS en tiempo real: estado, telemetría y comandos.",
  robots: { index: false, follow: false },
}

export default async function MonitorPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requirePermiso(cookieStore, ["dispositivos.propios", "dispositivos.otros"])

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="monitor" permisos={Array.from(usuario.permisos)} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
          <EncabezadoVista
            titulo="Monitor en vivo"
            bajada="Nodos reportados por tus Raspberry Pi, en tiempo real."
          />

          <MonitorCamaras />
        </div>
      </div>
    </main>
  )
}

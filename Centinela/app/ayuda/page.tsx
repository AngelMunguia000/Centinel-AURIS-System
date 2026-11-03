import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { HelpCircle, Mail } from 'lucide-react'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, type GlassBlob } from '@/components/glass-background'
import { GlassPanel } from '@/components/glass-panel'

export const metadata: Metadata = {
  title: "Ayuda — Centinela AURIS",
  description: "Preguntas frecuentes sobre el uso de Centinela AURIS.",
  robots: { index: false, follow: false },
}

const pageBlobs: GlassBlob[] = [
  { color: "#3a2614", size: "55% 40%", position: "8% 5%" },
  { color: "#4a1a22", shape: "circle", size: "9vw", position: "92% 90%" },
]

// 06_UI_UX.md §K: centro de ayuda dentro de la app ya autenticada — antes
// "Soporte" en SeguridadSidebar era decorativo (mismo estado que "Ajustes"
// antes de §A). Contenido distinto del /soporte público (LandingNavigation):
// ahí es un hub de marketing, aquí son dudas de uso ya con sesión iniciada.
const PREGUNTAS = [
  {
    pregunta: "¿Cómo reporto un incidente?",
    respuesta: (
      <>
        Desde <Link href="/reportes" className="underline hover:no-underline">Reportes</Link>,
        llena el formulario &ldquo;Crear Reporte&rdquo; con título, descripción, prioridad y
        categoría (opcional). Queda con estado &ldquo;pendiente&rdquo; hasta que alguien lo atienda.
      </>
    ),
  },
  {
    pregunta: "¿Cómo sé si mi reporte fue atendido?",
    respuesta: (
      <>
        En <Link href="/reportes" className="underline hover:no-underline">Reportes</Link> ves el
        estado de cada uno (pendiente/resuelto). Puedes agregar comentarios directamente en el
        reporte para dar seguimiento o pedir información.
      </>
    ),
  },
  {
    pregunta: "¿Qué diferencia hay entre Usuario, Operador y Admin?",
    respuesta:
      "Usuario reporta y da seguimiento a sus propios incidentes. Operador atiende la cola de reportes que se le asignan. Admin gestiona usuarios, roles y ve el sistema completo.",
  },
  {
    pregunta: "Olvidé mi contraseña o quiero cambiarla",
    respuesta: (
      <>
        Si ya iniciaste sesión, cámbiala desde{" "}
        <Link href="/ajustes" className="underline hover:no-underline">Ajustes</Link>. Si no puedes
        entrar, usa{" "}
        <Link href="/recuperar-contrasena" className="underline hover:no-underline">
          Recuperar contraseña
        </Link>{" "}
        en la pantalla de inicio de sesión.
      </>
    ),
  },
]

async function getUser() {
  const cookieStore = await cookies()
  return getAuthenticatedUsuario(cookieStore)
}

export default async function AyudaPage() {
  const usuario = await getUser()

  if (!usuario) {
    redirect('/iniciar-sesion')
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <AppHeader />

      <div className="relative z-10 container mx-auto px-4 lg:px-8 py-12 max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <HelpCircle className="h-7 w-7" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
          <h1 className="text-3xl font-semibold tracking-[-0.005em] text-white">Ayuda</h1>
        </div>

        <div className="space-y-4">
          {PREGUNTAS.map((item) => (
            <GlassPanel key={item.pregunta} padding="md" radius="md">
              <h2 className="text-white font-semibold mb-2">{item.pregunta}</h2>
              <p className="text-white/60 text-sm leading-relaxed">{item.respuesta}</p>
            </GlassPanel>
          ))}
        </div>

        <GlassPanel padding="md" radius="md" className="mt-6">
          <Link href="/contacto" className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 bg-white/[0.06]">
              <Mail className="h-5 w-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-white font-semibold">¿Nada de esto resolvió tu duda?</h3>
              <p className="text-white/50 text-sm leading-relaxed">Contáctanos directamente</p>
            </div>
          </Link>
        </GlassPanel>
      </div>
    </main>
  )
}

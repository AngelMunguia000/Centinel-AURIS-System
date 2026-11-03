import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import { AjustesClient } from './AjustesClient'

export const metadata: Metadata = {
  title: "Ajustes — Centinela AURIS",
  description: "Administra tu perfil y contraseña en Centinela AURIS.",
  robots: { index: false, follow: false },
}

// 06_UI_UX.md §A: perfil + contraseña + último login. Accesible a las 3 cuentas
// (Usuario/Operador/Admin) — no hay requireRole aquí a propósito.
export default async function AjustesPage() {
  const cookieStore = await cookies()
  const usuario = await getAuthenticatedUsuario(cookieStore)

  if (!usuario) {
    redirect('/iniciar-sesion')
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <AjustesClient
        usuario={{
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          username: usuario.username,
          email: usuario.email,
          telefono: usuario.telefono,
          rol: usuario.rol.nombre,
          ultimoLoginAnterior: usuario.ultimoLoginAnterior,
          tieneContrasena: usuario.password !== null,
        }}
      />
    </main>
  )
}

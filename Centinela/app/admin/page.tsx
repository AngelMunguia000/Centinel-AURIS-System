import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { requirePermiso } from "@/lib/auth"
import { AdminClient } from "./AdminClient"

export const metadata: Metadata = {
  title: "Panel de Administración — Centinela AURIS",
  description: "Gestión de usuarios y reportes de Centinela AURIS.",
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const cookieStore = await cookies()
  // 06_UI_UX.md §F: se entra con usuarios.gestionar o auditoria.ver (por
  // defecto solo Admin). reportes.ver_todos NO basta: todo Operador lo trae.
  const { authorized, usuario, reason } = await requirePermiso(cookieStore, ["usuarios.gestionar", "auditoria.ver"])

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return (
    <AdminClient
      usuarioId={usuario.id}
      esAdmin={usuario.rol.nombre === "Admin"}
      permisos={Array.from(usuario.permisos)}
    />
  )
}

import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { requirePermiso } from "@/lib/auth"
import { DispositivosClient } from "./DispositivosClient"

export const metadata: Metadata = {
  title: "Centro de Dispositivos — Centinela AURIS",
  description: "Estado del equipo de seguridad asociado a tu cuenta.",
  robots: { index: false, follow: false },
}

export default async function DispositivosPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requirePermiso(cookieStore, ["dispositivos.propios", "dispositivos.otros"])

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return (
    <DispositivosClient
      permisos={Array.from(usuario.permisos)}
      nombreUsuario={usuario.username ?? usuario.nombre}
    />
  )
}

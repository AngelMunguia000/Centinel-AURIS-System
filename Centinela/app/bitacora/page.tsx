import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { requirePermiso } from "@/lib/auth"
import { BitacoraClient } from "./BitacoraClient"

export const metadata: Metadata = {
  title: "Bitácora de Incidentes — Centinela AURIS",
  description: "Historial de incidentes y eventos de seguridad.",
  robots: { index: false, follow: false },
}

export default async function BitacoraPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requirePermiso(cookieStore, ["dispositivos.propios", "dispositivos.otros"])

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return <BitacoraClient permisos={Array.from(usuario.permisos)} />
}

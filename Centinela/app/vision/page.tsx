import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { requirePermiso } from "@/lib/auth"
import { VisionClient } from "./VisionClient"

export const metadata: Metadata = {
  title: "Revisión de visión — Centinela AURIS",
  description: "Marcar en las fotos de los nodos si había un ave y medir qué tan bien detecta el modelo.",
  robots: { index: false, follow: false },
}

export default async function VisionPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requirePermiso(cookieStore, "vision.revisar")

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return <VisionClient permisos={Array.from(usuario.permisos)} />
}

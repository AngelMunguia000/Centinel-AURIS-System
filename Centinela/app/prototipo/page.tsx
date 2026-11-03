import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { requireRole } from "@/lib/auth"
import { PrototipoClient } from "./PrototipoClient"

export const metadata: Metadata = {
  title: "Prototipo — Centinela AURIS",
  description: "Módulos del prototipo físico de disuasión y simulación de su funcionamiento.",
  robots: { index: false, follow: false },
}

// Catálogo visible para cualquier usuario autenticado; solo el Admin ejecuta la simulación
// (los endpoints de /api/prototipo/* lo vuelven a verificar en el servidor).
export default async function PrototipoPage() {
  const cookieStore = await cookies()
  const { authorized, usuario, reason } = await requireRole(cookieStore, ["Usuario", "Admin", "Operador"])

  if (!authorized) {
    redirect(reason === "no_autenticado" ? "/iniciar-sesion" : "/dashboard")
  }

  return <PrototipoClient permisos={Array.from(usuario.permisos)} />
}

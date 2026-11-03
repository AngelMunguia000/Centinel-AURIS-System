import type { Metadata } from "next"
import { RecuperarContrasenaClient } from "./RecuperarContrasenaClient"

export const metadata: Metadata = {
  title: "Recuperar Contraseña — Centinela AURIS",
  description: "Restablece la contraseña de tu cuenta de Centinela AURIS.",
}

export default function RecuperarContrasenaPage() {
  return <RecuperarContrasenaClient />
}

import type { Metadata } from "next"
import { RegistrarseClient } from "./RegistrarseClient"

export const metadata: Metadata = {
  title: "Crear Cuenta — Centinela AURIS",
  description: "Crea tu cuenta en Centinela AURIS y empieza a gestionar tus incidentes de seguridad.",
}

export default function RegisterPage() {
  return <RegistrarseClient />
}

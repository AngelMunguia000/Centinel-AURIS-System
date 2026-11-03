import type { Metadata } from "next"
import { CuestionarioClient } from "./CuestionarioClient"

export const metadata: Metadata = {
  title: "Encuentra tu Centinela",
  description: "Cuéntanos sobre tu organización y te contactamos para mostrarte cómo Centinela puede ayudarte.",
}

export default function CuestionarioPage() {
  return <CuestionarioClient />
}

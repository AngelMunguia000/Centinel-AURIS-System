import type { Metadata } from "next"
import { AurisChatClient } from "./AurisChatClient"

export const metadata: Metadata = {
  title: "AURIS Chat — Centinela AURIS",
  description: "Habla con AURIS, el asistente de Centinela.",
}

export default function AurisChatPage() {
  return <AurisChatClient />
}

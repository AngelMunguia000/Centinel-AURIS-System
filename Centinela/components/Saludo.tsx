"use client"

import { useSyncExternalStore } from "react"
import { saludo } from "@/lib/saludo"

const sinSuscripcion = () => () => {}

// La hora es la del navegador (la del usuario), no la del servidor: en SSR se pinta un "Hola"
// neutro y al hidratar se cambia por la frase de su franja horaria.
export function Saludo({ nombre, visita }: { nombre: string; visita?: string }) {
  const ahora = useSyncExternalStore(sinSuscripcion, () => Math.floor(Date.now() / 60_000), () => null)
  const fecha = ahora === null ? null : new Date(ahora * 60_000)
  const dia = fecha ? Math.floor((fecha.getTime() - fecha.getTimezoneOffset() * 60_000) / 86_400_000) : 0

  return (
    <div>
      {/* Compacto: el titular grande es del landing; en la consola el espacio es para los datos */}
      <h1 className="text-2xl md:text-3xl font-bold tracking-[-0.01em] text-balance text-foreground">
        {fecha ? saludo(fecha.getHours(), nombre, dia) : `Hola, ${nombre}`}
        <span className="text-brand">.</span>
      </h1>
      <p className="mt-1 min-h-[20px] text-sm text-foreground/55 first-letter:uppercase">
        {fecha && fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        {fecha && visita ? " · " : ""}
        {visita}
      </p>
    </div>
  )
}

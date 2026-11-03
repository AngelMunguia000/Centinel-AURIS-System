"use client"

import { useState } from "react"
import { AppHeader } from "@/components/app-header"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { SeguridadSidebar } from "@/components/SeguridadSidebar"
import type { Permiso } from "@/lib/permisos"
import { ModulosTab } from "./ModulosTab"
import { SimulacionTab } from "./SimulacionTab"
import { EncabezadoVista } from "@/components/marca"

interface PrototipoClientProps {
  permisos: Permiso[]
}

export function PrototipoClient({ permisos }: PrototipoClientProps) {
  const [pestana, setPestana] = useState<"modulos" | "simulacion">("modulos")

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="prototipo" permisos={permisos} />

        <div className="container mx-auto max-w-6xl flex-1 px-4 py-12 lg:px-8">
          <EncabezadoVista
            titulo="Prototipo Centinela v2"
            bajada="Los módulos del dispositivo físico de disuasión de aves y una simulación de su funcionamiento completo interactuando con Centinela."
          />

          <div className="mb-6 flex gap-2" role="tablist" aria-label="Secciones del prototipo">
            {(
              [
                ["modulos", "Módulos"],
                ["simulacion", "Simulación"],
              ] as const
            ).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  pestana === id
                    ? "border-signal/50 bg-signal/10 text-signal"
                    : "border-foreground/10 text-foreground/60 hover:bg-foreground/[0.06]"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {pestana === "modulos" ? <ModulosTab /> : <SimulacionTab puedeEjecutar={permisos.includes("prototipo.ejecutar")} />}
        </div>
      </div>
    </main>
  )
}

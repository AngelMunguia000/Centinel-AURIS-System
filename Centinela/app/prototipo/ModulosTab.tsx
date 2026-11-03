"use client"

import { useState } from "react"
import { GlassPanel } from "@/components/glass-panel"
import { GRUPOS_MODULO, MODULOS, type Modulo } from "@/lib/prototipo/modulos"

export function ModulosTab() {
  const [seleccionado, setSeleccionado] = useState<Modulo>(MODULOS[0])

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {GRUPOS_MODULO.map((grupo) => (
          <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
            <h3 id={`grupo-${grupo}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              {grupo}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULOS.filter((m) => m.grupo === grupo).map((m) => {
                const activo = seleccionado.id === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setSeleccionado(m)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      activo
                        ? "border-signal/50 bg-signal/10"
                        : "border-foreground/10 bg-foreground/[0.04] hover:bg-foreground/[0.08]"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{m.nombre}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/60">{m.especificacion}</p>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <GlassPanel padding="md" radius="lg" className="h-fit lg:sticky lg:top-24">
        <p className="text-xs font-medium text-accent-foreground">{seleccionado.grupo}</p>
        <h3 className="mt-1 text-xl font-semibold tracking-[-0.005em] text-foreground">{seleccionado.nombre}</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-foreground/50">Función</dt>
            <dd className="text-foreground">{seleccionado.funcion}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Especificación</dt>
            <dd className="text-foreground">{seleccionado.especificacion}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Conexión con Centinela</dt>
            <dd className="text-foreground">{seleccionado.conexion}</dd>
          </div>
          <div>
            <dt className="text-xs text-foreground/50">Fuente</dt>
            <dd className="font-mono text-foreground/80">Centinel v2, PDF {seleccionado.pdf}</dd>
          </div>
        </dl>
      </GlassPanel>
    </div>
  )
}

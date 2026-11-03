"use client"

import { useState } from "react"
import Link from "next/link"
import { Bird, Pause, Play, RotateCcw, Trash2 } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { ESCENARIOS } from "@/lib/prototipo/escenarios"
import { BarrerasSeguridad } from "./BarrerasSeguridad"
import { CampoVision } from "./CampoVision"
import { FsmDiagrama } from "./FsmDiagrama"
import { Indicadores } from "./Indicadores"
import { useSimulacion, type Velocidad } from "./useSimulacion"

const BTN =
  "inline-flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.04] px-3 py-2 text-sm text-foreground transition-colors hover:bg-foreground/[0.08] disabled:cursor-not-allowed disabled:opacity-40"

export function SimulacionTab({ puedeEjecutar }: { puedeEjecutar: boolean }) {
  const sim = useSimulacion(puedeEjecutar)
  const { vista } = sim
  const [pestana, setPestana] = useState<"mqtt" | "guardado">("mqtt")
  const activo = ESCENARIOS.find((e) => e.id === vista.escenario)

  return (
    <div className="space-y-4">
      <div role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
        <p>
          <strong>Simulación.</strong> Las cifras son de diseño, no mediciones. Lo que se guarda en Centinela lleva el prefijo{" "}
          <span className="font-mono">[SIMULADO]</span>.
        </p>
        {!puedeEjecutar && (
          <p className="mt-1 text-foreground/70">Modo lectura: necesitas el permiso para ejecutar la simulación.</p>
        )}
        {sim.guardadoPausado && (
          <p className="mt-1 text-red-300">El guardado en Centinela está en pausa (ver el registro «Guardado»).</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassPanel padding="md" radius="lg" className="lg:col-span-2">
          <CampoVision s={vista.s} ave={vista.ave} puedeEjecutar={puedeEjecutar} onColocar={sim.colocarAve} />
          <Indicadores s={vista.s} cicloPct={vista.cicloPct} />
        </GlassPanel>

        <GlassPanel padding="md" radius="lg" className="space-y-4">
          <FsmDiagrama s={vista.s} />

          <div>
            <p className="mb-2 text-xs font-medium text-foreground/60">Escenarios</p>
            <div className="flex flex-col gap-2">
              {ESCENARIOS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={BTN}
                  disabled={!puedeEjecutar}
                  aria-pressed={vista.escenario === e.id}
                  title={puedeEjecutar ? e.descripcion : "Necesitas el permiso para ejecutar la simulación"}
                  onClick={() => sim.lanzar(e.id)}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
            {activo && <p className="mt-2 text-xs text-foreground/60">{activo.descripcion}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={BTN} onClick={sim.alternar} aria-label={vista.corriendo ? "Pausar" : "Reanudar"}>
              {vista.corriendo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button type="button" className={BTN} onClick={sim.reiniciar} aria-label="Reiniciar la máquina de estados">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" className={BTN} disabled={!puedeEjecutar || !vista.ave} onClick={sim.retirarAve}>
              <Bird className="h-4 w-4" /> Retirar ave
            </button>
            <div className="flex gap-1" role="group" aria-label="Velocidad de la simulación">
              {([1, 2, 4] as Velocidad[]).map((v) => (
                <button key={v} type="button" className={BTN} aria-pressed={vista.velocidad === v} onClick={() => sim.setVelocidad(v)}>
                  {v}×
                </button>
              ))}
            </div>
          </div>

          <button type="button" className={BTN} disabled={!puedeEjecutar} onClick={() => void sim.limpiarDatos()}>
            <Trash2 className="h-4 w-4" /> Limpiar datos simulados
          </button>
        </GlassPanel>
      </div>

      <GlassPanel padding="md" radius="lg">
        <p className="mb-3 text-sm font-medium text-foreground">Barreras de seguridad</p>
        <BarrerasSeguridad activas={vista.barreras} />
      </GlassPanel>

      <GlassPanel padding="md" radius="lg">
        <div className="mb-3 flex gap-2" role="tablist" aria-label="Registros de la simulación">
          {(["mqtt", "guardado"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestana === p}
              className={`${BTN} ${pestana === p ? "bg-foreground/[0.1]" : ""}`}
              onClick={() => setPestana(p)}
            >
              {p === "mqtt" ? "Tópicos MQTT" : "Guardado en Centinela"}
            </button>
          ))}
        </div>
        <ul className="max-h-64 space-y-1 overflow-auto font-mono text-xs text-foreground/80" role="tabpanel">
          {pestana === "mqtt" &&
            (sim.mqtt.length === 0 ? (
              <li className="text-foreground/50">Sin mensajes todavía.</li>
            ) : (
              sim.mqtt.map((m) => (
                <li key={m.id}>
                  <span className="text-foreground/40">{(m.t / 1000).toFixed(1)}s</span> {m.texto}
                </li>
              ))
            ))}
          {pestana === "guardado" &&
            (sim.guardados.length === 0 ? (
              <li className="text-foreground/50">Nada guardado todavía.</li>
            ) : (
              sim.guardados.map((g) => (
                <li key={g.id} className={g.ok ? "" : "text-red-300"}>
                  {g.ok ? "✓" : "✗"} {g.texto}{" "}
                  {g.href && (
                    <Link href={g.href} className="underline">
                      ver reportes
                    </Link>
                  )}
                </li>
              ))
            ))}
        </ul>
      </GlassPanel>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Shield, ShieldOff } from "lucide-react"
import { DIAS_CORTOS, MODOS_ARMADO, MODO_LABELS, describirArmado, leerHorario, type ConArmado, type Horario, type ModoArmado } from "@/lib/edge/armado"
import { hace } from "@/lib/tiempo"

// Armado por Raspberry Pi (roadmap de funciones #4): modo, horario y vacaciones de un lugar.

export type GatewayArmado = ConArmado & {
  id: number
  armadoAhora: boolean
  armadoCambiadoPor: string | null
  armadoCambiadoEn: string | null
}

const HORARIO_INICIAL: Horario = { dias: [0, 1, 2, 3, 4, 5, 6], desde: "22:00", hasta: "07:00" }
const chip = "rounded-md px-3 py-1 text-xs font-medium transition-colors"

// `ahora` viene del panel (se refresca cada 5 s): el render no lee el reloj.
export function ArmadoPi({ g, ahora, onCambio }: { g: GatewayArmado; ahora: number; onCambio: (nuevo: Partial<GatewayArmado>) => void }) {
  const [horario, setHorario] = useState<Horario>(leerHorario(g.horarioArmado) ?? HORARIO_INICIAL)
  const [editando, setEditando] = useState(false)
  const [vacaciones, setVacaciones] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const guardar = async (cuerpo: Record<string, unknown>) => {
    setGuardando(true)
    setError("")
    try {
      const res = await fetch(`/api/edge/gateways/${g.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? "No se pudo guardar.")
        return false
      }
      onCambio(data)
      return true
    } catch {
      setError("No se pudo guardar. Revisa tu conexión.")
      return false
    } finally {
      setGuardando(false)
    }
  }

  const elegirModo = async (modo: ModoArmado) => {
    // Por horario sin horario guardado: primero se define, y "Guardar horario" activa el modo.
    if (modo === "horario" && !g.horarioArmado) return setEditando(true)
    if (await guardar({ modoArmado: modo })) setEditando(false)
  }

  const alternarDia = (d: number) =>
    setHorario((h) => ({ ...h, dias: h.dias.includes(d) ? h.dias.filter((x) => x !== d) : [...h.dias, d] }))

  const vacacionesActivas = !!g.vacacionesHasta && new Date(g.vacacionesHasta).getTime() > ahora
  const Icono = g.armadoAhora ? Shield : ShieldOff

  return (
    <div className="mt-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${g.armadoAhora ? "text-signal" : "text-foreground/50"}`}>
          <Icono className="h-3.5 w-3.5" aria-hidden="true" />
          {g.armadoAhora ? "Armado ahora" : "Desarmado ahora"}
        </span>
        <span className="text-xs text-foreground/60">{describirArmado(g, new Date(ahora))}</span>
        {g.armadoCambiadoEn && (
          <span className="text-xs text-foreground/40">
            cambió {g.armadoCambiadoPor ?? "—"} {hace(g.armadoCambiadoEn, ahora)}
          </span>
        )}
        <div role="group" aria-label="Modo de armado" className="ml-auto inline-flex gap-1">
          {MODOS_ARMADO.map((m) => (
            <button
              key={m}
              type="button"
              disabled={guardando}
              aria-pressed={g.modoArmado === m}
              onClick={() => elegirModo(m)}
              className={`${chip} ${g.modoArmado === m ? "bg-signal/15 text-signal border border-signal/30" : "border border-foreground/10 text-foreground/70 hover:text-foreground"}`}
            >
              {MODO_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {g.modoArmado === "horario" && !editando && (
          <button type="button" onClick={() => setEditando(true)} className="text-foreground/60 hover:text-foreground underline-offset-2 hover:underline">
            Editar horario
          </button>
        )}
        {vacacionesActivas ? (
          <button type="button" disabled={guardando} onClick={() => guardar({ vacacionesHasta: null })} className="text-foreground/60 hover:text-foreground underline-offset-2 hover:underline">
            Terminar modo vacaciones
          </button>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2">
            <label htmlFor={`vac-${g.id}`} className="text-foreground/50">Vacaciones: armado hasta</label>
            <input
              id={`vac-${g.id}`}
              type="date"
              value={vacaciones}
              min={new Date(ahora).toISOString().slice(0, 10)}
              onChange={(e) => setVacaciones(e.target.value)}
              className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-xs text-foreground"
            />
            <button
              type="button"
              disabled={!vacaciones || guardando}
              // Hasta el final del día elegido, en hora local.
              onClick={async () => (await guardar({ vacacionesHasta: new Date(`${vacaciones}T23:59:59`).toISOString() })) && setVacaciones("")}
              className={`${chip} border border-foreground/10 text-foreground/70 hover:text-foreground disabled:opacity-40`}
            >
              Activar
            </button>
          </span>
        )}
      </div>

      {editando && (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-3">
          <div role="group" aria-label="Días armados" className="inline-flex flex-wrap gap-1">
            {DIAS_CORTOS.map((nombre, d) => (
              <button
                key={nombre}
                type="button"
                aria-pressed={horario.dias.includes(d)}
                onClick={() => alternarDia(d)}
                className={`${chip} ${horario.dias.includes(d) ? "bg-foreground/15 text-foreground" : "text-foreground/40 border border-foreground/10"}`}
              >
                {nombre}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-foreground/50">
            de
            <input type="time" value={horario.desde} onChange={(e) => setHorario((h) => ({ ...h, desde: e.target.value }))} className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-xs text-foreground" />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-foreground/50">
            a
            <input type="time" value={horario.hasta} onChange={(e) => setHorario((h) => ({ ...h, hasta: e.target.value }))} className="rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-xs text-foreground" />
          </label>
          <button
            type="button"
            disabled={guardando}
            onClick={async () => (await guardar({ modoArmado: "horario", horario })) && setEditando(false)}
            className={`${chip} bg-primary text-primary-foreground disabled:opacity-50`}
          >
            Guardar horario
          </button>
          <button type="button" onClick={() => setEditando(false)} className="text-xs text-foreground/50 hover:text-foreground">
            Cancelar
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  )
}

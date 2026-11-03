"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Laptop, Loader2, Smartphone } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { hace } from "@/lib/tiempo"

// Sesiones activas (roadmap de funciones #8): dónde está abierta la cuenta y cerrarla a distancia.

type Sesion = { id: string; dispositivo: string; ip: string | null; via: string; creadaEn: string; ultimaActividad: string; actual: boolean }

export function SesionesActivas() {
  const router = useRouter()
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null)
  const [ahora, setAhora] = useState(0)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState("")

  const cargar = () =>
    fetch("/api/perfil/sesiones", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setSesiones(d.sesiones)
        setAhora(Date.now())
      })
      .catch(() => setError("No se pudieron cargar las sesiones."))

  useEffect(() => {
    cargar()
  }, [])

  const cerrar = async (s: Sesion) => {
    setOcupado(s.id)
    setError("")
    const res = await fetch(`/api/perfil/sesiones/${s.id}`, { method: "DELETE", credentials: "include" }).catch(() => null)
    setOcupado(null)
    if (!res?.ok) return setError("No se pudo cerrar la sesión.")
    if (s.actual) return router.push("/iniciar-sesion")
    cargar()
  }

  const cerrarOtras = async () => {
    setOcupado("otras")
    setError("")
    const res = await fetch("/api/perfil/sesiones/cerrar-otras", { method: "POST", credentials: "include" }).catch(() => null)
    setOcupado(null)
    if (!res?.ok) return setError("No se pudieron cerrar las demás sesiones.")
    cargar()
  }

  const otras = sesiones?.filter((s) => !s.actual).length ?? 0

  return (
    <GlassPanel padding="md" radius="lg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Laptop className="h-5 w-5 text-accent-foreground" />
          Sesiones activas
        </h2>
        {otras > 0 && (
          <button
            type="button"
            onClick={cerrarOtras}
            disabled={ocupado !== null}
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground hover:border-signal/40 hover:text-signal disabled:opacity-50"
          >
            {ocupado === "otras" ? "Cerrando…" : `Cerrar las demás (${otras})`}
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-foreground/50">
        Si no reconoces una, ciérrala y cambia tu contraseña. Cambiar la contraseña cierra todas las demás.
      </p>

      {sesiones === null && !error && <p className="text-sm text-foreground/50">Cargando…</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      {sesiones && (
        <ul className="divide-y divide-foreground/10">
          {sesiones.map((s) => {
            const Icono = /iPhone|Android|iPad/.test(s.dispositivo) ? Smartphone : Laptop
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <Icono className="h-4 w-4 text-foreground/50" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    {s.dispositivo}
                    {s.actual && <span className="ml-2 rounded-full bg-signal/15 px-2 py-0.5 text-xs text-signal">Esta sesión</span>}
                  </p>
                  <p className="text-xs text-foreground/50">
                    Activa {hace(s.ultimaActividad, ahora)} · inició {hace(s.creadaEn, ahora)}
                    {s.via === "oauth" ? " con Google/GitHub" : ""}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cerrar(s)}
                  disabled={ocupado !== null}
                  className="rounded-md bg-foreground/10 px-3 py-1 text-xs text-foreground hover:bg-foreground/15 disabled:opacity-50"
                >
                  {ocupado === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : s.actual ? "Salir" : "Cerrar"}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </GlassPanel>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Mail } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"

// Resumen semanal por correo (roadmap de funciones #7): activarlo, ver cómo llega y pedirlo ahora.

export function ResumenSemanal() {
  const [activo, setActivo] = useState<boolean | null>(null)
  const [html, setHtml] = useState("")
  const [viendo, setViendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null)

  useEffect(() => {
    fetch("/api/perfil/resumen", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setActivo(d.activo)
        setHtml(d.html ?? "")
      })
      .catch(() => setMensaje({ texto: "No se pudo cargar el resumen semanal.", error: true }))
  }, [])

  const cambiar = async (valor: boolean) => {
    setActivo(valor)
    setMensaje(null)
    const res = await fetch("/api/perfil/resumen", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: valor }),
    }).catch(() => null)
    if (!res?.ok) {
      setActivo(!valor)
      setMensaje({ texto: "No se pudo guardar el cambio.", error: true })
    }
  }

  const enviarAhora = async () => {
    setOcupado(true)
    setMensaje(null)
    const res = await fetch("/api/perfil/resumen", { method: "POST", credentials: "include" }).catch(() => null)
    const data = await res?.json().catch(() => null)
    setOcupado(false)
    setMensaje(res?.ok ? { texto: `Enviado a ${data.a}.`, error: false } : { texto: data?.error ?? "No se pudo enviar.", error: true })
  }

  return (
    <GlassPanel padding="md" radius="lg">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
        <Mail className="h-5 w-5 text-accent-foreground" />
        Resumen semanal
      </h2>
      <p className="mb-4 text-xs text-foreground/50">
        Cada lunes a las 8:00 te llega por correo lo que pasó en la semana: reportes, tiempos de respuesta y el estado de tus equipos.
      </p>

      {activo !== null && (
        <label className="flex items-center gap-3 text-sm text-foreground">
          <input type="checkbox" checked={activo} onChange={(e) => cambiar(e.target.checked)} className="h-4 w-4 accent-[var(--signal)]" />
          Recibir el resumen semanal
        </label>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViendo((v) => !v)}
          disabled={!html}
          className="rounded-md bg-foreground/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/15 disabled:opacity-50"
        >
          {viendo ? "Ocultar ejemplo" : "Ver cómo llega"}
        </button>
        <button
          type="button"
          onClick={enviarAhora}
          disabled={ocupado}
          className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium text-foreground hover:border-signal/40 hover:text-signal disabled:opacity-50"
        >
          {ocupado ? "Enviando…" : "Enviármelo ahora"}
        </button>
      </div>

      {mensaje && (
        <p role={mensaje.error ? "alert" : "status"} className={`mt-3 text-sm ${mensaje.error ? "text-red-300" : "text-green-400"}`}>
          {mensaje.texto}
        </p>
      )}

      {viendo && (
        // sandbox sin permisos: el HTML del correo se ve tal cual, sin ejecutar nada.
        <iframe title="Vista previa del resumen semanal" sandbox="" srcDoc={html} className="mt-4 h-[560px] w-full rounded-md border border-foreground/10 bg-white" />
      )}
    </GlassPanel>
  )
}

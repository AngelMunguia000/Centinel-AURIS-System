"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { AlertTriangle } from "lucide-react"

type Estado = "inactivo" | "confirmando" | "enviando" | "enviado" | "error"

// Botón de pánico (POST /api/panico): abre una incidencia crítica y avisa a Operadores y Admin.
// Siempre pide confirmación. `compacto` es la versión de la barra inferior en móvil.
export function BotonPanico({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("inactivo")
  const [mensaje, setMensaje] = useState("")

  const activar = async () => {
    setEstado("enviando")
    try {
      const res = await fetch("/api/panico", { method: "POST", credentials: "include" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? "No se pudo enviar la alerta.")
      setEstado("enviado")
      setMensaje(data.avisados > 0 ? `Alerta enviada a ${data.avisados} responsables.` : "Incidencia crítica creada.")
    } catch (e) {
      setEstado("error")
      setMensaje(e instanceof Error ? e.message : "No se pudo enviar la alerta.")
    }
  }

  const confirmacion = (
    <div className="rounded-lg border border-red-500/40 bg-red-950/90 p-3 backdrop-blur-xl">
      <p className="text-xs text-red-100 leading-relaxed">
        Se abrirá una incidencia crítica y se avisará a todos los Operadores. ¿Continuar?
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={activar} className="flex-1 rounded-md bg-red-600 hover:bg-red-500 px-2 py-1.5 text-xs font-semibold text-white">
          Sí, pedir ayuda
        </button>
        <button type="button" onClick={() => setEstado("inactivo")} className="rounded-md bg-foreground/10 px-2 py-1.5 text-xs text-foreground">
          Cancelar
        </button>
      </div>
    </div>
  )

  const aviso = (estado === "enviado" || estado === "error") && (
    <p role="status" className={`text-xs ${estado === "enviado" ? "text-green-400" : "text-red-300"}`}>{mensaje}</p>
  )

  if (compacto) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEstado("confirmando")}
          disabled={estado === "enviando"}
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-semibold text-red-300 disabled:opacity-60"
        >
          <AlertTriangle className="h-5 w-5" />
          <span className="truncate">{estado === "enviando" ? "Enviando" : "Pánico"}</span>
        </button>
        {/* Portal: dentro de la barra (fixed + backdrop-blur) quedaría atrapado bajo el botón del chat. */}
        {(estado === "confirmando" || aviso) &&
          createPortal(
            <div className="fixed inset-x-3 bottom-[4.75rem] z-[60]" aria-live="polite">
              {estado === "confirmando" ? confirmacion : <div className="rounded-lg border border-foreground/10 bg-background/95 p-3">{aviso}</div>}
            </div>,
            document.body,
          )}
      </>
    )
  }

  return (
    <div aria-live="polite">
      {estado === "confirmando" ? (
        confirmacion
      ) : (
        <button
          type="button"
          onClick={() => setEstado("confirmando")}
          disabled={estado === "enviando"}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          <AlertTriangle className="h-4 w-4" />
          {estado === "enviando" ? "Enviando…" : "Pánico"}
        </button>
      )}
      {aviso && <div className="mt-2">{aviso}</div>}
    </div>
  )
}

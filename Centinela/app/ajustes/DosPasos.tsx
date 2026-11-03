"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, Copy, ShieldCheck } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"

// Verificación en dos pasos (roadmap de funciones #8): activar con QR, códigos de respaldo
// (se muestran una sola vez), regenerarlos y desactivar. Todo pasa por /api/perfil/2fa.

type Estado = { activo: boolean; activadoEn: string | null; codigosRestantes: number }
type Paso = "nada" | "qr" | "regenerar" | "desactivar"

const input = "rounded-md border border-foreground/15 bg-transparent px-3 py-2 font-mono text-sm tracking-[0.2em] text-foreground w-36"
const boton = "rounded-md px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"

export function DosPasos() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [paso, setPaso] = useState<Paso>("nada")
  const [qr, setQr] = useState<{ qr: string; secreto: string } | null>(null)
  const [codigo, setCodigo] = useState("")
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")

  const cargar = () =>
    fetch("/api/perfil/2fa", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEstado)
      .catch(() => setError("No se pudo cargar el estado de la verificación en dos pasos."))

  useEffect(() => {
    cargar()
  }, [])

  const pedir = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true)
    setError("")
    try {
      const res = await fetch("/api/perfil/2fa", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar.")
        return null
      }
      return data
    } catch {
      setError("No se pudo completar. Revisa tu conexión.")
      return null
    } finally {
      setOcupado(false)
    }
  }

  const iniciar = async () => {
    const data = await pedir({ accion: "iniciar" })
    if (data) {
      setQr({ qr: data.qr, secreto: data.secreto })
      setCodigo("")
      setPaso("qr")
    }
  }

  const confirmar = async (e: FormEvent) => {
    e.preventDefault()
    const accion = paso === "qr" ? "activar" : paso
    const data = await pedir({ accion, codigo })
    if (!data) return
    setCodigo("")
    setPaso("nada")
    setQr(null)
    if (data.codigos) {
      setCodigos(data.codigos)
      setCopiado(false)
    }
    cargar()
  }

  const copiar = async () => {
    if (!codigos) return
    await navigator.clipboard.writeText(codigos.join("\n")).catch(() => {})
    setCopiado(true)
  }

  return (
    <GlassPanel padding="md" radius="lg">
      <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-accent-foreground" />
        Verificación en dos pasos
      </h2>
      <p className="mb-4 text-xs text-foreground/50">
        Además de la contraseña, al entrar se pide un código de una app como Google Authenticator o Microsoft Authenticator.
      </p>

      {estado === null && !error && <p className="text-sm text-foreground/50">Cargando…</p>}

      {codigos && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4" role="status">
          <p className="text-sm font-medium text-foreground">Guarda estos códigos de respaldo. No se volverán a mostrar.</p>
          <p className="mb-3 text-xs text-foreground/60">Cada uno sirve una sola vez para entrar si no tienes el teléfono.</p>
          <ul data-testid="codigos-respaldo" className="mb-3 grid grid-cols-2 gap-1 font-mono text-sm text-foreground">
            {codigos.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className={`${boton} inline-flex items-center gap-1.5 bg-foreground/10 text-foreground`}>
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiados" : "Copiar"}
            </button>
            <button type="button" onClick={() => setCodigos(null)} className={`${boton} bg-primary text-primary-foreground`}>
              Ya los guardé
            </button>
          </div>
        </div>
      )}

      {estado && !estado.activo && paso === "nada" && (
        <button type="button" onClick={iniciar} disabled={ocupado} className={`${boton} bg-primary text-primary-foreground`}>
          Activar
        </button>
      )}

      {paso === "qr" && qr && (
        <div className="flex flex-wrap items-start gap-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generada en el servidor, no hay nada que optimizar */}
          <img src={qr.qr} alt="Código QR para la app de autenticación" width={180} height={180} className="rounded-md bg-white p-1" />
          <div className="min-w-0 flex-1 space-y-2 text-sm text-foreground/70">
            <p>1. Escanea el código con tu app de autenticación.</p>
            <p className="text-xs text-foreground/50">
              ¿No puedes escanear? Escribe esta clave: <code className="break-all text-foreground">{qr.secreto}</code>
            </p>
            <p>2. Escribe el código de 6 dígitos que muestra la app.</p>
          </div>
        </div>
      )}

      {estado?.activo && paso === "nada" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-xs text-green-300">Activa</span>
          <span className="text-xs text-foreground/50">
            {estado.codigosRestantes} código{estado.codigosRestantes === 1 ? "" : "s"} de respaldo sin usar
          </span>
          <span className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setPaso("regenerar")} className={`${boton} bg-foreground/10 text-foreground`}>
              Códigos de respaldo nuevos
            </button>
            <button type="button" onClick={() => setPaso("desactivar")} className={`${boton} border border-red-500/30 bg-red-500/10 text-red-300`}>
              Desactivar
            </button>
          </span>
        </div>
      )}

      {paso !== "nada" && (
        <form onSubmit={confirmar} className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="codigo-2fa" className="text-xs text-foreground/50">
            {paso === "desactivar" ? "Código de la app o de respaldo" : "Código de la app"}
          </label>
          <input
            id="codigo-2fa"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            autoComplete="one-time-code"
            inputMode={paso === "desactivar" ? "text" : "numeric"}
            maxLength={20}
            autoFocus
            className={input}
          />
          <button type="submit" disabled={ocupado || codigo.trim().length < 6} className={`${boton} bg-primary text-primary-foreground`}>
            {paso === "qr" ? "Activar" : paso === "regenerar" ? "Generar" : "Desactivar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPaso("nada")
              setQr(null)
              setCodigo("")
              setError("")
            }}
            className="text-xs text-foreground/50 hover:text-foreground"
          >
            Cancelar
          </button>
        </form>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    </GlassPanel>
  )
}

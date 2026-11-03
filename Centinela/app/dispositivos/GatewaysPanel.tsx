"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, Copy, Cpu, Plus } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { useEdgeStream } from "@/hooks/use-edge-stream"
import type { EstadoNodo } from "@/lib/edge/estado"
import { hace } from "@/lib/tiempo"
import { ArmadoPi, type GatewayArmado } from "./ArmadoPi"

// Spec 2026-10-16-enlace-edge-design.md §6.1: vincular Raspberry Pi, token una sola vez, nodos en vivo.

interface GatewayFila extends GatewayArmado {
  nombre: string
  urlBase: string
  ultimoContacto: string | null
  revocadoEn: string | null
}

const SIN_CONTACTO_MS = 10_000
const REFRESCO_MS = 5_000

const ESTADO_NODO: Record<EstadoNodo, { texto: string; punto: string }> = {
  en_linea: { texto: "En línea", punto: "bg-green-500" },
  desconectado: { texto: "Desconectado", punto: "bg-red-500" },
  sin_contacto: { texto: "Sin contacto con la Pi", punto: "bg-amber-500" },
}

export function GatewaysPanel() {
  const { nodos, conectado } = useEdgeStream()
  const [gateways, setGateways] = useState<GatewayFila[]>([])
  const [ahora, setAhora] = useState(0)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [urlBase, setUrlBase] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [tokenNuevo, setTokenNuevo] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  // Las revocadas antes de abrir la página se pliegan; la que se revoca ahora se queda a la vista.
  const [revocadasAhora, setRevocadasAhora] = useState<Set<number>>(new Set())

  useEffect(() => {
    const cargar = () =>
      fetch("/api/edge/gateways", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setGateways(data.gateways)
          setAhora(Date.now())
        })
        .catch(() => {})
    cargar()
    const intervalo = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [])

  const vincular = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError("")
    try {
      const res = await fetch("/api/edge/gateways", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, urlBase }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 400 ? "Revisa el nombre y la dirección (ej. http://192.168.1.50:8000)." : data.error ?? "No se pudo vincular.")
        return
      }
      const { token, ...fila } = data
      setGateways((prev) => [fila, ...prev])
      setTokenNuevo(token)
      setNombre("")
      setUrlBase("")
      setMostrarForm(false)
    } catch {
      setError("No se pudo vincular. Revisa tu conexión.")
    } finally {
      setEnviando(false)
    }
  }

  const revocar = async (id: number) => {
    const res = await fetch(`/api/edge/gateways/${id}`, { method: "DELETE", credentials: "include" })
    if (res.ok) {
      setGateways((prev) => prev.map((g) => (g.id === id ? { ...g, revocadoEn: new Date().toISOString() } : g)))
      setRevocadasAhora((prev) => new Set(prev).add(id))
    }
    setConfirmando(null)
  }

  const copiar = async () => {
    if (!tokenNuevo) return
    await navigator.clipboard.writeText(tokenNuevo).catch(() => {})
    setCopiado(true)
  }

  const fila = (g: GatewayFila) => {
    const vivo = !!g.ultimoContacto && ahora - new Date(g.ultimoContacto).getTime() <= SIN_CONTACTO_MS
    const suyos = nodos.filter((n) => n.gatewayId === g.id)
    return (
      <li key={g.id} data-testid="gateway-fila" className="py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm font-medium text-foreground">{g.nombre}</span>
          <span className="text-xs font-mono text-foreground/50">{g.urlBase}</span>
          <span
            className={`text-xs ${
              g.revocadoEn ? "text-foreground/40" : vivo ? "text-green-400" : "text-amber-400"
            }`}
          >
            {g.revocadoEn ? "Revocada" : vivo ? "En línea" : "Sin contacto"}
          </span>
          <span className="text-xs text-foreground/40">último contacto {hace(g.ultimoContacto, ahora)}</span>
          {!g.revocadoEn && (
            <span className="ml-auto flex gap-2">
              {confirmando === g.id ? (
                <>
                  <button type="button" onClick={() => revocar(g.id)} className="rounded-md bg-red-600 text-white px-3 py-1 text-xs">
                    Confirmar revocación
                  </button>
                  <button type="button" onClick={() => setConfirmando(null)} className="rounded-md bg-foreground/10 px-3 py-1 text-xs text-foreground">
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmando(g.id)} className="rounded-md bg-foreground/10 hover:bg-foreground/15 px-3 py-1 text-xs text-foreground">
                  Revocar
                </button>
              )}
            </span>
          )}
        </div>
        {!g.revocadoEn && (
          <ArmadoPi g={g} ahora={ahora} onCambio={(nuevo) => setGateways((prev) => prev.map((x) => (x.id === g.id ? { ...x, ...nuevo } : x)))} />
        )}
        {suyos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {suyos.map((n) => (
              <li key={n.id} className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1 text-xs text-foreground/70">
                <span className={`h-2 w-2 rounded-full ${ESTADO_NODO[n.estado].punto}`} aria-hidden="true" />
                <span className="font-mono">{n.nombre}</span>
                <span>{ESTADO_NODO[n.estado].texto}</span>
                <span className="text-foreground/40">{hace(n.ultimoContacto, ahora)}</span>
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  const visibles = gateways.filter((g) => !g.revocadoEn || revocadasAhora.has(g.id))
  const archivadas = gateways.filter((g) => g.revocadoEn && !revocadasAhora.has(g.id))

  return (
    <GlassPanel padding="md" radius="lg" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-foreground font-medium flex items-center gap-2">
            <Cpu className="h-4 w-4 text-accent-foreground" />
            Raspberry Pi vinculadas
          </h2>
          <p className="text-xs text-foreground/50 mt-0.5">
            Cada Pi reporta sus nodos ESP32 en tiempo real.{" "}
            {!conectado && <span className="text-amber-400">Reconectando…</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-foreground/10 hover:bg-foreground/15 text-foreground px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="h-4 w-4" />
          Vincular Raspberry Pi
        </button>
      </div>

      {mostrarForm && (
        <form onSubmit={vincular} className="flex flex-wrap items-end gap-4 mb-4">
          <div className="flex-1 min-w-[180px]">
            <label htmlFor="gw-nombre" className="text-xs text-foreground/50 block mb-1.5">
              Nombre de la Pi
            </label>
            <input
              id="gw-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              required
              placeholder="Pi del jardín"
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm text-foreground"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="gw-url" className="text-xs text-foreground/50 block mb-1.5">
              Dirección de la Pi
            </label>
            <input
              id="gw-url"
              value={urlBase}
              onChange={(e) => setUrlBase(e.target.value)}
              required
              placeholder="http://192.168.1.50:8000"
              className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm text-foreground font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {enviando ? "Generando…" : "Generar token"}
          </button>
          {error && <p className="w-full text-sm text-red-300" role="alert">{error}</p>}
        </form>
      )}

      {tokenNuevo && (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-4" role="status">
          <p className="text-sm text-foreground font-medium mb-1">Este token no se volverá a mostrar.</p>
          <p className="text-xs text-foreground/60 mb-3">
            Pégalo en <code>edge/pi-gateway/.env</code> como <code>CENTINELA_GATEWAY_TOKEN</code>.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code data-testid="token-gateway" className="flex-1 min-w-0 break-all rounded bg-foreground/10 px-3 py-2 text-xs text-foreground">
              {tokenNuevo}
            </code>
            <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 px-3 py-2 text-xs text-foreground">
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setTokenNuevo(null)
                setCopiado(false)
              }}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-medium"
            >
              Ya lo copié
            </button>
          </div>
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="text-sm text-foreground/50 py-2">Aún no hay ninguna Raspberry Pi activa.</p>
      ) : (
        <ul className="divide-y divide-foreground/10">{visibles.map(fila)}</ul>
      )}

      {archivadas.length > 0 && (
        <details className="mt-4 rounded-lg border border-foreground/10 px-4 py-2">
          <summary className="cursor-pointer select-none py-1 text-xs font-medium uppercase tracking-wider text-foreground/50 hover:text-foreground/80">
            Revocadas ({archivadas.length})
          </summary>
          <ul className="divide-y divide-foreground/10 opacity-70">{archivadas.map(fila)}</ul>
        </details>
      )}
    </GlassPanel>
  )
}

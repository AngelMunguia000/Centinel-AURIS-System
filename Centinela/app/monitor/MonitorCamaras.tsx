"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { VideoOff } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { useEdgeStream } from "@/hooks/use-edge-stream"
import type { Comando } from "@/lib/edge/contrato"
import type { ResultadoComando } from "@/lib/edge/comandos"
import type { EstadoNodo, EventoVivo, NodoVivo } from "@/lib/edge/estado"
import { CamaraAmpliada } from "./CamaraAmpliada"

// Spec 2026-10-16-enlace-edge-design.md §6.2: Monitor en Vivo sobre los nodos reales.
// (Nombre de archivo histórico: cuando llegue la cámara OV5640, cada nodo vuelve a tener video.)

export const ESTADO_UI: Record<EstadoNodo, { texto: string; badge: string; dot: string }> = {
  en_linea: { texto: "En línea", badge: "bg-foreground/10 text-foreground", dot: "bg-green-400" },
  desconectado: { texto: "Desconectado", badge: "bg-red-500 text-white", dot: "bg-white" },
  sin_contacto: { texto: "Sin contacto con la Pi", badge: "bg-amber-500 text-black", dot: "bg-black/60" },
}

export function textoResultado(r: ResultadoComando): string {
  switch (r.estado) {
    case "ok":
      return `Confirmado (${r.latenciaMs} ms)`
    case "timeout":
      return "El nodo no respondió"
    case "pi_inaccesible":
      return "No hay conexión con la Pi"
    default:
      return r.error ?? "Error al ejecutar el comando"
  }
}

export async function mandarComando(nodoId: number, comando: Comando): Promise<ResultadoComando> {
  const res = await fetch(`/api/edge/nodos/${nodoId}/comandos`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comando),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return { estado: "error", error: data?.error ?? `Error HTTP ${res.status}`, latenciaMs: 0 }
  return data as ResultadoComando
}

function formatoUptime(s: number | undefined): string {
  if (s === undefined) return "—"
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min ${s % 60} s`
}

/** Tarjeta "pantalla" del nodo: estado, identificación y telemetría en vivo. */
export function NodoVisual({ nodo, children }: { nodo: NodoVivo; children?: ReactNode }) {
  const ui = ESTADO_UI[nodo.estado]
  const t = nodo.telemetria
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 2px, transparent 2px, transparent 26px)",
          backgroundColor: "#0a0d12",
        }}
      />
      {/* Video en vivo (MJPEG vía web → Pi → nodo, app/api/edge/nodos/[id]/video): un <img> lo reproduce solo. */}
      {nodo.capacidades?.camara === "real" && nodo.estado === "en_linea" && (
        // eslint-disable-next-line @next/next/no-img-element -- stream MJPEG privado, next/image no aplica
        <img src={`/api/edge/nodos/${nodo.id}/video`} alt={`Video en vivo de ${nodo.nombre}`} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {nodo.capacidades?.camara !== "real" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <VideoOff className="h-5 w-5 text-white/20" strokeWidth={1.5} />
          <span className="text-[9px] font-semibold uppercase tracking-widest text-white/30">Sin cámara conectada</span>
        </div>
      )}
      <div className={`absolute top-3 left-3 flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-widest ${ui.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${ui.dot} ${nodo.estado === "en_linea" ? "motion-safe:animate-pulse" : ""}`} />
        {ui.texto}
      </div>
      <div className="absolute top-3 right-3 text-right text-white/50 text-[9px] font-mono leading-tight">
        {nodo.nombre}
        {nodo.gatewayNombre && <div className="text-white/30">vía {nodo.gatewayNombre}</div>}
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex justify-between gap-2 text-[10px] font-mono text-white/70">
        <span>{t?.temp_c !== undefined ? `${t.temp_c.toFixed(1)} °C` : "— °C"}</span>
        <span>{t?.rssi_dbm !== undefined ? `${t.rssi_dbm} dBm` : "— dBm"}</span>
        <span>{formatoUptime(t?.uptime_s)}</span>
      </div>
      {children}
    </>
  )
}

export function MonitorCamaras() {
  const { nodos, conectado, eventos: enVivo } = useEdgeStream()
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null)
  // Precarga: sin esto el panel abre vacío aunque haya habido eventos hace un minuto.
  const [previos, setPrevios] = useState<EventoVivo[]>([])
  useEffect(() => {
    fetch("/api/edge/eventos?limite=8", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPrevios(data.eventos))
      .catch((error) => console.error("Error cargando eventos recientes:", error))
  }, [])
  const eventos = [...enVivo, ...previos.filter((p) => !enVivo.some((e) => e.id === p.id))]
  // Se busca en cada render para que el diálogo abierto siga recibiendo telemetría en vivo.
  const seleccionado = nodos.find((n) => n.id === seleccionadoId) ?? null
  const enLinea = nodos.filter((n) => n.estado === "en_linea").length
  const alertas = enVivo.filter((e) => e.severidad === "alta").length

  return (
    <>
      {!conectado && (
        <p className="mb-4 text-xs font-medium text-amber-400" role="status">
          Reconectando con el servidor…
        </p>
      )}

      {nodos.length === 0 ? (
        <GlassPanel padding="lg" radius="lg">
          <p className="text-foreground/60 text-sm text-center py-8">
            Aún no hay nodos. Vincula una Raspberry Pi en{" "}
            <Link href="/dispositivos" className="underline underline-offset-4 text-foreground">
              Centro de Dispositivos
            </Link>
            .
          </p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodos.map((nodo) => (
            <button
              key={nodo.id}
              type="button"
              onClick={() => setSeleccionadoId(nodo.id)}
              aria-haspopup="dialog"
              aria-label={`Abrir nodo ${nodo.nombre}, estado ${ESTADO_UI[nodo.estado].texto}`}
              className={`relative aspect-video w-full text-left rounded-[16px] overflow-hidden border bg-[#0a0d12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                nodo.estado === "en_linea" ? "border-white/10" : "border-signal/40"
              }`}
            >
              <NodoVisual nodo={nodo} />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
        <GlassPanel padding="md" radius="lg" className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Eventos recientes</h2>
            <span className="text-[9px] font-mono text-foreground/30">Se actualiza en vivo</span>
          </div>
          {eventos.length === 0 ? (
            <p className="text-[11px] text-foreground/40">Sin eventos todavía.</p>
          ) : (
            <div className="space-y-3">
              {eventos.slice(0, 8).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-[11px] gap-3">
                  <span className="text-foreground/40 font-mono shrink-0">{new Date(e.ocurridoEn).toLocaleTimeString("es-MX")}</span>
                  <span className="flex-1 text-foreground/80 font-medium">
                    {e.dispositivoNombre}: {e.tipo}
                    {e.detalle ? ` — ${e.detalle}` : ""}
                  </span>
                  <span className={`font-bold uppercase tracking-tight shrink-0 ${e.severidad === "alta" ? "text-red-400" : "text-foreground/40"}`}>
                    {e.severidad}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel padding="md" radius="lg">
          <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Nodos en línea</h2>
          <p className="font-mono text-4xl font-medium text-foreground mt-4">
            {enLinea}
            <span className="text-foreground/40 text-xl"> / {nodos.length}</span>
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground/40 mt-1">En tiempo real</p>
        </GlassPanel>

        <GlassPanel padding="md" radius="lg" className="border border-foreground/20">
          <h2 className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Alertas altas</h2>
          <div className="flex items-center gap-4 mt-4">
            <p className={`font-mono text-4xl font-medium leading-none ${alertas > 0 ? "text-brand" : "text-foreground"}`}>{alertas}</p>
            <Link href="/bitacora" className="text-[10px] font-semibold uppercase tracking-wider text-signal underline underline-offset-4">
              Ver bitácora
            </Link>
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-foreground/40 mt-1">Desde que abriste esta página</p>
        </GlassPanel>
      </div>

      {seleccionado && <CamaraAmpliada key={seleccionado.id} nodo={seleccionado} onClose={() => setSeleccionadoId(null)} />}
    </>
  )
}

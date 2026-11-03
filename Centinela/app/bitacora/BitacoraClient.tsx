"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { SeguridadSidebar } from "@/components/SeguridadSidebar"
import { useEdgeStream } from "@/hooks/use-edge-stream"
import type { Severidad } from "@/lib/edge/contrato"
import type { EventoVivo } from "@/lib/edge/estado"
import type { Permiso } from "@/lib/permisos"
import { EvidenciaFoto } from "@/components/EvidenciaFoto"
import { EncabezadoVista, FranjaCifras } from "@/components/marca"

// Spec 2026-10-16-enlace-edge-design.md §6.3: eventos reales de los nodos, con los nuevos en vivo.

const SEVERIDAD_BADGE: Record<Severidad, string> = {
  alta: "bg-red-500/15 text-red-300 border border-red-500/30",
  media: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  baja: "bg-foreground/10 text-foreground/50 border border-foreground/10",
}

const FILTROS = [
  { label: "Todos", severidad: null },
  { label: "Críticos", severidad: "alta" },
  { label: "Advertencias", severidad: "media" },
] as const

const LIMITE = 200
const DIA_MS = 86_400_000

function exportarCsv(eventos: EventoVivo[]) {
  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`
  const filas = [
    ["fecha", "tipo", "nodo", "severidad", "detalle", "id"],
    ...eventos.map((e) => [e.ocurridoEn, e.tipo, e.dispositivoNombre, e.severidad, e.detalle ?? "", e.id]),
  ]
  const blob = new Blob([filas.map((f) => f.map(celda).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface BitacoraClientProps {
  permisos: Permiso[]
}

export function BitacoraClient({ permisos }: BitacoraClientProps) {
  const { eventos: enVivo } = useEdgeStream()
  const [historial, setHistorial] = useState<EventoVivo[]>([])
  const [total, setTotal] = useState(0)
  const [cargadoEn, setCargadoEn] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["label"]>("Todos")

  useEffect(() => {
    fetch(`/api/edge/eventos?limite=${LIMITE}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        setHistorial(data.eventos)
        setTotal(data.total)
        setCargadoEn(Date.now())
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [])

  // Los que llegan por el stream van arriba; se quitan duplicados con el historial ya cargado.
  const todos = useMemo(() => {
    const vistos = new Set(enVivo.map((e) => e.id))
    return [...enVivo, ...historial.filter((e) => !vistos.has(e.id))]
  }, [enVivo, historial])
  const nuevosEnVivo = todos.length - historial.length
  const altas24h = todos.filter((e) => e.severidad === "alta" && Date.parse(e.ocurridoEn) > cargadoEn - DIA_MS).length

  const eventos = useMemo(() => {
    const severidad = FILTROS.find((f) => f.label === filtro)?.severidad ?? null
    let lista = severidad ? todos.filter((e) => e.severidad === severidad) : todos
    const q = busqueda.trim().toLowerCase()
    if (q) {
      lista = lista.filter(
        (e) => e.dispositivoNombre.toLowerCase().includes(q) || e.tipo.toLowerCase().includes(q) || (e.detalle ?? "").toLowerCase().includes(q),
      )
    }
    return lista
  }, [todos, filtro, busqueda])

  const mensajeVacio = cargando
    ? "Cargando eventos…"
    : error
      ? "No se pudo cargar la bitácora. Intenta recargar la página."
      : todos.length === 0
        ? "Todavía no hay eventos. Aparecerán aquí en cuanto un nodo reporte algo."
        : "Ningún evento coincide con el filtro."

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="bitacora" permisos={permisos} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
          <EncabezadoVista
            titulo="Bitácora de incidentes"
            bajada="Registro cronológico de lo que reportan tus nodos: conexiones, alarmas y fallas de hardware."
          />

          <FranjaCifras
            className="mb-8"
            items={[
              { valor: (total + nuevosEnVivo).toLocaleString("es-MX"), etiqueta: "Eventos registrados" },
              { valor: altas24h, etiqueta: "Alertas altas en 24 h", tono: altas24h > 0 ? "alerta" : "normal" },
            ]}
          />

          <GlassPanel padding="md" radius="lg">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex-1 min-w-[260px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Filtrar por nodo, tipo o detalle..."
                  aria-label="Filtrar eventos"
                  className="w-full pl-9 pr-4 py-2 rounded-md text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"
                />
              </div>

              <div className="flex gap-2">
                {FILTROS.map(({ label }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setFiltro(label)}
                    aria-pressed={filtro === label}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      filtro === label ? "border-signal/50 bg-signal/10 text-signal" : "border-foreground/10 text-foreground/55 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => exportarCsv(eventos)}
                disabled={eventos.length === 0}
                className="rounded-md border border-foreground/20 px-4 py-1.5 text-xs text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
              >
                Exportar CSV
              </button>
            </div>

            {/* En pantallas chicas la tabla de 6 columnas no cabe: cada evento es una tarjeta. */}
            <ul className="md:hidden divide-y divide-foreground/5">
              {eventos.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs uppercase ${e.severidad === "alta" ? "text-red-300 font-semibold" : "text-foreground/60"}`}>{e.tipo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${SEVERIDAD_BADGE[e.severidad]}`}>{e.severidad}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{e.detalle ?? "—"}</p>
                  {e.evidencia && <EvidenciaFoto eventoId={e.id} compacta />}
                  <p className="mt-1 font-mono text-[11px] text-foreground/45">
                    {e.dispositivoNombre} · {new Date(e.ocurridoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
              {eventos.length === 0 && <li className="py-10 text-center text-sm text-foreground/50">{mensajeVacio}</li>}
            </ul>

            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-foreground/10">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">Fecha</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">Tipo de Evento</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">Nodo de Origen</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">Detalle</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wide">Severidad</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-foreground/50 uppercase tracking-wide">Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map((e) => (
                    <tr key={e.id} className="hover:bg-foreground/[0.03] border-b border-foreground/5">
                      <td className="px-4 py-3 text-sm text-foreground/50 whitespace-nowrap">{new Date(e.ocurridoEn).toLocaleString("es-MX")}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs uppercase ${e.severidad === "alta" ? "text-red-300 font-semibold" : "text-foreground/60"}`}>{e.tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground/50 whitespace-nowrap font-mono">{e.dispositivoNombre}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-md">
                        {e.detalle ?? "—"}
                        {e.evidencia && <span className="ml-2"><EvidenciaFoto eventoId={e.id} compacta /></span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${SEVERIDAD_BADGE[e.severidad]}`}>{e.severidad}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-foreground/40 whitespace-nowrap font-mono">#{e.id.slice(0, 8)}</td>
                    </tr>
                  ))}
                  {eventos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-foreground/50">
                        {mensajeVacio}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 mt-6 pt-4 border-t border-foreground/5 text-xs text-foreground/40">
              <span>
                Mostrando {eventos.length} de {(total + nuevosEnVivo).toLocaleString("es-MX")} registros
                {total > LIMITE && ` (los ${LIMITE} más recientes)`}
              </span>
              <span>Los eventos nuevos aparecen sin recargar</span>
            </div>
          </GlassPanel>
        </div>
      </div>
    </main>
  )
}

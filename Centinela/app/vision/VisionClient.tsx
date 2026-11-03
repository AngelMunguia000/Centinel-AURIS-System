"use client"

import { useCallback, useEffect, useState } from "react"
import { AppHeader } from "@/components/app-header"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { SeguridadSidebar } from "@/components/SeguridadSidebar"
import { EncabezadoVista, FranjaCifras } from "@/components/marca"
import type { Permiso } from "@/lib/permisos"
import type { Revision, metricasVision } from "@/lib/edge/revision"

// Revisión de la detección por cámara (lib/edge/revision.ts): en cada foto se marca si había un ave.
// Los `movimiento` también se revisan: ahí están las aves que el modelo no vio.

type Foto = { id: string; tipo: string; detalle: string | null; dispositivoNombre: string; ocurridoEn: string; revision: Revision | null }
type Datos = { metricas: ReturnType<typeof metricasVision>; pendientes: number; fotos: Foto[] }

const FILTROS = [
  { label: "Sin revisar", ver: (f: Foto) => f.revision === null },
  { label: "Revisadas", ver: (f: Foto) => f.revision !== null },
  { label: "Todas", ver: () => true },
] as const

const pct = (v: number | null) => (v === null ? "—" : `${v} %`)

export function VisionClient({ permisos }: { permisos: Permiso[] }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["label"]>("Sin revisar")
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    fetch("/api/vision/revision", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((d: Datos) => {
        setDatos(d)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(cargar, [cargar])

  async function marcar(id: string, revision: Revision | null) {
    setGuardando(id)
    try {
      const res = await fetch(`/api/vision/revision/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision }),
      })
      if (!res.ok) throw new Error()
      cargar() // las métricas cambian con cada marca
    } catch {
      setError(true)
    } finally {
      setGuardando(null)
    }
  }

  const m = datos?.metricas
  const fotos = datos ? datos.fotos.filter(FILTROS.find((f) => f.label === filtro)!.ver) : []

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="vision" permisos={permisos} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
          <EncabezadoVista
            titulo="Revisión de visión"
            bajada="Marca en cada foto si había un ave. Con eso se mide qué tan bien detecta el modelo de la Raspberry Pi: lo que acierta, lo que confunde y las aves que se le escapan."
          />

          <FranjaCifras
            className="mb-8"
            items={[
              { valor: pct(m?.precision ?? null), etiqueta: "Precisión: de lo que llamó ave, cuánto lo era", tono: "senal" },
              { valor: pct(m?.sensibilidad ?? null), etiqueta: "Sensibilidad: de las aves que hubo, cuántas vio", tono: "senal" },
              { valor: m?.escapadas ?? "—", etiqueta: "Aves que no detectó", tono: m?.escapadas ? "alerta" : "normal" },
              { valor: datos?.pendientes ?? "—", etiqueta: "Fotos sin revisar" },
            ]}
          />

          <GlassPanel padding="md" radius="lg">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
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
              {m && (
                <p className="font-mono text-xs text-foreground/45">
                  {m.revisadas} revisadas · {m.aciertos} aciertos · {m.falsas} falsas alarmas · {m.descartes} descartes correctos
                </p>
              )}
            </div>

            {error && <p className="mb-4 text-sm text-red-300">No se pudo cargar o guardar. Intenta recargar la página.</p>}

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fotos.map((f) => (
                <li key={f.id} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
                  <a href={`/api/evidencia/${f.id}`} target="_blank" rel="noopener noreferrer" title="Abrir la foto en grande">
                    {/* eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por la API, next/image no aplica */}
                    <img src={`/api/evidencia/${f.id}`} alt={`Foto del nodo ${f.dispositivoNombre}: ${f.detalle ?? f.tipo}`} loading="lazy" className="aspect-[5/4] w-full object-cover bg-foreground/5" />
                  </a>
                  <div className="p-3">
                    <p className={`text-xs uppercase ${f.tipo === "deteccion" ? "text-signal font-semibold" : "text-foreground/55"}`}>
                      {f.tipo === "deteccion" ? "El modelo vio un ave" : "Solo movimiento"}
                    </p>
                    <p className="mt-1 text-sm text-foreground/80 line-clamp-2">{f.detalle ?? "—"}</p>
                    <p className="mt-1 font-mono text-[11px] text-foreground/45">
                      {f.dispositivoNombre} · {new Date(f.ocurridoEn).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    <div className="mt-3 flex gap-2" role="group" aria-label="¿Había un ave en la foto?">
                      {([
                        ["objetivo", "Había ave"],
                        ["nada", "No había"],
                      ] as const).map(([valor, texto]) => (
                        <button
                          key={valor}
                          type="button"
                          disabled={guardando === f.id}
                          aria-pressed={f.revision === valor}
                          onClick={() => marcar(f.id, f.revision === valor ? null : valor)}
                          className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            f.revision === valor
                              ? valor === "objetivo"
                                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                                : "border-foreground/40 bg-foreground/10 text-foreground"
                              : "border-foreground/15 text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                          }`}
                        >
                          {texto}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {datos && fotos.length === 0 && (
              <p className="py-10 text-center text-sm text-foreground/50">
                {filtro === "Sin revisar" ? "No hay fotos pendientes. Las nuevas aparecen al recargar." : "No hay fotos en esta vista."}
              </p>
            )}
            {!datos && !error && <p className="py-10 text-center text-sm text-foreground/50">Cargando fotos…</p>}
          </GlassPanel>
        </div>
      </div>
    </main>
  )
}

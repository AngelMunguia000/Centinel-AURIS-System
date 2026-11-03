import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Check, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { Footer } from "@/components/footer"
import { Aparece } from "@/components/landing/aparece"
import { PAGINAS_LANDING } from "@/lib/landings"
import { Etiqueta } from "@/components/marca"

export { Etiqueta }

// Bloques compartidos por las landings complementarias (/soluciones, /plataforma, /tecnologia,
// /seguridad). Identidad: negro, carmesí para marca y acción principal, ámbar señal para lo vivo y los datos.

const blobs: GlassBlob[] = [
  { color: "#3a2614", size: "55% 40%", position: "95% 0%" },
  { color: "#4a1a22", shape: "circle", size: "10vw", position: "4% 88%" },
]

export function PaginaLanding({ actual, children }: { actual: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={blobs} />
      <LandingNavigation />
      {children}
      <ExplorarMas actual={actual} />
      <Footer />
    </main>
  )
}

export function Hero({
  etiqueta,
  titulo,
  acento,
  bajada,
  visual,
  secundaria,
}: {
  etiqueta: string
  titulo: string
  /** Remate del titular, en carmesí. */
  acento: string
  bajada: string
  visual: React.ReactNode
  secundaria?: { texto: string; href: string }
}) {
  return (
    <section className="pt-36 pb-20 md:pt-44 md:pb-28">
      <div className="container mx-auto px-4 lg:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
        <Aparece className="space-y-6">
          <Etiqueta>{etiqueta}</Etiqueta>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.01em] leading-[1.05] text-balance text-white">
            {titulo} <span className="text-brand">{acento}</span>
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl text-pretty">{bajada}</p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button asChild size="lg" className="text-base px-7">
              <Link href="/cuestionario">Solicitar una demostración</Link>
            </Button>
            {secundaria && (
              <Button asChild size="lg" variant="outline" className="text-base px-7 border-white/20 bg-transparent text-white hover:bg-white/10">
                <Link href={secundaria.href}>{secundaria.texto}</Link>
              </Button>
            )}
          </div>
        </Aparece>
        <Aparece retraso={0.15}>{visual}</Aparece>
      </div>
    </section>
  )
}

export type LineaConsola = { hora: string; texto: string; nivel?: "info" | "ok" | "alta" }

const NIVEL: Record<NonNullable<LineaConsola["nivel"]>, { clase: string; texto: string }> = {
  info: { clase: "text-white/45", texto: "info" },
  ok: { clase: "text-signal", texto: "ok" },
  alta: { clase: "text-brand font-semibold", texto: "alta" },
}

/** Panel tipo consola de operación: el "visual" de las landings, dibujado en código ($0, sin imágenes). */
export function Consola({ titulo, lineas, pie }: { titulo: string; lineas: LineaConsola[]; pie?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-card/80 shadow-[0_30px_70px_rgba(0,0,0,0.55)] backdrop-blur">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "linear-gradient(var(--signal) 1px, transparent 1px), linear-gradient(90deg, var(--signal) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
      />
      <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.08em]">
        <span className="text-white/70">{titulo}</span>
        <span className="flex items-center gap-2 text-signal">
          <span className="h-1.5 w-1.5 rounded-full bg-signal motion-safe:animate-pulse" aria-hidden="true" />
          en vivo
        </span>
      </div>
      <ul className="relative divide-y divide-white/[0.06] font-mono text-[12.5px]">
        {lineas.map((l, i) => {
          const nivel = NIVEL[l.nivel ?? "info"]
          return (
            <li key={i} className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3 px-5 py-2.5">
              <span className="text-white/40">{l.hora}</span>
              <span className="text-white/85">{l.texto}</span>
              <span className={`text-[10.5px] uppercase ${nivel.clase}`}>{nivel.texto}</span>
            </li>
          )
        })}
      </ul>
      {pie && <p className="relative border-t border-white/10 px-5 py-3 text-xs text-white/45">{pie}</p>}
    </div>
  )
}

export function Cifras({ items }: { items: { valor: string; etiqueta: string }[] }) {
  return (
    <section className="pb-8">
      <div className="container mx-auto px-4 lg:px-8">
        <Aparece className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {items.map((c) => (
            <div key={c.etiqueta} className="bg-background/95 p-6">
              <div className="font-mono text-3xl font-medium tracking-tight text-white">{c.valor}</div>
              <div className="mt-2 text-sm text-white/55 leading-snug">{c.etiqueta}</div>
            </div>
          ))}
        </Aparece>
      </div>
    </section>
  )
}

export function Seccion({
  id,
  marca,
  titulo,
  intro,
  children,
}: {
  id?: string
  /** Rótulo corto en ámbar, p. ej. "01 — El problema". */
  marca: string
  titulo: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="py-20 md:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <Aparece className="max-w-2xl mb-12 space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-signal">{marca}</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">{titulo}</h2>
          {intro && <p className="text-lg text-white/60 leading-relaxed text-pretty">{intro}</p>}
        </Aparece>
        {children}
      </div>
    </section>
  )
}

export type Punto = { icono: LucideIcon; titulo: string; texto: string }

export function Rejilla({ puntos, columnas = 3 }: { puntos: Punto[]; columnas?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${columnas === 3 ? "lg:grid-cols-3" : ""}`}>
      {puntos.map(({ icono: Icono, titulo, texto }, i) => (
        <Aparece key={titulo} retraso={i * 0.05} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-signal/30 hover:bg-white/[0.05]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
            <Icono className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <h3 className="mt-5 text-lg font-semibold text-white">{titulo}</h3>
          <p className="mt-2 text-white/55 leading-relaxed">{texto}</p>
        </Aparece>
      ))}
    </div>
  )
}

export function Pasos({ pasos }: { pasos: { titulo: string; texto: string }[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {pasos.map((p, i) => (
        <Aparece key={p.titulo} retraso={i * 0.06}>
          <li className="h-full list-none rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <span className="font-mono text-sm text-signal">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-lg font-semibold text-white">{p.titulo}</h3>
            <p className="mt-2 text-white/55 leading-relaxed">{p.texto}</p>
          </li>
        </Aparece>
      ))}
    </ol>
  )
}

/** Qué funciona hoy y qué está en camino: las landings no prometen lo que todavía no existe. */
export function Estado({ hoy, viene }: { hoy: string[]; viene: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Aparece className="rounded-2xl border border-signal/25 bg-signal/[0.04] p-6">
        <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Funciona hoy</h3>
        <ul className="mt-4 space-y-3">
          {hoy.map((t) => (
            <li key={t} className="flex gap-3 text-white/80 leading-relaxed">
              <Check className="mt-1 h-4 w-4 shrink-0 text-signal" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </Aparece>
      <Aparece retraso={0.08} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="font-mono text-xs uppercase tracking-[0.1em] text-white/60">En camino</h3>
        <ul className="mt-4 space-y-3">
          {viene.map((t) => (
            <li key={t} className="flex gap-3 text-white/60 leading-relaxed">
              <Clock className="mt-1 h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </Aparece>
    </div>
  )
}

export function CtaFinal({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <Aparece className="relative overflow-hidden rounded-3xl border border-white/10 bg-card px-6 py-14 md:px-14 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(60% 80% at 50% 120%, oklch(0.52 0.2 20 / 0.35), transparent 70%)" }}
          />
          <h2 className="relative text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">{titulo}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/60 text-pretty">{texto}</p>
          <div className="relative mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg" className="text-base px-7">
              <Link href="/cuestionario">Solicitar una demostración</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base px-7 border-white/20 bg-transparent text-white hover:bg-white/10">
              <Link href="/contacto">Hablar con el equipo</Link>
            </Button>
          </div>
        </Aparece>
      </div>
    </section>
  )
}

function ExplorarMas({ actual }: { actual: string }) {
  const otras = PAGINAS_LANDING.filter((p) => p.href !== actual)
  return (
    <section className="pb-24">
      <div className="container mx-auto px-4 lg:px-8">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.1em] text-white/50">Sigue explorando</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {otras.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-signal/35 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <span className="block font-semibold text-white">{p.titulo}</span>
                <span className="mt-1 block text-sm text-white/55">{p.resumen}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-signal transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

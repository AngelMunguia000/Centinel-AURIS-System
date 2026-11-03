// Piezas del lenguaje visual de las landings (negro + carmesí + ámbar señal) compartidas con la app
// interna, para que la consola y la web pública se vean como un solo producto. Sin hooks a propósito:
// sirven igual en componentes de servidor y de cliente.

/** Chip mono en ámbar con punto: el rótulo de cada vista y de cada hero. */
export function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-signal/35 bg-signal/[0.07] px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-signal">
      <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
      {children}
    </span>
  )
}

/** Encabezado compacto de una vista interna: titular con remate en carmesí, bajada y acciones.
 *  Sin la etiqueta ni el titular grande del landing (auditoría de la consola, 2026-10-24): el espacio es para los datos. */
export function EncabezadoVista({
  titulo,
  bajada,
  acciones,
}: {
  titulo: React.ReactNode
  bajada?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold tracking-[-0.01em] leading-tight text-balance text-foreground">
          {titulo}
          <span className="text-brand">.</span>
        </h1>
        {bajada && <p className="mt-1 text-sm text-foreground/60 leading-relaxed text-pretty">{bajada}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export type Cifra = { valor: React.ReactNode; etiqueta: string; tono?: "normal" | "senal" | "alerta" | "ok" }

const TONO_CIFRA: Record<NonNullable<Cifra["tono"]>, string> = {
  normal: "text-foreground",
  senal: "text-signal",
  alerta: "text-brand",
  ok: "text-green-400",
}

/** Franja de cifras en mono separadas por filetes, igual que en las landings. */
export function FranjaCifras({ items, className = "" }: { items: Cifra[]; className?: string }) {
  // 3 cifras van en 3 columnas también en móvil: en 2 dejarían una celda vacía.
  const cols = items.length >= 4 ? "grid-cols-2 md:grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-2"
  return (
    <div className={`grid ${cols} gap-px overflow-hidden rounded-2xl border border-foreground/10 bg-foreground/10 ${className}`}>
      {items.map((c) => (
        <div key={c.etiqueta} className="bg-background/95 p-4 md:p-5">
          <div className={`font-mono text-2xl md:text-3xl font-medium tracking-tight ${TONO_CIFRA[c.tono ?? "normal"]}`}>{c.valor}</div>
          <div className="mt-2 text-xs md:text-sm text-foreground/55 leading-snug">{c.etiqueta}</div>
        </div>
      ))}
    </div>
  )
}

/** Fondo de rejilla ámbar de las consolas de la landing, para paneles "en vivo". */
export function RejillaSenal() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage: "linear-gradient(var(--signal) 1px, transparent 1px), linear-gradient(90deg, var(--signal) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    />
  )
}

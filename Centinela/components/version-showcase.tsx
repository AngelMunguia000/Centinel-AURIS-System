"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight, Bird, Home, Ship, type LucideIcon } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import { cn } from "@/lib/utils"

type VersionKey = "empresa" | "hogar" | "barco"

interface Version {
  key: VersionKey
  tag: string
  label: string
  icon: LucideIcon
  gradient: string
  description: string
  detail: string
}

const versions: Record<VersionKey, Version> = {
  empresa: {
    key: "empresa",
    tag: "Empresa · Agrícola",
    label: "Disuasión de palomas",
    icon: Bird,
    gradient: "linear-gradient(135deg, #9e1b34 0%, #4a1520 100%)",
    description:
      "Monitoreo y disuasión en tiempo real para instalaciones agrícolas o industriales, con posibilidad de múltiples unidades coordinadas.",
    detail:
      "Modelo de ejemplo: detecta bandadas de palomas sobre el cultivo y activa el pulso direccional de audio solo cuando confirma presencia real — sin habituación.",
  },
  hogar: {
    key: "hogar",
    tag: "Hogar",
    label: "Protección residencial",
    icon: Home,
    gradient: "linear-gradient(135deg, #1f2836 0%, #a8781e 100%)",
    description:
      "Protección perimetral inteligente para viviendas y espacios residenciales, con conectividad WiFi y notificaciones al usuario.",
    detail: "Ideal para patios, azoteas y jardines — recibe una alerta en tu teléfono cada vez que el sistema actúa.",
  },
  barco: {
    key: "barco",
    tag: "Barco · Alta seguridad",
    label: "Operación offline",
    icon: Ship,
    gradient: "linear-gradient(135deg, #2a3444 0%, #0a0a0c 100%)",
    description:
      "Sistema completamente offline, sin acceso a internet, pensado para embarcaciones de carga y entornos donde no se permite la salida de datos.",
    detail: "Todo el procesamiento ocurre a bordo, en la Raspberry Pi 5 — cero transmisión de datos hacia el exterior.",
  },
}

const order: VersionKey[] = ["empresa", "hogar", "barco"]

/**
 * Tarjeta principal grande con el modelo de ejemplo activo, rodeada de
 * tarjetas más pequeñas que se voltean para revelar su descripción. Al
 * seleccionar una de las tarjetas pequeñas, esta pasa a ocupar el lugar de
 * la tarjeta grande — así "las tarjetas grandes" terminan mostrando
 * versiones distintas del mismo modelo, igual al patrón del video de
 * referencia.
 */
export function VersionShowcase() {
  const [active, setActive] = useState<VersionKey>("empresa")
  const current = versions[active]
  const others = order.filter((key) => key !== active)

  return (
    <div className="grid lg:grid-cols-[1.1fr_auto] gap-8 lg:gap-12 items-center">
      {/* Tarjeta principal */}
      <div className="order-2 lg:order-1 mx-auto w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassPanel padding="sm" radius="lg" className="overflow-hidden">
              <div
                className="relative h-56 sm:h-64 rounded-2xl flex items-center justify-center mb-5 overflow-hidden"
                style={{ background: current.gradient }}
              >
                <current.icon className="w-20 h-20 text-white/90" strokeWidth={1.25} />
                <span className="absolute top-4 left-4 text-xs font-medium uppercase tracking-wide text-white/80 bg-black/25 backdrop-blur-sm px-3 py-1 rounded-full">
                  {current.tag}
                </span>
                <span className="absolute bottom-4 right-4 text-[11px] font-medium text-white/70 bg-black/25 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  Modelo de ejemplo
                </span>
              </div>
              <div className="px-2 pb-2 space-y-2">
                <h3 className="text-xl md:text-2xl font-semibold tracking-[-0.005em] text-white">{current.label}</h3>
                <p className="text-white/60 leading-relaxed">{current.description}</p>
                <p className="text-sm text-white/40 leading-relaxed border-t border-white/10 mt-3 pt-3">
                  {current.detail}
                </p>
              </div>
            </GlassPanel>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tarjetas volteables */}
      <div className="order-1 lg:order-2 flex lg:flex-col gap-5 justify-center">
        {others.map((key) => (
          <FlipCard key={key} data={versions[key]} onSelect={() => setActive(key)} />
        ))}
      </div>
    </div>
  )
}

function FlipCard({ data, onSelect }: { data: Version; onSelect: () => void }) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div
      className="w-36 h-44 sm:w-40 sm:h-48 [perspective:1200px]"
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <motion.div
        role="button"
        tabIndex={0}
        aria-label={`Ver descripción de ${data.label}`}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setFlipped((f) => !f)
          }
        }}
        className="relative w-full h-full cursor-pointer outline-none [transform-style:preserve-3d]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Frente: imagen/ícono */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-2 p-3 text-center",
            "shadow-[0_20px_40px_rgba(0,0,0,0.4)] [backface-visibility:hidden]",
          )}
          style={{ background: data.gradient }}
        >
          <data.icon className="w-9 h-9 text-white/90" strokeWidth={1.25} />
          <span className="text-xs font-medium text-white/85">{data.tag}</span>
        </div>

        {/* Reverso: descripción */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl p-4 flex flex-col justify-between text-left",
            "bg-white/[0.08] backdrop-blur-[20px] border border-white/10",
            "[backface-visibility:hidden] [transform:rotateY(180deg)]",
          )}
        >
          <p className="text-xs text-white/70 leading-relaxed">{data.description}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSelect()
            }}
            className="text-xs font-medium text-white inline-flex items-center gap-1 hover:text-accent-foreground transition-colors"
          >
            Ver como modelo principal
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

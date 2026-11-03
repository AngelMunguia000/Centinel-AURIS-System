"use client"

import { useRef, useState } from "react"
import { motion, useMotionValueEvent, useScroll } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { cn } from "@/lib/utils"
import Logo from "./Logo"

interface Step {
  number: string
  title: string
  description: string
  /** Color de acento usado para el brillo del logo y el número de la carta en este paso */
  glow: string
}

const steps: Step[] = [
  {
    number: "01",
    title: "Detección",
    description:
      "La cámara con visión nocturna IR captura video en tiempo real. La Raspberry Pi 5 ejecuta el modelo de inteligencia artificial que identifica la presencia de aves frente a otros objetos o fauna no objetivo.",
    glow: "var(--accent-foreground)",
  },
  {
    number: "02",
    title: "Localización",
    description:
      "El brazo pan/tilt (-90°/+90° horizontal, +45°/-45° vertical) orienta cámara y bocina exactamente hacia el punto donde se confirmó la presencia, mientras el ESP32 coordina los servomotores.",
    glow: "var(--accent-foreground)",
  },
  {
    number: "03",
    title: "Disuasión",
    description:
      "Se emite un pulso direccional de audio de baja frecuencia de 3 a 5 segundos — suficiente para ahuyentar sin someter al entorno a ruido continuo.",
    glow: "#c8243f",
  },
]

/**
 * Sección de scrollytelling: el logo y una carta quedan fijos (sticky) mientras
 * el usuario baja; en cada paso la carta se voltea y muestra el siguiente
 * (y se voltea de regreso al subir). Brain/21 §57, §62 y §63.
 */
export function LogoScrollStory() {
  const trackRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  // La carta tiene dos caras; antes de cada giro se escribe el paso nuevo en la cara oculta.
  const [card, setCard] = useState({ active: 0, rot: 0, front: 0, back: 1 })

  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] })

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = Math.min(steps.length - 1, Math.floor(p * steps.length))
    setCard((c) => {
      if (next === c.active) return c
      const rot = c.rot + (next > c.active ? 180 : -180)
      const showsBack = Math.abs(rot / 180) % 2 === 1
      return { active: next, rot, front: showsBack ? c.front : next, back: showsBack ? next : c.back }
    })
  })

  const current = steps[card.active]

  const goToStep = (index: number) => {
    const el = trackRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + span * ((index + 0.5) / steps.length), behavior: "smooth" })
  }

  return (
    <div ref={trackRef} style={{ height: `${steps.length * 80}vh` }}>
      <div className="sticky top-24 grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-16 items-center min-h-[calc(100vh-8rem)]">
        {/* Logo + indicador de progreso */}
        <div className="flex flex-col items-center justify-center gap-6 lg:gap-8">
          <motion.div
            animate={{ filter: `drop-shadow(0 0 ${reduced ? 18 : 36}px ${current.glow}55)` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Logo size={160} isAnimated={!reduced} />
          </motion.div>
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <button
                key={step.number}
                type="button"
                onClick={() => goToStep(i)}
                aria-label={`Ir al paso ${step.title}`}
                aria-current={card.active === i ? "step" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  card.active === i ? "w-8 bg-white" : "w-1.5 bg-white/20 hover:bg-white/40",
                )}
              />
            ))}
          </div>
        </div>

        {/* Carta que se voltea */}
        <div className="[perspective:1600px] w-full max-w-xl mx-auto lg:mx-0">
          <motion.div
            className="relative grid [transform-style:preserve-3d]"
            animate={{ rotateY: card.rot }}
            transition={reduced ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <CardFace step={steps[card.front]} hidden={card.front !== card.active} />
            <CardFace step={steps[card.back]} hidden={card.back !== card.active} back />
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function CardFace({ step, back = false, hidden }: { step: Step; back?: boolean; hidden: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        "[grid-area:1/1] [backface-visibility:hidden] rounded-2xl border border-white/10 bg-card p-8 md:p-10 shadow-2xl space-y-4",
        back && "[transform:rotateY(180deg)]",
      )}
    >
      <div className="text-4xl font-semibold tracking-[-0.005em]" style={{ color: step.glow }}>
        {step.number}
      </div>
      <h3 className="text-2xl md:text-3xl font-semibold text-white">{step.title}</h3>
      <p className="text-white/60 leading-relaxed text-lg">{step.description}</p>
    </div>
  )
}

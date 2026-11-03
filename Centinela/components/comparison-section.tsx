"use client"

import { motion } from "motion/react"
import { Check, X } from "lucide-react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { GlassPanel } from "@/components/glass-panel"

const before = [
  "Espantapájaros, redes y pirotecnia pierden efecto por habituación",
  "Cobertura limitada, insuficiente en grandes extensiones agrícolas o portuarias",
  "Repelentes químicos elevan costos y generan impacto ambiental",
  "Las deyecciones degradan el grano y corroen las estructuras navales",
]

const after = [
  "Activación orientada por eventos: pulsos de 3 a 5 segundos, no ruido continuo",
  "Focalización angular: el sonido se concentra solo en el punto detectado",
  "Filtrado por especie: ignora especies protegidas o fauna no objetivo",
  "Todo el análisis ocurre en el propio dispositivo, sin depender de internet",
]

export function ComparisonSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
        >
          <GlassPanel padding="lg" radius="lg">
            <h3 className="text-lg font-semibold text-white/70 mb-6">Sin Centinela</h3>
            <ul className="space-y-4">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#ff7a7a" }} strokeWidth={1.5} />
                  <span className="text-white/50 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <GlassPanel padding="lg" radius="lg">
            <h3 className="text-lg font-semibold text-white mb-6">Con Centinela</h3>
            <ul className="space-y-4">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                  <span className="text-white/70 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  )
}

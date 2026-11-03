"use client"

import { GlassPanel } from "@/components/glass-panel"
import { motion } from "motion/react"
import { fadeInUp, staggerContainer, viewportOnce } from "@/lib/motion-variants"

const symptoms = [
  {
    title: "Habituación",
    description:
      "Espantapájaros, redes y pirotecnia pierden efecto porque las aves se acostumbran rápido a estímulos fijos y repetitivos.",
  },
  {
    title: "Cobertura",
    description:
      "Los métodos convencionales cubren áreas limitadas y son insuficientes en grandes extensiones agrícolas o portuarias.",
  },
  {
    title: "Costo e impacto",
    description:
      "El mantenimiento constante y el uso de repelentes químicos elevan costos y generan impacto ambiental adicional.",
  },
]

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32" id="problema">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
            Las aves no solo molestan
          </h2>
          <p className="text-lg text-white/60 text-balance">
            En el sector agrícola, las aves consumen y dañan cultivos en etapas críticas de siembra y maduración,
            comprometiendo el rendimiento de la cosecha. En la industria marítimo-portuaria, la contaminación por
            deyecciones degrada la calidad del grano transportado, obstruye sistemas mecánicos y acelera la
            corrosión de las estructuras navales.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="grid md:grid-cols-3 gap-6"
        >
          {symptoms.map((symptom) => (
            <motion.div key={symptom.title} variants={fadeInUp}>
              <GlassPanel padding="md" radius="md" className="h-full">
                <h3 className="text-lg font-semibold text-white mb-2">{symptom.title}</h3>
                <p className="text-white/50 leading-relaxed">{symptom.description}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

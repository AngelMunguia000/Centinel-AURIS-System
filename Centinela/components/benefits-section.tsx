"use client"

import { GlassPanel } from "@/components/glass-panel"
import { motion } from "motion/react"
import { fadeInUp, staggerContainer, viewportOnce } from "@/lib/motion-variants"

const benefits = [
  {
    title: "Activación orientada por eventos",
    description:
      "El audio permanece en espera y solo se activa en pulsos breves de 3 a 5 segundos tras la confirmación algorítmica de presencia — no funciona de forma continua.",
  },
  {
    title: "Focalización angular del sonido",
    description:
      "Transductores direccionales concentran la presión sonora exclusivamente hacia el punto donde se localizó la plaga, reduciendo la dispersión a zonas periféricas.",
  },
  {
    title: "Filtrado por especie",
    description:
      "El modelo de aprendizaje profundo puede configurarse para ignorar especies protegidas o aves no objetivo, evitando emisiones involuntarias.",
  },
  {
    title: "Energía solar",
    description:
      "Los módulos de campo pueden alimentarse mediante energía fotovoltaica con gestión inteligente de consumo.",
  },
]

export function BenefitsSection() {
  return (
    <section id="beneficios" className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
            Disuasión sin daño colateral
          </h2>
          <p className="text-lg text-white/60 text-balance">
            Centinela es una alternativa limpia frente a pesticidas, repelentes químicos y pirotecnia — pero su
            propio diseño también limita el impacto de la emisión acústica.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="grid md:grid-cols-3 gap-6"
        >
          {benefits.map((benefit) => (
            <motion.div key={benefit.title} variants={fadeInUp}>
              <GlassPanel padding="md" radius="md" className="h-full">
                <h3 className="text-lg font-semibold text-white mb-2">{benefit.title}</h3>
                <p className="text-white/50 leading-relaxed">{benefit.description}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

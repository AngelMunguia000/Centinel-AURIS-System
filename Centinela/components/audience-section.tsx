"use client"

import { motion } from "motion/react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { VersionShowcase } from "@/components/version-showcase"

export function AudienceSection() {
  return (
    <section id="aplicaciones" className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
            Un mismo núcleo, tres perfiles de despliegue
          </h2>
          <p className="text-lg text-white/60 text-balance">
            La configuración se adapta al entorno sin cambiar la lógica central de detección y disuasión. Elige una
            tarjeta para verla como modelo principal.
          </p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeInUp}>
          <VersionShowcase />
        </motion.div>
      </div>
    </section>
  )
}

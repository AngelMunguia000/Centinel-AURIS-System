"use client"

import { motion } from "motion/react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { NodeGraphIllustration } from "@/components/illustrations/node-graph-illustration"
export function HorizonSection() {
  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-3xl mx-auto flex flex-col md:flex-row items-center gap-8 text-center md:text-left"
        >
          <NodeGraphIllustration className="w-20 h-auto shrink-0 text-white/30" />
          <div className="space-y-2">
            <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.005em] text-white">Hacia dónde vamos</h2>
            <p className="text-white/50 leading-relaxed">
              Centinela nació como la exploración de un sistema de seguridad con visión artificial y detección
              autónoma. Ese horizonte sigue vivo: este mismo núcleo de gestión y trazabilidad puede crecer hacia
              ahí, sin comprometer lo que ya funciona hoy.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

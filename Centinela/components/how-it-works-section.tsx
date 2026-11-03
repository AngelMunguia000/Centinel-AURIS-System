"use client"

import dynamic from "next/dynamic"
import { motion } from "motion/react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { ProductShowcase } from "@/components/product-showcase"
import { LogoScrollStory } from "@/components/logo-scroll-story"

// Importación dinámica de Three.js para ejecutarlo únicamente en el cliente
const BirdTrackingScene = dynamic(
  () => import("./BirdTrackingScene"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0a0a0a] animate-pulse flex items-center justify-center text-xs font-mono text-signal/60">
        Iniciando motor de visión 3D...
      </div>
    ),
  }
)

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">

        {/* Contenedor del Visor 3D de Rastreo */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="w-full h-[380px] md:h-[480px] rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden mb-16 shadow-2xl relative"
        >
          <BirdTrackingScene />
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
            Un ciclo de tres pasos, no una alarma fija
          </h2>
          <p className="text-lg text-white/60 text-balance">
            El sistema permanece en espera y solo actúa cuando confirma la presencia real de la plaga — así se
            evita la habituación que anula a los métodos tradicionales.
          </p>
        </motion.div>

        {/* Pasos 01, 02, 03 — scrollytelling: logo fijo y una carta que se voltea en cada paso */}
        <div className="mb-24 md:mb-32">
          <LogoScrollStory />
        </div>

        <ProductShowcase />
      </div>
    </section>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { motion } from "motion/react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { Sparkles } from "lucide-react"
import Link from "next/link"
import { GlassPanel } from "@/components/glass-panel"

export function FinalCtaSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mx-auto"
        >
          <GlassPanel padding="lg" radius="lg" className="text-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
              ¿Listo para ver a Centinela en acción?
            </h2>
            <p className="text-lg text-white/60 text-balance mt-4">
              Cuéntanos sobre tu campo, planta o embarcación y coordinamos una demostración del prototipo.
            </p>
            <div className="pt-6">
              <Link href="/cuestionario">
                <Button
                  size="lg"
                  className="text-base px-8 bg-white text-[#0a0a0c] hover:bg-white transition-shadow duration-300 shadow-[0_8px_20px_rgba(255,255,255,0.15)] hover:shadow-[0_12px_28px_rgba(255,255,255,0.25)]"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Solicitar demostración
                </Button>
              </Link>
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  )
}

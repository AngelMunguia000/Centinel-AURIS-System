"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { NodeGraphIllustration } from "@/components/illustrations/node-graph-illustration"
import { GlassPanel } from "@/components/glass-panel"

export function ProductShowcase() {
  return (
    <div>
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        variants={fadeInUp}
        className="flex items-start justify-between gap-6 max-w-2xl mb-12"
      >
        <div className="space-y-4">
          <h3 className="text-2xl md:text-3xl font-semibold tracking-[-0.005em] text-balance text-white">Así se ve funcionando</h3>
          <p className="text-lg text-white/60 text-balance">
            El panel real de trabajo: reportes en seguimiento, prioridad y estado a la vista.
          </p>
        </div>
        <NodeGraphIllustration className="hidden md:block w-28 h-auto shrink-0 text-white/30" />
      </motion.div>

      <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeInUp} className="max-w-5xl">
        <GlassPanel padding="sm" radius="lg" className="overflow-hidden">
          <Image
            src="/operator-dashboard-screenshot.png"
            alt="Panel de trabajo de Centinela AURIS con reportes en seguimiento"
            width={1280}
            height={720}
            className="w-full h-auto rounded-2xl"
          />
        </GlassPanel>
      </motion.div>
    </div>
  )
}

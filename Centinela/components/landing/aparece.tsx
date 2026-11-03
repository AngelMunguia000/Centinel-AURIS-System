"use client"

import { motion } from "motion/react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"

// Envoltura cliente mínima para que los bloques de las landings sigan siendo componentes de servidor.
export function Aparece({ children, className, retraso = 0 }: { children: React.ReactNode; className?: string; retraso?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      variants={fadeInUp}
      transition={{ delay: retraso }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

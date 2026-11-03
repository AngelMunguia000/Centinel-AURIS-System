"use client"

import { motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export function LensIllustration({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const draw = (delay: number) =>
    reduce
      ? { pathLength: 1 }
      : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.2, delay, ease: "easeInOut" } }

  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true">
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        stroke="currentColor"
        strokeWidth="1.5"
        {...(reduce ? { pathLength: 1 } : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.2, ease: "easeInOut" } })}
      />
      <motion.circle
        cx="100"
        cy="100"
        r="45"
        stroke="currentColor"
        strokeWidth="1.5"
        {...(reduce ? { pathLength: 1 } : { initial: { pathLength: 0 }, whileInView: { pathLength: 1 }, viewport: { once: true }, transition: { duration: 1.2, delay: 0.15, ease: "easeInOut" } })}
      />
      <motion.circle
        cx="100"
        cy="100"
        r="10"
        className="text-primary"
        stroke="currentColor"
        strokeWidth="2"
        {...(reduce ? { scale: 1, opacity: 1 } : { initial: { scale: 0, opacity: 0 }, whileInView: { scale: 1, opacity: 1 }, viewport: { once: true }, transition: { duration: 0.4, delay: 0.9 } })}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 100 + Math.cos(rad) * 78
        const y1 = 100 + Math.sin(rad) * 78
        const x2 = 100 + Math.cos(rad) * 92
        const y2 = 100 + Math.sin(rad) * 92
        return (
          <motion.line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            {...(reduce ? { opacity: 1 } : { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.3, delay: 0.6 + i * 0.03 } })}
          />
        )
      })}
    </svg>
  )
}

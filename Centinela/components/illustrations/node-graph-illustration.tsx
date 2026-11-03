"use client"

import { motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

const nodes = [
  { x: 20, y: 60 },
  { x: 90, y: 20 },
  { x: 160, y: 50 },
  { x: 60, y: 110 },
  { x: 140, y: 120 },
  { x: 100, y: 70 },
]
const edges: [number, number][] = [
  [0, 5],
  [1, 5],
  [2, 5],
  [3, 5],
  [4, 5],
  [0, 3],
  [2, 4],
]

export function NodeGraphIllustration({ className }: { className?: string }) {
  const reduce = useReducedMotion()

  return (
    <svg viewBox="0 0 180 140" fill="none" className={className} aria-hidden="true">
      {edges.map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="currentColor"
          strokeWidth="1"
          {...(reduce
            ? { pathLength: 1, opacity: 1 }
            : { initial: { pathLength: 0, opacity: 0 }, whileInView: { pathLength: 1, opacity: 1 }, viewport: { once: true }, transition: { duration: 0.6, delay: i * 0.08, ease: "easeInOut" } })}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={i === 5 ? 5 : 3}
          className={i === 5 ? "text-primary" : undefined}
          fill="currentColor"
          {...(reduce
            ? { scale: 1, opacity: 1 }
            : { initial: { scale: 0, opacity: 0 }, whileInView: { scale: 1, opacity: 1 }, viewport: { once: true }, transition: { duration: 0.3, delay: 0.5 + i * 0.05 } })}
        />
      ))}
    </svg>
  )
}

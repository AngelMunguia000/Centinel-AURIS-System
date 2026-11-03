"use client"

import { useId } from "react"
import { motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

export interface GlassBlob {
  color: string
  size: string
  position: string
  shape?: "ellipse" | "circle"
  fade?: number
}

const defaultBlobs: GlassBlob[] = [
  { color: "#6b4c12", size: "70% 50%", position: "8% 0%" },
  { color: "#4a1520", size: "60% 45%", position: "100% 100%" },
  { color: "#1f2836", size: "40% 30%", position: "70% 15%" },
]

/** Fondo de todas las pantallas de la consola: el mismo lenguaje que la landing (grafito frío + franja ámbar delgada). Brain/21 §64 */
export const consolaBlobs: GlassBlob[] = [
  { color: "#1f2836", size: "60% 40%", position: "10% 0%" },
  { color: "#6b4c12", size: "45% 5%", position: "15% 2%" },
  { color: "#2a3444", shape: "circle", size: "8vw", position: "90% 88%" },
]

interface GlassBackgroundProps {
  blobs?: GlassBlob[]
  className?: string
}

export function GlassBackground({ blobs = defaultBlobs, className }: GlassBackgroundProps) {
  const reduced = useReducedMotion()
  const filterId = useId()
  const gradients = blobs
    .map(
      (blob) =>
        `radial-gradient(${blob.shape ?? "ellipse"} ${blob.size} at ${blob.position}, ${blob.color}, transparent ${blob.fade ?? 60}%)`,
    )
    .join(", ")

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 -z-10 overflow-hidden bg-background ${className ?? ""}`}
    >
      <motion.div
        className="absolute inset-[-10%] opacity-100"
        style={{ background: gradients }}
        animate={reduced ? undefined : {
          transform: ["translate(0px, 0px)", "translate(14px, -10px)", "translate(0px, 0px)"],
        }}
        transition={reduced ? undefined : { duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.35, mixBlendMode: "overlay" }}>
        <filter id={filterId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${filterId})`} />
      </svg>
    </div>
  )
}

"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const paddingMap = {
  sm: "p-5",
  md: "p-7",
  lg: "p-8",
} as const

const radiusMap = {
  sm: "rounded-2xl",
  md: "rounded-2xl",
  lg: "rounded-2xl",
} as const

interface GlassPanelProps {
  children: ReactNode
  className?: string
  padding?: keyof typeof paddingMap
  radius?: keyof typeof radiusMap
}

export function GlassPanel({ children, className, padding = "md", radius = "lg" }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-white/[0.06] backdrop-blur-[20px] transition-shadow duration-300",
        "shadow-[0_30px_70px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.08)]",
        "hover:shadow-[0_36px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_0_0_1px_rgba(255,255,255,0.12)]",
        paddingMap[padding],
        radiusMap[radius],
        className,
      )}
    >
      {children}
    </div>
  )
}

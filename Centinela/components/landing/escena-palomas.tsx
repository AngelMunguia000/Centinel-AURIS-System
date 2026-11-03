"use client"

import dynamic from "next/dynamic"

// La demo 3D de rastreo de palomas (la misma de la landing principal) para las landings complementarias.
// Three.js solo en cliente, igual que en how-it-works-section.
const BirdTrackingScene = dynamic(() => import("@/components/BirdTrackingScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0a0a] font-mono text-xs text-signal/60 motion-safe:animate-pulse">
      Iniciando motor de visión 3D…
    </div>
  ),
})

export function EscenaPalomas() {
  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl md:h-[480px]">
      <BirdTrackingScene />
    </div>
  )
}

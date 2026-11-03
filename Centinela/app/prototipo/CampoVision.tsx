"use client"

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react"
import { C } from "@/lib/prototipo/constantes"
import type { FsmState } from "@/lib/prototipo/tipos"

const PX = 10 // píxeles por grado: el viewBox equivale al FOV de la cámara (72° × 54°)
const W = C.HFOV_DEG * PX
const H = C.VFOV_DEG * PX

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

interface Props {
  s: FsmState
  ave: { pan: number; tilt: number } | null
  puedeEjecutar: boolean
  onColocar: (pan: number, tilt: number) => void
}

export function CampoVision({ s, ave, puedeEjecutar, onColocar }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [fantasma, setFantasma] = useState<{ pan: number; tilt: number } | null>(null)

  const aPantalla = (pan: number, tilt: number) => ({
    x: W / 2 + (pan - s.pan) * PX,
    y: H / 2 - (tilt - s.tilt) * PX,
  })
  const colocar = (pan: number, tilt: number) =>
    onColocar(clamp(pan, C.PAN_MIN, C.PAN_MAX), clamp(tilt, C.TILT_MIN, C.TILT_MAX))

  const alClic = (e: MouseEvent<SVGSVGElement>) => {
    if (!puedeEjecutar || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const y = ((e.clientY - r.top) / r.height) * H
    colocar(s.pan + (x - W / 2) / PX, s.tilt - (y - H / 2) / PX)
  }

  // Alternativa de teclado: flechas mueven un ave fantasma, Enter la coloca, Escape la descarta.
  const alTeclado = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!puedeEjecutar) return
    const base = fantasma ?? { pan: s.pan, tilt: s.tilt }
    const paso = 2
    if (e.key === "ArrowLeft") setFantasma({ ...base, pan: clamp(base.pan - paso, C.PAN_MIN, C.PAN_MAX) })
    else if (e.key === "ArrowRight") setFantasma({ ...base, pan: clamp(base.pan + paso, C.PAN_MIN, C.PAN_MAX) })
    else if (e.key === "ArrowUp") setFantasma({ ...base, tilt: clamp(base.tilt + paso, C.TILT_MIN, C.TILT_MAX) })
    else if (e.key === "ArrowDown") setFantasma({ ...base, tilt: clamp(base.tilt - paso, C.TILT_MIN, C.TILT_MAX) })
    else if (e.key === "Enter") {
      colocar(base.pan, base.tilt)
      setFantasma(null)
    } else if (e.key === "Escape") setFantasma(null)
    else return
    e.preventDefault()
  }

  const pAve = ave ? aPantalla(ave.pan, ave.tilt) : null
  const pFan = fantasma ? aPantalla(fantasma.pan, fantasma.tilt) : null

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="application"
      tabIndex={0}
      aria-label={
        puedeEjecutar
          ? "Campo de visión de la cámara. Haz clic para colocar un ave, o usa las flechas para mover un ave fantasma y Enter para colocarla."
          : "Campo de visión de la cámara (modo lectura)."
      }
      onClick={alClic}
      onKeyDown={alTeclado}
      className={`w-full rounded-xl border border-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground ${puedeEjecutar ? "cursor-crosshair" : ""}`}
    >
      {/* Superficie de "video oscuro": color fijo a propósito (igual que las tarjetas de cámara del dashboard). */}
      <rect width={W} height={H} fill="#0e1218" />
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * 90} y1={0} x2={(i + 1) * 90} y2={H} stroke="rgba(255,255,255,0.06)" />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * 90} x2={W} y2={(i + 1) * 90} stroke="rgba(255,255,255,0.06)" />
      ))}
      <line x1={W / 2 - 24} y1={H / 2} x2={W / 2 + 24} y2={H / 2} stroke="rgba(126,232,240,0.8)" />
      <line x1={W / 2} y1={H / 2 - 24} x2={W / 2} y2={H / 2 + 24} stroke="rgba(126,232,240,0.8)" />
      <circle cx={W / 2} cy={H / 2} r={C.DEADBAND_DEG * PX} fill="none" stroke="rgba(126,232,240,0.6)" strokeDasharray="4 4" />

      {s.audio && (
        <g className="motion-safe:animate-pulse" aria-hidden="true">
          <circle cx={W / 2} cy={H / 2} r={70} fill="none" stroke="rgba(245,197,66,0.55)" strokeWidth={3} />
          <circle cx={W / 2} cy={H / 2} r={110} fill="none" stroke="rgba(245,197,66,0.3)" strokeWidth={3} />
        </g>
      )}

      {pAve && (
        <g>
          <circle cx={pAve.x} cy={pAve.y} r={11} fill="#f5c542" />
          <text x={pAve.x + 16} y={pAve.y + 4} fontSize={14} fill="#f5c542">ave</text>
        </g>
      )}
      {pFan && (
        <circle cx={pFan.x} cy={pFan.y} r={11} fill="none" stroke="#f5c542" strokeDasharray="3 3" />
      )}
      <text x={12} y={22} fontSize={14} fill="rgba(255,255,255,0.7)" fontFamily="monospace">
        {s.estado}{s.sub ? ` · ${s.sub}` : ""}
      </text>
    </svg>
  )
}

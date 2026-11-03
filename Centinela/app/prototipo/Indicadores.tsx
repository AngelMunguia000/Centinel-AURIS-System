import { C } from "@/lib/prototipo/constantes"
import type { FsmState } from "@/lib/prototipo/tipos"

function Barra({ etiqueta, valor, min, max }: { etiqueta: string; valor: number; min: number; max: number }) {
  const pct = ((valor - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex justify-between text-xs text-foreground/60 mb-1">
        <span>{etiqueta}</span>
        <span className="font-mono">{valor.toFixed(1)}°</span>
      </div>
      <div
        className="relative h-2 rounded bg-foreground/10"
        role="meter"
        aria-label={etiqueta}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(valor)}
      >
        <div
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded bg-signal"
          style={{ left: `calc(${pct}% - 3px)` }}
        />
      </div>
    </div>
  )
}

export function Indicadores({ s, cicloPct }: { s: FsmState; cicloPct: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 mt-4">
      <Barra etiqueta="Pan" valor={s.pan} min={C.PAN_MIN} max={C.PAN_MAX} />
      <Barra etiqueta="Tilt" valor={s.tilt} min={C.TILT_MIN} max={C.TILT_MAX} />
      <div className="text-xs text-foreground/60">
        <p className="mb-1">Ráfaga</p>
        {s.audio && s.patron ? (
          <p className="font-mono text-foreground">
            {s.patron.familia} · {(s.patron.duracionMs / 1000).toFixed(1)} s · ganancia {s.patron.gain}
          </p>
        ) : (
          <p className="font-mono text-foreground/50">silencio (MUTE)</p>
        )}
      </div>
      <div className="text-xs text-foreground/60">
        <p className="mb-1">Ciclo de trabajo usado: {cicloPct} % del máximo (20 % en 60 s)</p>
        <div className="h-2 rounded bg-foreground/10" role="meter" aria-label="Ciclo de trabajo usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cicloPct}>
          <div className="h-2 origin-left rounded bg-amber-500" style={{ transform: `scaleX(${cicloPct / 100})` }} />
        </div>
      </div>
    </div>
  )
}

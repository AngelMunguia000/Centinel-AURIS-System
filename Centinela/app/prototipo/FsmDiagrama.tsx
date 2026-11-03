import { cn } from "@/lib/utils"
import type { Estado, FsmState } from "@/lib/prototipo/tipos"

const ORDEN: Estado[] = [
  "BOOT", "SELFTEST", "IDLE", "SCANNING", "TRACKING", "AIMING", "CONFIRMING",
  "DETERRING", "COOLDOWN", "HOMING", "SAFE_MUTE", "AUTONOMOUS", "FAULT",
]
const DEGRADADOS: Estado[] = ["SAFE_MUTE", "AUTONOMOUS", "FAULT"]

export function FsmDiagrama({ s }: { s: FsmState }) {
  return (
    <div>
      {/* El texto solo cambia cuando cambia el estado, así que aria-live no satura al lector de pantalla. */}
      <p className="sr-only" role="status" aria-live="polite">
        Estado de la máquina: {s.estado}{s.sub ? `, ${s.sub}` : ""}
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Estados de la máquina de estados">
        {ORDEN.map((e) => {
          const activo = e === s.estado
          return (
            <li
              key={e}
              aria-current={activo ? "step" : undefined}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px]",
                !activo && "border-foreground/10 text-foreground/40",
                activo && !DEGRADADOS.includes(e) && "border-signal/50 bg-signal/15 text-accent-foreground",
                activo && DEGRADADOS.includes(e) && "border-red-500/50 bg-red-500/15 text-red-300",
              )}
            >
              {e}{activo && e === "DETERRING" && s.sub ? ` · ${s.sub}` : ""}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

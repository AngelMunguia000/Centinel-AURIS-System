import { cn } from "@/lib/utils"

// PDF §9.3: jerarquía de seis barreras contra la emisión acústica descontrolada.
// En esta simulación solo la 1 (ciclo de trabajo) y la 4 (sobrecorriente) pueden actuar;
// la 5 y la 6 no dependen del software, así que se muestran siempre activas.
const BARRERAS = [
  { id: 1, nombre: "Política de aplicación", detalle: "Ciclo de trabajo y límites en la Pi", pasiva: false },
  { id: 2, nombre: "Validación de firmware", detalle: "Saturación de parámetros en el ESP32", pasiva: false },
  { id: 3, nombre: "Temporizador de software", detalle: "xTimer de 3000 ms", pasiva: false },
  { id: 4, nombre: "Monitor eléctrico", detalle: "INA219 con ISR de sobrecorriente", pasiva: false },
  { id: 5, nombre: "Watchdog de hardware", detalle: "TPS3813, independiente del firmware", pasiva: true },
  { id: 6, nombre: "Barrera pasiva", detalle: "Pull-down de 10 kΩ en la línea SD", pasiva: true },
]

export function BarrerasSeguridad({ activas }: { activas: number[] }) {
  return (
    <div>
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {BARRERAS.map((b) => {
          const encendida = activas.includes(b.id)
          return (
            <li
              key={b.id}
              className={cn(
                "rounded-lg border p-2 text-xs",
                encendida && "border-red-500/60 bg-red-500/15 text-red-300",
                !encendida && b.pasiva && "border-dashed border-foreground/20 text-foreground/70",
                !encendida && !b.pasiva && "border-foreground/10 text-foreground/50",
              )}
            >
              <p className="font-medium">{b.id}. {b.nombre}</p>
              <p className="mt-0.5 opacity-80">{b.detalle}</p>
              <p className="mt-1 font-mono text-[10px]">
                {encendida ? "ACTUÓ" : b.pasiva ? "siempre activa" : "en espera"}
              </p>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-foreground/50">
        Las barreras 5 y 6 no dependen del software: siguen actuando con el firmware corrupto, con el ESP32 en reset o sin programa (PDF §9.3).
      </p>
    </div>
  )
}

// Límites mecánicos del Pan-Tilt (manual v2 §3.3.3). Los valida cada salto del
// enlace edge: web (lib/edge/contrato.ts), Pi (pydantic) y el propio ESP32, que
// protege al servo real — spec 2026-10-16-enlace-edge-design.md §4.1.
//
// Hasta 2026-10-16 aquí vivía un adaptador de servo simulado en memoria; los
// comandos ahora van al nodo real por /api/edge/nodos/[id]/comandos.
export const LIMITES_SERVO = {
  pan: { min: 0, max: 180, centro: 90 },
  tilt: { min: -20, max: 45, centro: 0 },
} as const

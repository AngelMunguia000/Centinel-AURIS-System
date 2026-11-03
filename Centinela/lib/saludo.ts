// Saludo del Inicio según la hora local del usuario (pedido del PO, 2026-10-23:
// "buenos días Angel Munguía, desmañanado Angel Munguía, y así por el estilo").
// Puro a propósito: se calcula en el navegador y se prueba sin DOM.

const FRASES: { hasta: number; frases: string[] }[] = [
  { hasta: 5, frases: ["Trasnochando", "Desvelado", "La noche es larga"] },
  { hasta: 7, frases: ["Desmañanado", "Madrugaste", "Temprano hoy"] },
  { hasta: 12, frases: ["Buenos días", "Buen día"] },
  { hasta: 19, frases: ["Buenas tardes", "Qué tal la tarde"] },
  { hasta: 24, frases: ["Buenas noches", "Buena noche"] },
]

/** "Angel David" + "Munguía Zúñiga" → "Angel Munguía". */
export function nombreCorto(nombre: string, apellido: string): string {
  return [nombre, apellido].map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).join(" ")
}

/** Frase para la hora (0-23); `dia` elige la variante para que no cambie en cada recarga del mismo día. */
export function saludo(hora: number, nombre: string, dia = 0): string {
  const { frases } = FRASES.find((f) => hora < f.hasta) ?? FRASES[FRASES.length - 1]
  const frase = frases[Math.abs(dia) % frases.length]
  return nombre ? `${frase}, ${nombre}` : frase
}

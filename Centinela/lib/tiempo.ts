// Tiempos relativos con fecha, para no confundir días: "hace 2 días (22 oct, 19:22)".
// Mismo texto que hace() de Centinela Desktop (auditoría de la consola, 2026-10-24).

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dos = (n: number) => String(n).padStart(2, '0')

export function hace(cuando: string | Date | null | undefined, ahora: number = Date.now()): string {
  if (!cuando) return 'nunca'
  const d = new Date(cuando)
  if (Number.isNaN(d.getTime())) return 'nunca'
  const s = Math.max(0, Math.floor((ahora - d.getTime()) / 1000))
  const dias = Math.floor(s / 86_400)
  const rel =
    s < 60 ? 'hace un momento'
    : s < 3_600 ? `hace ${Math.floor(s / 60)} min`
    : s < 86_400 ? `hace ${Math.floor(s / 3_600)} h`
    : `hace ${dias} día${dias === 1 ? '' : 's'}`
  const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`
  const mismoDia = new Date(ahora).toDateString() === d.toDateString()
  return `${rel} (${mismoDia ? hora : `${d.getDate()} ${MESES[d.getMonth()]}, ${hora}`})`
}

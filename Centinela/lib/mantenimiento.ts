import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { aplicarRetencion } from '@/lib/retencion'

// Mantenimiento diario de la base (Sessions/Centinela_2026-10-25_actualizacion_base.md): WAL para que
// la telemetría de las Pi (escrituras cada pocos segundos) no bloquee las lecturas de la consola, y un
// respaldo al día. No hay cron: lo dispara GET /api/notificaciones, como el escalamiento.

const CONSERVAR = 10
const carpeta = () => process.env.RESPALDOS_DIR ?? path.resolve('prisma/_backups')
const dia = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

let ultimoDia: string | null = null

/** WAL queda guardado en el archivo de la base: basta con pedirlo una vez, pero repetirlo no hace daño. */
export async function asegurarWal(): Promise<string> {
  const filas = await prisma.$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode=WAL')
  return filas[0]?.journal_mode ?? ''
}

/** Copia consistente aunque el servidor esté escribiendo (VACUUM INTO, igual que `npm run db:respaldo`). */
export async function respaldar(ahora: Date = new Date()): Promise<string> {
  mkdirSync(carpeta(), { recursive: true })
  const sello = `${dia(ahora)}-${ahora.toTimeString().slice(0, 8).replaceAll(':', '')}`
  const destino = path.join(carpeta(), `dev-${sello}.db`)
  await prisma.$executeRawUnsafe(`VACUUM INTO '${destino.replaceAll("'", "''")}'`)
  const viejos = readdirSync(carpeta()).filter((f) => /^dev-\d{8}-\d{6}\.db$/.test(f)).sort().slice(0, -CONSERVAR)
  for (const f of viejos) rmSync(path.join(carpeta(), f))
  return destino
}

/** Una vez por día por arranque del servidor; si hoy ya hay respaldo, no hace otro. */
export async function mantenimientoDiario(ahora: Date = new Date()): Promise<void> {
  // Las pruebas usan prisma/test.db: sus respaldos se mezclarían con los de la base real.
  if (process.env.NODE_ENV === 'test') return
  const hoy = dia(ahora)
  if (ultimoDia === hoy) return
  ultimoDia = hoy
  await asegurarWal()
  mkdirSync(carpeta(), { recursive: true })
  const yaHayDeHoy = readdirSync(carpeta()).some((f) => f.startsWith(`dev-${hoy}-`))
  if (!yaHayDeHoy) console.log(`[mantenimiento] respaldo en ${await respaldar(ahora)}`)
  // Después del respaldo: lo que se borra hoy sigue en la copia de hoy.
  console.log('[mantenimiento] retención:', JSON.stringify(await aplicarRetencion(ahora)))
}

import { prisma } from '@/lib/prisma'

// Historial de telemetría (Sessions/Centinela_2026-10-25_actualizacion_base.md, fase 2). La Pi manda una
// muestra cada 2 s; aquí se acumula en memoria y se escribe UNA fila al cerrar cada minuto (en vez de 30),
// más la fila de su hora. Sumas en vez de promedios: el promedio se calcula al leer (suma / muestras).

const MIN_MS = 60_000
const HORA_MS = 3_600_000

type Muestra = { temp_c: number; rssi_dbm: number; heap_libre: number }
type Acumulado = { inicio: number; muestras: number; tempSuma: number; tempMin: number; tempMax: number; rssiSuma: number; rssiMin: number; heapMin: number }
type Valores = Omit<Acumulado, 'inicio'>

// shortcut: el minuto en curso vive en memoria; si el servidor se reinicia se pierde ese minuto (≤ 30
// muestras). Con varias instancias del servidor habría que acumular en la base o en Redis.
const abiertos = new Map<number, Acumulado>()

const nuevo = (inicio: number, m: Muestra): Acumulado => ({
  inicio, muestras: 1, tempSuma: m.temp_c, tempMin: m.temp_c, tempMax: m.temp_c, rssiSuma: m.rssi_dbm, rssiMin: m.rssi_dbm, heapMin: m.heap_libre,
})

const combinar = (a: Valores, b: Valores): Valores => ({
  muestras: a.muestras + b.muestras,
  tempSuma: a.tempSuma + b.tempSuma,
  rssiSuma: a.rssiSuma + b.rssiSuma,
  tempMin: Math.min(a.tempMin, b.tempMin),
  tempMax: Math.max(a.tempMax, b.tempMax),
  rssiMin: Math.min(a.rssiMin, b.rssiMin),
  heapMin: Math.min(a.heapMin, b.heapMin),
})

/** Llamar con cada muestra que llega de la Pi (lib/edge/ingesta.ts). */
export async function anotarMuestra(dispositivoId: number, m: Muestra, ahora: Date): Promise<void> {
  const inicio = Math.floor(ahora.getTime() / MIN_MS) * MIN_MS
  const actual = abiertos.get(dispositivoId)
  if (actual && actual.inicio === inicio) {
    abiertos.set(dispositivoId, { inicio, ...combinar(actual, nuevo(inicio, m)) })
    return
  }
  abiertos.set(dispositivoId, nuevo(inicio, m))
  if (actual) await cerrarMinuto(dispositivoId, actual)
}

async function cerrarMinuto(dispositivoId: number, { inicio, ...minuto }: Acumulado): Promise<void> {
  await prisma.telemetriaMinuto.upsert({
    where: { dispositivoId_inicio: { dispositivoId, inicio: new Date(inicio) } },
    create: { dispositivoId, inicio: new Date(inicio), ...minuto },
    update: minuto,
  })
  // La hora se combina con lo que ya tenga: una sola Pi escribe por nodo, así que leer y escribir basta.
  const hora = new Date(Math.floor(inicio / HORA_MS) * HORA_MS)
  const clave = { dispositivoId_inicio: { dispositivoId, inicio: hora } }
  const previa = await prisma.telemetriaHora.findUnique({ where: clave })
  const total = previa ? combinar(previa, minuto) : minuto
  await prisma.telemetriaHora.upsert({ where: clave, create: { dispositivoId, inicio: hora, ...total }, update: total })
}

export interface PuntoTelemetria {
  inicio: string
  tempProm: number
  tempMin: number
  tempMax: number
  rssiProm: number
  rssiMin: number
  heapMin: number
}

/** Hasta 48 h se lee por minuto; más allá, por hora. */
export async function historialDe(dispositivoId: number, horas: number, ahora: Date = new Date()): Promise<{ escala: 'minuto' | 'hora'; puntos: PuntoTelemetria[] }> {
  const desde = new Date(ahora.getTime() - horas * HORA_MS)
  const escala = horas <= 48 ? 'minuto' : 'hora'
  const consulta = { where: { dispositivoId, inicio: { gte: desde } }, orderBy: { inicio: 'asc' as const } }
  const filas = escala === 'minuto' ? await prisma.telemetriaMinuto.findMany(consulta) : await prisma.telemetriaHora.findMany(consulta)
  const r = (n: number) => Math.round(n * 10) / 10
  return {
    escala,
    puntos: filas.map((f) => ({
      inicio: f.inicio.toISOString(),
      tempProm: r(f.tempSuma / f.muestras),
      tempMin: f.tempMin,
      tempMax: f.tempMax,
      rssiProm: r(f.rssiSuma / f.muestras),
      rssiMin: f.rssiMin,
      heapMin: f.heapMin,
    })),
  }
}

/** Para pruebas: el estado en memoria no debe pasar de una prueba a otra. */
export const _reiniciarAcumulados = () => abiertos.clear()

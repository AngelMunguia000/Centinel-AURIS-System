import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { estadoDerivado, type EventoVivo } from '@/lib/edge/estado'
import type { Severidad } from '@/lib/edge/contrato'

// Spec 2026-10-16-enlace-edge-design.md §6.3-6.4: Bitácora y Dashboard sobre datos reales.

type Cuenta = { id: number; permisos: Set<string> }

export const veDispositivos = (u: Cuenta) => u.permisos.has('dispositivos.propios') || u.permisos.has('dispositivos.otros')

export function filtroNodos(u: Cuenta): Prisma.DispositivoWhereInput {
  return { gatewayId: { not: null }, ...(u.permisos.has('dispositivos.otros') ? {} : { usuarioId: u.id }) }
}

export async function eventosVisibles(u: Cuenta, limite: number): Promise<{ eventos: EventoVivo[]; total: number }> {
  if (!veDispositivos(u)) return { eventos: [], total: 0 }
  const where: Prisma.EventoDispositivoWhereInput = { dispositivo: filtroNodos(u) }
  const [filas, total] = await Promise.all([
    prisma.eventoDispositivo.findMany({
      where,
      include: { dispositivo: { select: { nombre: true } } },
      orderBy: { ocurridoEn: 'desc' },
      take: limite,
    }),
    prisma.eventoDispositivo.count({ where }),
  ])
  return {
    total,
    eventos: filas.map((e) => ({
      id: e.id,
      dispositivoId: e.dispositivoId,
      dispositivoNombre: e.dispositivo.nombre,
      tipo: e.tipo,
      severidad: e.severidad as Severidad,
      detalle: e.detalle,
      ocurridoEn: e.ocurridoEn.toISOString(),
      evidencia: !!e.evidencia,
    })),
  }
}

export interface ResumenEdge {
  nodosTotal: number
  nodosEnLinea: number
  eventosHoy: number
  altasHoy: number
  ultimosEventos: EventoVivo[]
  /** Nodos que no están en línea, con su último contacto (para "Requiere atención" del Inicio). */
  caidos: { nombre: string; ultimoContacto: string | null }[]
  /** Eventos por hora de las últimas 24 h; el último es la hora en curso. */
  actividad24h: number[]
  /** Eventos desde `desde` (la visita anterior), o 0 si no se pidió. */
  eventosDesde: number
}

export async function resumenEdge(u: Cuenta, desde?: Date | null): Promise<ResumenEdge> {
  if (!veDispositivos(u)) {
    return { nodosTotal: 0, nodosEnLinea: 0, eventosHoy: 0, altasHoy: 0, ultimosEventos: [], caidos: [], actividad24h: Array(24).fill(0), eventosDesde: 0 }
  }
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)
  const hoy: Prisma.EventoDispositivoWhereInput = { dispositivo: filtroNodos(u), ocurridoEn: { gte: inicioDia } }

  const ahora = new Date()
  const horaActual = new Date(ahora)
  horaActual.setMinutes(0, 0, 0)
  const hace24h = new Date(horaActual.getTime() - 23 * 3_600_000)

  const [nodos, eventosHoy, altasHoy, { eventos }, recientes, eventosDesde] = await Promise.all([
    prisma.dispositivo.findMany({
      where: filtroNodos(u),
      select: { nombre: true, conexion: true, gateway: { select: { ultimoContacto: true, revocadoEn: true } } },
    }),
    prisma.eventoDispositivo.count({ where: hoy }),
    prisma.eventoDispositivo.count({ where: { ...hoy, severidad: 'alta' } }),
    eventosVisibles(u, 5),
    prisma.eventoDispositivo.findMany({
      where: { dispositivo: filtroNodos(u), ocurridoEn: { gte: hace24h } },
      select: { ocurridoEn: true },
    }),
    desde ? prisma.eventoDispositivo.count({ where: { dispositivo: filtroNodos(u), ocurridoEn: { gt: desde } } }) : Promise.resolve(0),
  ])
  const enLinea = (d: (typeof nodos)[number]) => !d.gateway?.revocadoEn && estadoDerivado(d, ahora) === 'en_linea'
  const actividad24h = Array(24).fill(0)
  for (const e of recientes) {
    const suHora = new Date(e.ocurridoEn)
    suHora.setMinutes(0, 0, 0)
    const horas = Math.round((horaActual.getTime() - suHora.getTime()) / 3_600_000)
    if (horas >= 0 && horas < 24) actividad24h[23 - horas] += 1
  }
  return {
    nodosTotal: nodos.length,
    nodosEnLinea: nodos.filter(enLinea).length,
    eventosHoy,
    altasHoy,
    ultimosEventos: eventos,
    caidos: nodos.filter((d) => !enLinea(d)).map((d) => ({ nombre: d.nombre, ultimoContacto: d.gateway?.ultimoContacto?.toISOString() ?? null })),
    actividad24h,
    eventosDesde,
  }
}

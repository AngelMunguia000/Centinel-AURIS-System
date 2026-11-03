import { prisma } from '@/lib/prisma'
import type { Capacidades, Severidad } from '@/lib/edge/contrato'

// Spec 2026-10-16-enlace-edge-design.md §4.4 y §8.

export type EstadoNodo = 'en_linea' | 'desconectado' | 'sin_contacto'

export interface NodoVivo {
  id: number
  uid: string
  nombre: string
  estado: EstadoNodo
  capacidades: Capacidades | null
  telemetria: Record<string, number> | null
  ultimoContacto: string | null
  gatewayId: number | null
  gatewayNombre: string | null
}

export interface EventoVivo {
  id: string
  dispositivoId: number
  dispositivoNombre: string
  tipo: string
  severidad: Severidad
  detalle: string | null
  ocurridoEn: string
  // Hay foto de la cámara (GET /api/evidencia/[id]). Llega después del evento: en vivo aún es false.
  evidencia?: boolean
}

// La Pi manda telemetría cada 2 s: más de 10 s de silencio = la Pi no está.
export const SIN_CONTACTO_MS = 10_000

export function estadoDerivado(
  nodo: { conexion: string; gateway: { ultimoContacto: Date | null } | null },
  ahora: Date,
): EstadoNodo {
  const contacto = nodo.gateway?.ultimoContacto
  if (!contacto || ahora.getTime() - contacto.getTime() > SIN_CONTACTO_MS) return 'sin_contacto'
  return nodo.conexion === 'DESCONECTADO' ? 'desconectado' : 'en_linea'
}

export function visiblePara(usuario: { id: number; permisos: Set<string> }, usuarioIdDelEvento: number): boolean {
  return usuario.id === usuarioIdDelEvento || usuario.permisos.has('dispositivos.otros')
}

function jsonONull<T>(texto: string | null): T | null {
  if (!texto) return null
  try {
    return JSON.parse(texto) as T
  } catch {
    return null
  }
}

/** Nodos edge (los que reporta una Pi) visibles para la cuenta, con su estado derivado ahora. */
export async function snapshotPara(usuario: { id: number; permisos: Set<string> }): Promise<NodoVivo[]> {
  const nodos = await prisma.dispositivo.findMany({
    where: { gatewayId: { not: null }, ...(usuario.permisos.has('dispositivos.otros') ? {} : { usuarioId: usuario.id }) },
    include: { gateway: { select: { nombre: true, ultimoContacto: true, revocadoEn: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const ahora = new Date()
  return nodos.map((d) => ({
    id: d.id,
    uid: d.uid,
    nombre: d.nombre,
    // Un gateway revocado ya no puede reportar: su nodo está, a efectos prácticos, sin contacto.
    estado: d.gateway?.revocadoEn ? 'sin_contacto' : estadoDerivado(d, ahora),
    capacidades: jsonONull<Capacidades>(d.capacidades),
    telemetria: jsonONull<Record<string, number>>(d.telemetria),
    ultimoContacto: d.ultimoContacto?.toISOString() ?? null,
    gatewayId: d.gatewayId,
    gatewayNombre: d.gateway?.nombre ?? null,
  }))
}

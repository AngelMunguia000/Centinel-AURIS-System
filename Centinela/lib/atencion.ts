// "Requiere atención" del Inicio: lo que pide acción ahora, lo más grave primero.
// Misma regla que atencion() de Centinela Desktop (auditoría de la consola, 2026-10-24):
// Admin (ve todo y asigna): críticos/altos sin asignar y los vencidos sin acuse. Operador: lo suyo y lo urgente sin dueño.
// Usuario: sus pendientes. Los nodos caídos van antes que cualquier reporte.
import { hace } from '@/lib/tiempo'
import { vencido } from '@/lib/respuesta'

export type FilaAtencion = { titulo: string; detalle: string; tono: 'alerta' | 'senal' | 'neutro'; href: string }

type Pendiente = { id: number; titulo: string; prioridad: string; operadorAsignadoId: number | null; createdAt: Date | string; atendidoEn?: Date | string | null }
type Caido = { nombre: string; ultimoContacto: string | null }
type Cuenta = { id: number; role: string; permisos: Set<string> }

const NOMBRE: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' }
const ORDEN: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 }
const urgente = (r: Pendiente) => r.prioridad === 'critica' || r.prioridad === 'alta'

export function atencion(pendientes: Pendiente[], caidos: Caido[], u: Cuenta, ahora: number = Date.now()): FilaAtencion[] {
  const asigna = u.permisos.has('reportes.ver_todos') && u.permisos.has('reportes.asignar')
  // Vencido = sin acuse pasado su plazo (lib/respuesta.ts): el Admin lo ve aunque ya tenga dueño.
  const tarde = (r: Pendiente) => vencido({ ...r, estado: 'pendiente' }, ahora)
  const elegidos = asigna
    ? pendientes.filter((r) => (urgente(r) && !r.operadorAsignadoId) || tarde(r))
    : u.role === 'Operador'
      ? pendientes.filter((r) => r.operadorAsignadoId === u.id || (!r.operadorAsignadoId && urgente(r)))
      : pendientes
  const estado = (r: Pendiente) =>
    asigna ? 'sin asignar' : u.role !== 'Operador' ? 'pendiente' : r.operadorAsignadoId === u.id ? 'asignado a ti' : 'sin asignar'

  const reportes = [...elegidos]
    .sort((a, b) => Number(estado(a) !== 'asignado a ti') - Number(estado(b) !== 'asignado a ti')
      || (ORDEN[a.prioridad] ?? 9) - (ORDEN[b.prioridad] ?? 9) || b.id - a.id)
    .map((r): FilaAtencion => ({
      titulo: `${NOMBRE[r.prioridad] ?? r.prioridad} · ${r.titulo}`,
      detalle: `#${r.id} · ${tarde(r) ? 'vencido sin acuse' : estado(r)} · ${hace(r.createdAt, ahora)}`,
      tono: r.prioridad === 'critica' || tarde(r) ? 'alerta' : urgente(r) ? 'senal' : 'neutro',
      href: '/reportes',
    }))
  const nodos = caidos.map((n): FilaAtencion => ({
    titulo: `Nodo ${n.nombre} sin conexión`,
    detalle: `Último contacto ${hace(n.ultimoContacto, ahora)}`,
    tono: 'senal',
    href: '/monitor',
  }))
  return [...nodos, ...reportes]
}

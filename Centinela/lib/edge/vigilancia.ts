import { prisma } from '@/lib/prisma'

// Aviso de Raspberry Pi caída. No hay cron en Next: lo dispara GET /api/notificaciones,
// que cada campanita abierta consulta cada 15 s, así que el aviso llega aunque nadie mire el Monitor.

// Más largo que SIN_CONTACTO_MS (10 s, lo que pinta el Monitor) para no notificar
// por un tropiezo de Wi-Fi de unos segundos.
export const CAIDA_MS = 60_000

async function notificar(duenoId: number, mensaje: string): Promise<void> {
  const operadores = await prisma.usuario.findMany({ where: { rol: { nombre: 'Operador' } }, select: { id: true } })
  const destinatarios = new Set([duenoId, ...operadores.map((o) => o.id)])
  await prisma.notificacion.createMany({ data: [...destinatarios].map((destinatarioId) => ({ destinatarioId, mensaje })) })
}

const hora = (d: Date) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

export async function avisarGatewaysCaidos(ahora = new Date()): Promise<void> {
  const caidos = await prisma.gateway.findMany({
    where: { revocadoEn: null, avisoSinContactoEn: null, ultimoContacto: { lt: new Date(ahora.getTime() - CAIDA_MS) } },
    select: { id: true, nombre: true, usuarioId: true, ultimoContacto: true },
  })
  for (const g of caidos) {
    // Condicionado a "sin aviso": si dos campanitas consultan a la vez, solo una gana y avisa.
    const { count } = await prisma.gateway.updateMany({ where: { id: g.id, avisoSinContactoEn: null }, data: { avisoSinContactoEn: ahora } })
    if (count === 1) await notificar(g.usuarioId, `La Raspberry Pi "${g.nombre}" no responde (último contacto ${hora(g.ultimoContacto!)})`)
  }
}

/** Llamar cuando la Pi vuelve a mandar telemetría. */
export async function marcarGatewayActivo(gateway: { id: number; nombre: string; usuarioId: number }, ahora: Date): Promise<void> {
  await prisma.gateway.update({ where: { id: gateway.id }, data: { ultimoContacto: ahora } })
  const { count } = await prisma.gateway.updateMany({ where: { id: gateway.id, avisoSinContactoEn: { not: null } }, data: { avisoSinContactoEn: null } })
  if (count === 1) await notificar(gateway.usuarioId, `La Raspberry Pi "${gateway.nombre}" volvió a conectarse`)
}

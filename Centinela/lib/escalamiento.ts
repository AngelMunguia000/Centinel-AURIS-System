import { prisma } from '@/lib/prisma'
import { sendEscalamientoEmail } from '@/lib/mail'
import { META_ACUSE_MIN, VENTANA_ESCALAMIENTO_MS, vencido } from '@/lib/respuesta'
import { PRIORIDAD_LABELS } from '@/lib/reportes-catalogos'

// Escalamiento: un reporte pendiente que nadie acusó dentro de su plazo avisa a los Admin
// (campanita + correo) y a su Operador asignado. Igual que avisarGatewaysCaidos, no hay cron:
// lo dispara GET /api/notificaciones, que cada campanita abierta consulta cada 15 s.
export async function escalarVencidos(ahora = new Date()): Promise<number> {
  const t = ahora.getTime()
  const plazoMinimo = Math.min(...Object.values(META_ACUSE_MIN)) * 60_000
  const candidatos = await prisma.reporte.findMany({
    where: {
      estado: 'pendiente',
      atendidoEn: null,
      escaladoEn: null,
      createdAt: { lt: new Date(t - plazoMinimo), gte: new Date(t - VENTANA_ESCALAMIENTO_MS) },
    },
    select: { id: true, titulo: true, estado: true, prioridad: true, createdAt: true, operadorAsignadoId: true },
  })
  const vencidos = candidatos.filter((r) => vencido(r, t))
  if (vencidos.length === 0) return 0

  const admins = await prisma.usuario.findMany({ where: { rol: { nombre: 'Admin' } }, select: { id: true, email: true } })
  let escalados = 0
  for (const r of vencidos) {
    // Condicionado a "sin escalar": si dos campanitas consultan a la vez, solo una avisa.
    const { count } = await prisma.reporte.updateMany({ where: { id: r.id, escaladoEn: null }, data: { escaladoEn: ahora } })
    if (count !== 1) continue
    escalados++
    const mensaje = `Escalado: el reporte #${r.id} "${r.titulo}" (${PRIORIDAD_LABELS[r.prioridad] ?? r.prioridad}) lleva más de ${META_ACUSE_MIN[r.prioridad] ?? 60} min sin acuse`
    const destinatarios = new Set([...admins.map((a) => a.id), ...(r.operadorAsignadoId ? [r.operadorAsignadoId] : [])])
    await prisma.notificacion.createMany({ data: [...destinatarios].map((destinatarioId) => ({ destinatarioId, mensaje, reporteId: r.id })) })
    // Un correo que falla no debe deshacer el aviso en la campanita.
    for (const a of admins) {
      const res = await sendEscalamientoEmail(a.email, mensaje).catch((e: Error) => ({ sent: false, reason: e.message }))
      if (!res.sent && res.reason) console.error(`[escalamiento] correo a admin ${a.id} no enviado: ${res.reason}`)
    }
  }
  return escalados
}

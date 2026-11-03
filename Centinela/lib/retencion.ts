import { rm } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { carpetaEvidencias } from '@/lib/edge/evidencia'

// Retención (Sessions/Centinela_2026-10-25_actualizacion_base.md, fase 4; decisión del PO: fotos 30 días).
// Corre en el mantenimiento diario, después del respaldo, así lo borrado aún está en la copia del día.

const DIA_MS = 86_400_000
export const RETENCION_DIAS = {
  fotos: 30, // salvo las de reportes pendientes: son evidencia de algo sin cerrar
  eventos: 365,
  telemetriaMinuto: 30,
  telemetriaHora: 365,
  sesiones: 30, // vencidas o revocadas hace más de esto
  avisosLeidos: 60,
} as const

export async function aplicarRetencion(ahora: Date = new Date()) {
  const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA_MS)

  const fotosViejas = await prisma.eventoDispositivo.findMany({
    where: { evidencia: { not: null }, ocurridoEn: { lt: hace(RETENCION_DIAS.fotos) }, reportes: { none: { estado: 'pendiente' } } },
    select: { id: true, evidencia: true },
  })
  for (const e of fotosViejas) {
    await rm(path.join(carpetaEvidencias(), path.basename(e.evidencia!)), { force: true })
    await prisma.eventoDispositivo.update({ where: { id: e.id }, data: { evidencia: null } })
  }

  const [eventos, disuasiones, minutos, horas, sesiones, avisos] = await Promise.all([
    // Un evento con foto de un reporte pendiente se conserva aunque pase el año.
    prisma.eventoDispositivo.deleteMany({ where: { ocurridoEn: { lt: hace(RETENCION_DIAS.eventos) }, reportes: { none: { estado: 'pendiente' } } } }),
    prisma.disuasion.deleteMany({ where: { ocurridoEn: { lt: hace(RETENCION_DIAS.eventos) } } }),
    prisma.telemetriaMinuto.deleteMany({ where: { inicio: { lt: hace(RETENCION_DIAS.telemetriaMinuto) } } }),
    prisma.telemetriaHora.deleteMany({ where: { inicio: { lt: hace(RETENCION_DIAS.telemetriaHora) } } }),
    prisma.sesion.deleteMany({ where: { OR: [{ expiraEn: { lt: hace(RETENCION_DIAS.sesiones) } }, { revocadaEn: { lt: hace(RETENCION_DIAS.sesiones) } }] } }),
    prisma.notificacion.deleteMany({ where: { leida: true, createdAt: { lt: hace(RETENCION_DIAS.avisosLeidos) } } }),
  ])
  return {
    fotos: fotosViejas.length,
    eventos: eventos.count,
    disuasiones: disuasiones.count,
    telemetriaMinutos: minutos.count,
    telemetriaHoras: horas.count,
    sesiones: sesiones.count,
    avisos: avisos.count,
  }
}

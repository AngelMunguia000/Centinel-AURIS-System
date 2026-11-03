import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { aplicarRetencion } from '@/lib/retencion'
import { createUsuario, deleteUsuario, deleteReporte } from './helpers'

// Retención (actualización de base 2026-10-25, fase 4).
beforeAll(() => {
  process.env.EVIDENCIAS_DIR = mkdtempSync(path.join(tmpdir(), 'evidencias-ret-'))
})
const usuarios: number[] = []
afterEach(async () => {
  for (const r of await prisma.reporte.findMany({ where: { usuarioId: { in: usuarios } }, select: { id: true } })) await deleteReporte(r.id)
  for (const id of usuarios.splice(0)) {
    await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
    await deleteUsuario(id)
  }
})

const AHORA = new Date(2026, 9, 25, 3, 0)
const hace = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000)

async function eventoConFoto(dispositivoId: number, dias: number) {
  const id = randomUUID()
  writeFileSync(path.join(process.env.EVIDENCIAS_DIR!, `${id}.jpg`), 'jpeg')
  await prisma.eventoDispositivo.create({ data: { id, dispositivoId, tipo: 'movimiento', severidad: 'alta', ocurridoEn: hace(dias), evidencia: `${id}.jpg` } })
  return id
}

describe('retención', () => {
  it('borra lo viejo y conserva la evidencia de reportes pendientes', async () => {
    const { usuario } = await createUsuario('Usuario')
    usuarios.push(usuario.id)
    const d = await prisma.dispositivo.create({ data: { nombre: 'n', uid: `uid-${randomUUID()}`, tipo: 'sensor', usuarioId: usuario.id } })

    const fotoReciente = await eventoConFoto(d.id, 5)
    const fotoVieja = await eventoConFoto(d.id, 40)
    const fotoDeReporteAbierto = await eventoConFoto(d.id, 40)
    await prisma.reporte.create({ data: { titulo: 'abierto', descripcion: '-', usuarioId: usuario.id, eventoId: fotoDeReporteAbierto } })
    const eventoDeHaceDosAnios = randomUUID()
    await prisma.eventoDispositivo.create({ data: { id: eventoDeHaceDosAnios, dispositivoId: d.id, tipo: 'prueba', severidad: 'baja', ocurridoEn: hace(800) } })
    await prisma.telemetriaMinuto.create({ data: { dispositivoId: d.id, inicio: hace(31), muestras: 1, tempSuma: 40, tempMin: 40, tempMax: 40, rssiSuma: -60, rssiMin: -60, heapMin: 1 } })
    await prisma.telemetriaMinuto.create({ data: { dispositivoId: d.id, inicio: hace(1), muestras: 1, tempSuma: 40, tempMin: 40, tempMax: 40, rssiSuma: -60, rssiMin: -60, heapMin: 1 } })
    await prisma.sesion.create({ data: { id: randomUUID(), usuarioId: usuario.id, via: 'password', expiraEn: hace(45) } })
    await prisma.notificacion.create({ data: { destinatarioId: usuario.id, mensaje: 'viejo', leida: true, createdAt: hace(90) } })
    await prisma.notificacion.create({ data: { destinatarioId: usuario.id, mensaje: 'sin leer', leida: false, createdAt: hace(90) } })

    const r = await aplicarRetencion(AHORA)
    expect(r.fotos).toBeGreaterThanOrEqual(1)
    const foto = (id: string) => existsSync(path.join(process.env.EVIDENCIAS_DIR!, `${id}.jpg`))
    expect(foto(fotoReciente)).toBe(true)
    expect(foto(fotoVieja)).toBe(false)
    expect((await prisma.eventoDispositivo.findUniqueOrThrow({ where: { id: fotoVieja } })).evidencia).toBeNull()
    expect(foto(fotoDeReporteAbierto)).toBe(true) // evidencia de algo sin cerrar
    expect(await prisma.eventoDispositivo.findUnique({ where: { id: eventoDeHaceDosAnios } })).toBeNull()
    expect(await prisma.telemetriaMinuto.count({ where: { dispositivoId: d.id } })).toBe(1)
    expect(await prisma.sesion.count({ where: { usuarioId: usuario.id } })).toBe(0)
    expect((await prisma.notificacion.findMany({ where: { destinatarioId: usuario.id } })).map((n) => n.mensaje)).toEqual(['sin leer'])
  })
})

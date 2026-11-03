import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { anotarMuestra, historialDe, _reiniciarAcumulados } from '@/lib/edge/historial'
import { asegurarWal, respaldar } from '@/lib/mantenimiento'
import { createUsuario, deleteUsuario } from './helpers'

// Actualización de base (Sessions/Centinela_2026-10-25_actualizacion_base.md, fases 1 y 2).
const usuarios: number[] = []
beforeEach(() => _reiniciarAcumulados())
afterEach(async () => {
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

async function nodo() {
  const { usuario } = await createUsuario('Usuario')
  usuarios.push(usuario.id)
  return prisma.dispositivo.create({ data: { nombre: 'n', uid: `uid-${Date.now()}-${Math.random()}`, tipo: 'sensor', usuarioId: usuario.id } })
}

const t = (h: number, m: number, s: number) => new Date(2026, 9, 25, h, m, s)
const muestra = (temp: number, rssi: number, heap: number) => ({ temp_c: temp, rssi_dbm: rssi, heap_libre: heap })

describe('historial de telemetría', () => {
  it('una fila por minuto con promedio, mínimo y máximo; la hora combina sus minutos', async () => {
    const d = await nodo()
    await anotarMuestra(d.id, muestra(40, -60, 200_000), t(10, 0, 0))
    await anotarMuestra(d.id, muestra(44, -70, 180_000), t(10, 0, 30))
    expect(await prisma.telemetriaMinuto.count({ where: { dispositivoId: d.id } })).toBe(0) // el minuto sigue abierto
    await anotarMuestra(d.id, muestra(50, -50, 190_000), t(10, 1, 0)) // cierra 10:00
    await anotarMuestra(d.id, muestra(30, -80, 210_000), t(10, 2, 0)) // cierra 10:01

    const minutos = await prisma.telemetriaMinuto.findMany({ where: { dispositivoId: d.id }, orderBy: { inicio: 'asc' } })
    expect(minutos).toHaveLength(2)
    expect(minutos[0]).toMatchObject({ muestras: 2, tempSuma: 84, tempMin: 40, tempMax: 44, rssiMin: -70, heapMin: 180_000 })

    const hora = await prisma.telemetriaHora.findUniqueOrThrow({ where: { dispositivoId_inicio: { dispositivoId: d.id, inicio: t(10, 0, 0) } } })
    expect(hora).toMatchObject({ muestras: 3, tempSuma: 134, tempMin: 40, tempMax: 50, heapMin: 180_000 })

    const corto = await historialDe(d.id, 24, t(11, 0, 0))
    expect(corto.escala).toBe('minuto')
    expect(corto.puntos[0]).toMatchObject({ tempProm: 42, rssiProm: -65 })
    const largo = await historialDe(d.id, 24 * 7, t(11, 0, 0))
    expect(largo.escala).toBe('hora')
    expect(largo.puntos[0].tempProm).toBe(44.7)
  })

  it('el respaldo es una copia de la base y WAL queda activo', async () => {
    process.env.RESPALDOS_DIR = mkdtempSync(path.join(tmpdir(), 'respaldos-'))
    const destino = await respaldar(t(3, 0, 0))
    expect(existsSync(destino)).toBe(true)
    expect(readdirSync(process.env.RESPALDOS_DIR)).toEqual([path.basename(destino)])
    expect(await asegurarWal()).toBe('wal')
    delete process.env.RESPALDOS_DIR
  })
})

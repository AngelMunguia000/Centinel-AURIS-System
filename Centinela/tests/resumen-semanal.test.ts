import { describe, it, expect, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { construirResumen, enviarResumenesPendientes, htmlResumen, semanaIso, tocaEnviar } from '@/lib/resumen-semanal'
import { permisosEfectivos } from '@/lib/permisos'
import { createUsuario, deleteUsuario, deleteReporte } from './helpers'

// El correo se simula: una prueba nunca debe mandar correos reales.
const enviados: { to: string; asunto: string }[] = []
vi.mock('@/lib/mail', () => ({
  sendResumenEmail: async (to: string, asunto: string) => {
    enviados.push({ to, asunto })
    return { sent: true }
  },
}))

const usuarios: number[] = []
afterEach(async () => {
  enviados.splice(0)
  for (const r of await prisma.reporte.findMany({ where: { usuarioId: { in: usuarios } }, select: { id: true } })) await deleteReporte(r.id)
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

async function cuenta(rol: 'Admin' | 'Usuario') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  return { ...usuario, permisos: permisosEfectivos(rol, []) }
}

describe('resumen semanal', () => {
  it('semana ISO y hora de envío', () => {
    expect(semanaIso(new Date(2026, 9, 24))).toBe('2026-W43') // sábado
    expect(semanaIso(new Date(2026, 0, 1))).toBe('2026-W01') // jueves
    expect(semanaIso(new Date(2027, 0, 1))).toBe('2026-W53') // viernes: aún es la última de 2026
    expect(semanaIso(new Date(2024, 11, 30))).toBe('2025-W01') // lunes: ya es la primera de 2025
    expect(tocaEnviar(new Date(2026, 9, 26, 7, 59))).toBe(false) // lunes antes de las 8
    expect(tocaEnviar(new Date(2026, 9, 26, 8, 0))).toBe(true)
    expect(tocaEnviar(new Date(2026, 9, 27, 3, 0))).toBe(true) // martes de madrugada: aún no se envió esta semana
  })

  it('un Usuario ve lo suyo y el Admin todo el sistema', async () => {
    const u = await cuenta('Usuario')
    const otro = await cuenta('Usuario')
    const admin = await cuenta('Admin')
    const hace = (h: number) => new Date(Date.now() - h * 3_600_000)
    await prisma.reporte.createMany({
      data: [
        { titulo: 'mío', descripcion: '-', usuarioId: u.id, prioridad: 'critica', createdAt: hace(2) },
        { titulo: 'mío resuelto', descripcion: '-', usuarioId: u.id, estado: 'resuelto', createdAt: hace(30), atendidoEn: hace(29.5), resueltoEn: hace(28), motivoCierre: 'falsa_alarma' },
        { titulo: 'ajeno', descripcion: '-', usuarioId: otro.id, createdAt: hace(5) },
        { titulo: 'viejo', descripcion: '-', usuarioId: u.id, estado: 'resuelto', createdAt: hace(24 * 10) },
      ],
    })

    const mio = await construirResumen(u)
    expect(mio.sistema).toBe(false)
    expect(mio.reportes).toMatchObject({ nuevos: 2, resueltos: 1, pendientes: 1, criticos: 1, vencidos: 1 })
    expect(mio.respuesta).toEqual({ acuseMin: 30, resolucionMin: 120, falsasPct: 100 })
    expect(mio.equipo).not.toBeNull() // el rol Usuario ve sus propios dispositivos

    const todo = await construirResumen(admin)
    expect(todo.sistema).toBe(true)
    expect(todo.reportes.nuevos).toBeGreaterThanOrEqual(3)
  })

  it('el HTML escapa lo que escriben los usuarios y avisa lo urgente', () => {
    const { asunto, html } = htmlResumen('<b>Ana</b>', {
      desde: new Date(2026, 9, 17),
      hasta: new Date(2026, 9, 24),
      sistema: true,
      reportes: { nuevos: 3, resueltos: 1, pendientes: 2, criticos: 1, vencidos: 1 },
      respuesta: { acuseMin: 4, resolucionMin: 90, falsasPct: 25 },
      equipo: { eventos: 10, alertas: 2, conFoto: 1, disuasiones: 1, sinDisuadir: 0, pisSinContacto: ['Pi "patio"<script>'] },
    }, 'http://localhost:3000/dashboard')
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(html).toContain('1 h 30 min')
    expect(asunto).toContain('requiere atención')
  })

  it('se envía una vez por semana a quien lo tiene activado', async () => {
    const a = await cuenta('Admin')
    const b = await cuenta('Usuario')
    await prisma.usuario.update({ where: { id: b.id }, data: { resumenSemanal: false } })
    const lunes = new Date(2026, 9, 26, 9, 0)

    await enviarResumenesPendientes('http://localhost:3000', lunes)
    expect(enviados.some((e) => e.to === a.email)).toBe(true)
    expect(enviados.some((e) => e.to === b.email)).toBe(false)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: a.id } })).resumenEnviadoSemana).toBe('2026-W44')

    enviados.splice(0)
    await enviarResumenesPendientes('http://localhost:3000', new Date(2026, 9, 28, 12, 0)) // misma semana
    expect(enviados.some((e) => e.to === a.email)).toBe(false)
  })
})

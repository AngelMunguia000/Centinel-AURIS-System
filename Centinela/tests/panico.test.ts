import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/panico/route'
import { createUsuario, deleteUsuario, deleteReporte, tokenFor } from './helpers'

// El botón de pánico era decorativo; ahora abre una incidencia crítica y avisa a los responsables.
const usuarios: number[] = []
const reportes: number[] = []
afterEach(async () => {
  for (const id of reportes.splice(0)) await deleteReporte(id)
  for (const id of usuarios.splice(0)) {
    await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
    await deleteUsuario(id)
  }
})

async function cuenta(rol: 'Usuario' | 'Operador' | 'Admin') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  return usuario
}

const pedir = (token?: string) =>
  POST(new NextRequest('http://localhost/api/panico', { method: 'POST', headers: token ? { cookie: `token=${token}` } : {} }))

describe('POST /api/panico', () => {
  it('sin sesión responde 401', async () => {
    expect((await pedir()).status).toBe(401)
  })

  it('abre una incidencia crítica y avisa a Operadores y Admin, no a quien la activó', async () => {
    const quien = await cuenta('Usuario')
    const op = await cuenta('Operador')
    const admin = await cuenta('Admin')

    const res = await pedir(await tokenFor(quien))
    expect(res.status).toBe(201)
    const { id } = await res.json()
    reportes.push(id)

    const reporte = await prisma.reporte.findUniqueOrThrow({ where: { id } })
    expect(reporte).toMatchObject({ prioridad: 'critica', estado: 'pendiente', usuarioId: quien.id })

    for (const destinatario of [op.id, admin.id]) {
      const avisos = await prisma.notificacion.findMany({ where: { destinatarioId: destinatario, reporteId: id } })
      expect(avisos).toHaveLength(1)
      expect(avisos[0].mensaje).toMatch(/^PÁNICO/)
    }
    expect(await prisma.notificacion.count({ where: { destinatarioId: quien.id, reporteId: id } })).toBe(0)
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET as getAuditoria } from '@/app/api/admin/auditoria/route'
import { PATCH, DELETE } from '@/app/api/admin/usuarios/[id]/route'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario } from './helpers'

// 06_UI_UX.md §J: trazabilidad de cuentas/roles.
const creados: number[] = []
const emailsAuditados: string[] = []

afterEach(async () => {
  for (const id of creados.splice(0)) await deleteUsuario(id)
  await prisma.auditoriaCuenta.deleteMany({ where: { objetivoEmail: { in: emailsAuditados.splice(0) } } })
})

function req(method: string, url: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {}
  if (token) headers.cookie = cookieHeader(token)
  if (body) headers['content-type'] = 'application/json'
  return new NextRequest(new URL(url), { method, headers, body: body ? JSON.stringify(body) : undefined })
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

describe('GET /api/admin/auditoria', () => {
  it('401 sin sesión', async () => {
    const res = await getAuditoria(req('GET', 'http://localhost/api/admin/auditoria'))
    expect(res.status).toBe(401)
  })

  it('403 para Operador y Usuario', async () => {
    for (const rol of ['Operador', 'Usuario'] as const) {
      const { usuario } = await createUsuario(rol)
      creados.push(usuario.id)
      const res = await getAuditoria(req('GET', 'http://localhost/api/admin/auditoria', await tokenFor(usuario)))
      expect(res.status).toBe(403)
    }
  })
})

describe('auditoría de cambios de cuenta', () => {
  it('cambio de rol registra rol anterior real y nuevo; mismo rol no registra nada', async () => {
    const { usuario: admin } = await createUsuario('Admin')
    const { usuario: objetivo } = await createUsuario('Usuario')
    creados.push(admin.id, objetivo.id)
    emailsAuditados.push(objetivo.email)
    const operador = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'Operador' } })
    const usuarioRol = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'Usuario' } })

    const token = await tokenFor(admin)
    const url = `http://localhost/api/admin/usuarios/${objetivo.id}`

    // Sin cambio real (Usuario -> Usuario): no debe generar registro.
    expect((await PATCH(req('PATCH', url, token, { rolId: usuarioRol.id }), ctx(objetivo.id))).status).toBe(200)
    expect(await prisma.auditoriaCuenta.count({ where: { objetivoEmail: objetivo.email } })).toBe(0)

    // Cambio real.
    expect((await PATCH(req('PATCH', url, token, { rolId: operador.id }), ctx(objetivo.id))).status).toBe(200)
    const registros = await prisma.auditoriaCuenta.findMany({ where: { objetivoEmail: objetivo.email } })
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({
      accion: 'cambio_rol',
      adminId: admin.id,
      adminEmail: admin.email,
      objetivoId: objetivo.id,
      valorAnterior: 'Usuario',
      valorNuevo: 'Operador',
    })

    // El Admin lo ve por la API.
    const res = await getAuditoria(req('GET', 'http://localhost/api/admin/auditoria', token))
    expect(res.status).toBe(200)
    const { registros: lista } = await res.json()
    expect(lista.some((r: { objetivoEmail: string }) => r.objetivoEmail === objetivo.email)).toBe(true)
  })

  it('el registro sobrevive a la eliminación de la cuenta objetivo', async () => {
    const { usuario: admin } = await createUsuario('Admin')
    const { usuario: objetivo } = await createUsuario('Usuario')
    creados.push(admin.id)
    emailsAuditados.push(objetivo.email)

    const res = await DELETE(
      req('DELETE', `http://localhost/api/admin/usuarios/${objetivo.id}`, await tokenFor(admin)),
      ctx(objetivo.id)
    )
    expect(res.status).toBe(200)
    expect(await prisma.usuario.findUnique({ where: { id: objetivo.id } })).toBeNull()

    const registros = await prisma.auditoriaCuenta.findMany({ where: { objetivoEmail: objetivo.email } })
    expect(registros).toHaveLength(1)
    expect(registros[0]).toMatchObject({
      accion: 'cuenta_eliminada',
      adminId: admin.id,
      valorAnterior: 'Usuario',
      valorNuevo: null,
    })
  })

  it('404 y sin registro si la cuenta no existe', async () => {
    const { usuario: admin } = await createUsuario('Admin')
    creados.push(admin.id)
    const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'Operador' } })
    const antes = await prisma.auditoriaCuenta.count()

    const patch = await PATCH(
      req('PATCH', 'http://localhost/api/admin/usuarios/99999999', await tokenFor(admin), { rolId: rol.id }),
      ctx(99999999)
    )
    const del = await DELETE(req('DELETE', 'http://localhost/api/admin/usuarios/99999999', await tokenFor(admin)), ctx(99999999))

    expect(patch.status).toBe(404)
    expect(del.status).toBe(404)
    expect(await prisma.auditoriaCuenta.count()).toBe(antes)
  })
})

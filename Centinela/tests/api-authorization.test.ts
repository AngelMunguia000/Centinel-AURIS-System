import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getUsuarios } from '@/app/api/admin/usuarios/route'
import { GET as getRoles } from '@/app/api/admin/roles/route'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario } from './helpers'

// Prioridad 3 (auditoría integral 26 ago, AUD2-15): lo que de verdad protege
// los datos es el chequeo de Rol en cada API, no la UI (requireRole ya se
// cubre en auth.test.ts como unidad — esto verifica el contrato completo
// End-to-end contra dos endpoints reales de /api/admin/*).

function requestWithToken(token?: string) {
  const headers = new Headers()
  if (token) headers.set('cookie', cookieHeader(token))
  return new NextRequest(new URL('http://localhost/api/admin/usuarios'), { headers })
}

describe('GET /api/admin/usuarios', () => {
  const cleanupIds: number[] = []
  afterEach(async () => {
    while (cleanupIds.length) await deleteUsuario(cleanupIds.pop()!)
  })

  it('401 sin autenticar', async () => {
    const res = await getUsuarios(requestWithToken())
    expect(res.status).toBe(401)
  })

  it('403 autenticado pero sin Rol Admin', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupIds.push(usuario.id)

    const res = await getUsuarios(requestWithToken(await tokenFor(usuario)))
    expect(res.status).toBe(403)
  })

  it('403 para Operador — este endpoint es exclusivo de Admin', async () => {
    const { usuario } = await createUsuario('Operador')
    cleanupIds.push(usuario.id)

    const res = await getUsuarios(requestWithToken(await tokenFor(usuario)))
    expect(res.status).toBe(403)
  })

  it('200 con Rol Admin, y devuelve la lista', async () => {
    const { usuario } = await createUsuario('Admin')
    cleanupIds.push(usuario.id)

    const res = await getUsuarios(requestWithToken(await tokenFor(usuario)))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(body.usuarios)).toBe(true)
    expect(body.usuarios.some((u: { id: number }) => u.id === usuario.id)).toBe(true)
  })
})

describe('GET /api/admin/roles', () => {
  const cleanupIds: number[] = []
  afterEach(async () => {
    while (cleanupIds.length) await deleteUsuario(cleanupIds.pop()!)
  })

  it('403 para Usuario', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupIds.push(usuario.id)

    const res = await getRoles(requestWithToken(await tokenFor(usuario)))
    expect(res.status).toBe(403)
  })

  it('200 con Rol Admin', async () => {
    const { usuario } = await createUsuario('Admin')
    cleanupIds.push(usuario.id)

    const res = await getRoles(requestWithToken(await tokenFor(usuario)))
    expect(res.status).toBe(200)
  })
})

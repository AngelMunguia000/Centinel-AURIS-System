import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { POST as login } from '@/app/api/login/route'
import { POST as login2fa } from '@/app/api/login/2fa/route'
import { POST as perfil2fa } from '@/app/api/perfil/2fa/route'
import { DELETE as quitar2fa } from '@/app/api/admin/usuarios/[id]/2fa/route'
import { codigoTotp } from '@/lib/totp'
import { resetRateLimit, getRateLimitIdentifier } from '@/lib/rate-limit'
import { createUsuario, deleteUsuario, tokenFor } from './helpers'

// Verificación en dos pasos (roadmap de funciones #8).
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) {
    await prisma.auditoriaCuenta.deleteMany({ where: { objetivoId: id } })
    await deleteUsuario(id)
  }
})

const jar = (token: string) => ({ get: (n: string) => (n === 'token' ? { value: token } : undefined) })
const json = (url: string, body: unknown, token?: string) =>
  new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { cookie: `token=${token}` } : {}) },
    body: JSON.stringify(body),
  })
const cookieDe = (res: Response) => /token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1]

async function conDosPasos() {
  const c = await createUsuario('Usuario')
  usuarios.push(c.usuario.id)
  const token = await tokenFor(c.usuario)
  const { secreto } = await (await perfil2fa(json('/api/perfil/2fa', { accion: 'iniciar' }, token))).json()
  expect((await perfil2fa(json('/api/perfil/2fa', { accion: 'activar', codigo: '000000' }, token))).status).toBe(401)
  resetRateLimit(getRateLimitIdentifier('2fa-perfil', new Request('http://localhost'), String(c.usuario.id)))
  const activado = await (await perfil2fa(json('/api/perfil/2fa', { accion: 'activar', codigo: codigoTotp(secreto) }, token))).json()
  expect(activado.codigos).toHaveLength(8)
  return { ...c, secreto, respaldo: activado.codigos as string[], token }
}

describe('verificación en dos pasos', () => {
  it('el secreto se guarda cifrado y el login pide el código antes de abrir sesión', async () => {
    const { usuario, password, secreto } = await conDosPasos()
    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })
    expect(guardado.totpSecreto).not.toContain(secreto)

    const paso1 = await login(json('/api/login', { email: usuario.email, password }))
    const { requiere2fa, desafio } = await paso1.json()
    expect(requiere2fa).toBe(true)
    expect(cookieDe(paso1)).toBeUndefined()
    // El desafío no sirve como sesión.
    expect(await getAuthenticatedUsuario(jar(desafio))).toBeNull()

    expect((await login2fa(json('/api/login/2fa', { desafio, codigo: '111111' }))).status).toBe(401)
    const paso2 = await login2fa(json('/api/login/2fa', { desafio, codigo: codigoTotp(secreto) }))
    expect(paso2.status).toBe(200)
    expect(await getAuthenticatedUsuario(jar(cookieDe(paso2)!))).not.toBeNull()

    expect((await login2fa(json('/api/login/2fa', { desafio: 'falso', codigo: codigoTotp(secreto) }))).status).toBe(400)
  })

  it('un código de respaldo sirve una sola vez', async () => {
    const { usuario, password, respaldo } = await conDosPasos()
    const { desafio } = await (await login(json('/api/login', { email: usuario.email, password }))).json()
    const ok = await login2fa(json('/api/login/2fa', { desafio, codigo: respaldo[0].toLowerCase() }))
    expect(ok.status).toBe(200)
    expect((await ok.json()).codigosRespaldoRestantes).toBe(7)
    expect((await login2fa(json('/api/login/2fa', { desafio, codigo: respaldo[0] }))).status).toBe(401)
  })

  it('un Admin la quita, queda en la auditoría y se cierran las sesiones', async () => {
    const { usuario, token } = await conDosPasos()
    const admin = await createUsuario('Admin')
    usuarios.push(admin.usuario.id)
    const res = await quitar2fa(
      new NextRequest(new URL(`/api/admin/usuarios/${usuario.id}/2fa`, 'http://localhost'), { method: 'DELETE', headers: { cookie: `token=${await tokenFor(admin.usuario)}` } }),
      { params: Promise.resolve({ id: String(usuario.id) }) }
    )
    expect(res.status).toBe(200)
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).totpSecreto).toBeNull()
    expect(await prisma.auditoriaCuenta.count({ where: { objetivoId: usuario.id, accion: 'dos_pasos_quitado' } })).toBe(1)
    expect(await getAuthenticatedUsuario(jar(token))).toBeNull()
  })

  it('desactivar exige un código válido', async () => {
    const { secreto, token } = await conDosPasos()
    expect((await perfil2fa(json('/api/perfil/2fa', { accion: 'desactivar', codigo: '123' }, token))).status).toBe(401)
    expect((await perfil2fa(json('/api/perfil/2fa', { accion: 'desactivar', codigo: codigoTotp(secreto) }, token))).status).toBe(200)
  })
})

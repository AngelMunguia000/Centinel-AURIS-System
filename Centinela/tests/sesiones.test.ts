import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUsuario, signToken } from '@/lib/auth'
import { POST as login } from '@/app/api/login/route'
import { POST as cambiarPassword } from '@/app/api/perfil/password/route'
import { GET as listar } from '@/app/api/perfil/sesiones/route'
import { DELETE as cerrarUna } from '@/app/api/perfil/sesiones/[id]/route'
import { POST as cerrarOtras } from '@/app/api/perfil/sesiones/cerrar-otras/route'
import { describirAgente } from '@/lib/sesiones'
import { createUsuario, deleteUsuario, tokenFor } from './helpers'

const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

const jar = (token: string) => ({ get: (n: string) => (n === 'token' ? { value: token } : undefined) })
const req = (url: string, token: string, init: { method?: string; body?: unknown } = {}) =>
  new NextRequest(new URL(url, 'http://localhost'), {
    method: init.method ?? 'GET',
    headers: { cookie: `token=${token}`, 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0' },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })

async function cuenta() {
  const c = await createUsuario('Usuario')
  usuarios.push(c.usuario.id)
  return c
}

describe('sesiones activas', () => {
  it('el login abre una sesión que se lista y se puede cerrar a distancia', async () => {
    const { usuario, password } = await cuenta()
    const res = await login(new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'CentinelaDesktop/0.5.0 python-httpx/0.27' },
      body: JSON.stringify({ email: usuario.email, password }),
    }))
    const tokenDesktop = /token=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1]
    const tokenWeb = await tokenFor(usuario)

    const lista = await (await listar(req('/api/perfil/sesiones', tokenWeb))).json()
    expect(lista.sesiones).toHaveLength(2)
    const desktop = lista.sesiones.find((s: { dispositivo: string }) => s.dispositivo === 'Centinela Desktop 0.5.0')
    expect(desktop.actual).toBe(false)

    expect((await cerrarUna(req(`/api/perfil/sesiones/${desktop.id}`, tokenWeb, { method: 'DELETE' }), { params: Promise.resolve({ id: desktop.id }) })).status).toBe(200)
    expect(await getAuthenticatedUsuario(jar(tokenDesktop))).toBeNull()
    expect(await getAuthenticatedUsuario(jar(tokenWeb))).not.toBeNull()
  })

  it('no cierra sesiones ajenas', async () => {
    const a = await cuenta()
    const b = await cuenta()
    const tokenB = await tokenFor(b.usuario)
    const sidB = (await prisma.sesion.findFirstOrThrow({ where: { usuarioId: b.usuario.id } })).id
    const res = await cerrarUna(req(`/api/perfil/sesiones/${sidB}`, await tokenFor(a.usuario), { method: 'DELETE' }), { params: Promise.resolve({ id: sidB }) })
    expect(res.status).toBe(404)
    expect(await getAuthenticatedUsuario(jar(tokenB))).not.toBeNull()
  })

  it('cerrar las demás y cambiar la contraseña conservan solo la actual', async () => {
    const { usuario, password } = await cuenta()
    const [t1, t2, t3] = [await tokenFor(usuario), await tokenFor(usuario), await tokenFor(usuario)]
    expect((await (await cerrarOtras(req('/api/perfil/sesiones/cerrar-otras', t1, { method: 'POST' }))).json()).cerradas).toBe(2)
    expect(await getAuthenticatedUsuario(jar(t2))).toBeNull()
    expect(await getAuthenticatedUsuario(jar(t1))).not.toBeNull()

    const t4 = await tokenFor(usuario)
    const res = await cambiarPassword(req('/api/perfil/password', t1, { method: 'POST', body: { passwordActual: password, passwordNueva: 'OtraClave123!', confirmarPassword: 'OtraClave123!' } }))
    expect(res.status).toBe(200)
    expect(await getAuthenticatedUsuario(jar(t4))).toBeNull()
    expect(await getAuthenticatedUsuario(jar(t1))).not.toBeNull()
    expect(t3).toBeTruthy()
  })

  it('rechaza un token sin sesión aunque la firma sea válida', async () => {
    const { usuario } = await cuenta()
    const viejo = signToken({ userId: usuario.id, email: usuario.email, role: 'Usuario' })
    expect(await getAuthenticatedUsuario(jar(viejo))).toBeNull()
  })

  it('describe el dispositivo', () => {
    expect(describirAgente('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1')).toBe('Safari en iPhone')
    expect(describirAgente('Mozilla/5.0 (Windows NT 10.0; Win64) AppleWebKit Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge en Windows')
    expect(describirAgente(null)).toBe("Dispositivo desconocido")
  })
})

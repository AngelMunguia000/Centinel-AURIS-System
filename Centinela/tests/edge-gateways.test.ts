import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET as getGateways, POST as postGateway } from '@/app/api/edge/gateways/route'
import { DELETE as revocarGateway } from '@/app/api/edge/gateways/[id]/route'
import { autenticarGateway, generarToken, hashToken } from '@/lib/edge/token'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario } from './helpers'

// Spec 2026-10-16-enlace-edge-design.md §5 y §7; plan Tarea 2.
const creados: number[] = []
afterEach(async () => {
  for (const id of creados.splice(0)) await deleteUsuario(id)
})

async function crear(rol: 'Usuario' | 'Operador' | 'Admin') {
  const { usuario } = await createUsuario(rol)
  creados.push(usuario.id)
  return { usuario, token: await tokenFor(usuario) }
}

function req(method: string, url: string, opts: { sesion?: string; bearer?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  if (opts.sesion) headers.cookie = cookieHeader(opts.sesion)
  if (opts.bearer !== undefined) headers.authorization = opts.bearer
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function vincular(sesion: string) {
  const res = await postGateway(req('POST', '/api/edge/gateways', { sesion, body: { nombre: 'Pi de prueba', urlBase: 'http://192.168.1.50:8000' } }))
  return { res, data: await res.json() }
}

describe('gateways edge', () => {
  it('crea gateway y devuelve el token una sola vez', async () => {
    const { token } = await crear('Usuario')
    const { res, data } = await vincular(token)
    expect(res.status).toBe(201)
    expect(typeof data.token).toBe('string')
    expect(data.token.length).toBeGreaterThanOrEqual(43)

    const lista = await (await getGateways(req('GET', '/api/edge/gateways', { sesion: token }))).json()
    expect(lista.gateways).toHaveLength(1)
    expect(lista.gateways[0]).not.toHaveProperty('token')
    expect(lista.gateways[0]).not.toHaveProperty('tokenHash')
    expect(lista.gateways[0]).toHaveProperty('ultimoContacto')
  })

  it('rechaza urlBase que no es http(s)', async () => {
    const { token } = await crear('Usuario')
    const res = await postGateway(req('POST', '/api/edge/gateways', { sesion: token, body: { nombre: 'X', urlBase: 'ftp://1.2.3.4' } }))
    expect(res.status).toBe(400)
  })

  it('autenticarGateway acepta el token correcto', async () => {
    const { token } = await crear('Usuario')
    const { data } = await vincular(token)
    const auth = await autenticarGateway(req('POST', '/api/edge/telemetria', { bearer: `Bearer ${data.token}` }))
    expect('gateway' in auth && auth.gateway.id).toBe(data.id)
  })

  it('token revocado responde 401 y no escribe', async () => {
    const { token } = await crear('Usuario')
    const { data } = await vincular(token)
    const rev = await revocarGateway(req('DELETE', `/api/edge/gateways/${data.id}`, { sesion: token }), ctx(data.id))
    expect(rev.status).toBe(200)
    const auth = await autenticarGateway(req('POST', '/api/edge/telemetria', { bearer: `Bearer ${data.token}` }))
    expect('error' in auth && auth.error.status).toBe(401)
    const gw = await prisma.gateway.findUniqueOrThrow({ where: { id: data.id } })
    expect(gw.ultimoContacto).toBeNull()
  })

  it('Bearer ausente o mal formado responde 401', async () => {
    for (const bearer of [undefined, 'Basic abc', 'Bearer ', `Bearer ${generarToken().token}`]) {
      const auth = await autenticarGateway(req('POST', '/api/edge/telemetria', { bearer }))
      expect('error' in auth && auth.error.status).toBe(401)
    }
  })

  it('hashToken es SHA-256 hex determinista', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('Usuario no puede revocar gateway ajeno (404)', async () => {
    const a = await crear('Usuario')
    const b = await crear('Usuario')
    const { data } = await vincular(a.token)
    const res = await revocarGateway(req('DELETE', `/api/edge/gateways/${data.id}`, { sesion: b.token }), ctx(data.id))
    expect(res.status).toBe(404)
    const lista = await (await getGateways(req('GET', '/api/edge/gateways', { sesion: b.token }))).json()
    expect(lista.gateways).toHaveLength(0)
  })

  it('Admin con dispositivos.otros sí puede', async () => {
    const a = await crear('Usuario')
    const admin = await crear('Admin')
    const { data } = await vincular(a.token)
    const res = await revocarGateway(req('DELETE', `/api/edge/gateways/${data.id}`, { sesion: admin.token }), ctx(data.id))
    expect(res.status).toBe(200)
  })

  it('sin sesión responde 401', async () => {
    const res = await getGateways(req('GET', '/api/edge/gateways'))
    expect(res.status).toBe(401)
  })
})

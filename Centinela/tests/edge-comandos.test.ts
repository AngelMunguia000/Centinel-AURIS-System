import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarComando } from '@/lib/edge/comandos'
import { POST as postComando } from '@/app/api/edge/nodos/[id]/comandos/route'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario } from './helpers'

// Spec 2026-10-16-enlace-edge-design.md §4.3 y §7; plan Tarea 5.
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) {
    const ds = await prisma.dispositivo.findMany({ where: { usuarioId: id }, select: { id: true } })
    await prisma.comandoDispositivo.deleteMany({ where: { dispositivoId: { in: ds.map((d) => d.id) } } })
    await deleteUsuario(id)
  }
})

let n = 0
async function nodoDe(rol: 'Usuario' | 'Admin' = 'Usuario', revocado = false) {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  const { tokenHash } = generarToken()
  const gateway = await prisma.gateway.create({
    data: { nombre: 'Pi', urlBase: 'http://pi.test:8000', tokenHash, usuarioId: usuario.id, revocadoEn: revocado ? new Date() : null },
  })
  const nodeId = `node-${(Date.now().toString(16) + (++n).toString(16)).slice(-12).padStart(12, '0')}`
  const nodo = await prisma.dispositivo.create({
    data: { nombre: nodeId, uid: nodeId, nodeId, tipo: 'sensor', usuarioId: usuario.id, gatewayId: gateway.id },
    include: { gateway: true },
  })
  return { usuario, nodo, sesion: await tokenFor(usuario), gateway }
}

const led = { tipo: 'system' as const, payload: { accion: 'led' as const, encendido: true } }

function fetchFalso(respuesta: () => Promise<Response>) {
  const llamadas: { url: string; init: RequestInit }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init })
    return respuesta()
  }) as unknown as typeof fetch
  return { impl, llamadas }
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const req = (id: number, sesion: string, body: unknown) =>
  new NextRequest(new URL(`/api/edge/nodos/${id}/comandos`, 'http://localhost'), {
    method: 'POST',
    headers: { cookie: cookieHeader(sesion), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('comandos edge', () => {
  it('ok devuelve estado ok y audita', async () => {
    const { usuario, nodo, gateway } = await nodoDe()
    const f = fetchFalso(async () => Response.json({ estado: 'ok', resultado: { led: true }, latencia_ms: 42 }))
    const r = await enviarComando({ dispositivo: { id: nodo.id, nodeId: nodo.nodeId!, gateway }, usuarioId: usuario.id, comando: led, fetchImpl: f.impl })
    expect(r.estado).toBe('ok')
    expect(r.latenciaMs).toBe(42)
    expect(f.llamadas[0].url).toBe('http://pi.test:8000/v1/comandos')
    expect(new Headers(f.llamadas[0].init.headers).get('authorization')).toBe(`Bearer ${gateway.tokenHash}`)
    const enviado = JSON.parse(String(f.llamadas[0].init.body))
    expect(enviado).toMatchObject({ v: 1, node_id: nodo.nodeId, tipo: 'system', payload: { accion: 'led', encendido: true } })
    const audit = await prisma.comandoDispositivo.findUniqueOrThrow({ where: { id: enviado.cmd_id } })
    expect(audit).toMatchObject({ estado: 'ok', usuarioId: usuario.id, dispositivoId: nodo.id, tipo: 'system', latenciaMs: 42 })
  })

  it('timeout de la Pi se reporta como pi_inaccesible', async () => {
    const { usuario, nodo, gateway } = await nodoDe()
    const f = fetchFalso(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    })
    const r = await enviarComando({ dispositivo: { id: nodo.id, nodeId: nodo.nodeId!, gateway }, usuarioId: usuario.id, comando: led, fetchImpl: f.impl })
    expect(r.estado).toBe('pi_inaccesible')
    expect(await prisma.comandoDispositivo.count({ where: { dispositivoId: nodo.id, estado: 'pi_inaccesible' } })).toBe(1)
  })

  it('respuesta de la Pi malformada se reporta como error', async () => {
    const { usuario, nodo, gateway } = await nodoDe()
    const f = fetchFalso(async () => Response.json({ hola: 'mundo' }))
    const r = await enviarComando({ dispositivo: { id: nodo.id, nodeId: nodo.nodeId!, gateway }, usuarioId: usuario.id, comando: led, fetchImpl: f.impl })
    expect(r.estado).toBe('error')
  })

  it('la Pi responde timeout del nodo y se conserva', async () => {
    const { usuario, nodo, gateway } = await nodoDe()
    const f = fetchFalso(async () => Response.json({ estado: 'timeout', latencia_ms: 3000 }))
    const r = await enviarComando({ dispositivo: { id: nodo.id, nodeId: nodo.nodeId!, gateway }, usuarioId: usuario.id, comando: led, fetchImpl: f.impl })
    expect(r.estado).toBe('timeout')
  })

  it('comando a nodo ajeno responde 404 sin auditar', async () => {
    const a = await nodoDe()
    const b = await nodoDe()
    const res = await postComando(req(a.nodo.id, b.sesion, led), ctx(a.nodo.id))
    expect(res.status).toBe(404)
    expect(await prisma.comandoDispositivo.count({ where: { dispositivoId: a.nodo.id } })).toBe(0)
  })

  it('pan 181 responde 400 antes de llamar a la Pi', async () => {
    const { nodo, sesion } = await nodoDe()
    const res = await postComando(req(nodo.id, sesion, { tipo: 'pantilt', payload: { mode: 'absolute', pan_deg: 181, tilt_deg: 0 } }), ctx(nodo.id))
    expect(res.status).toBe(400)
    expect(await prisma.comandoDispositivo.count({ where: { dispositivoId: nodo.id } })).toBe(0)
  })

  it('gateway revocado responde 409', async () => {
    const { nodo, sesion } = await nodoDe('Usuario', true)
    const res = await postComando(req(nodo.id, sesion, led), ctx(nodo.id))
    expect(res.status).toBe(409)
  })

  it('sin sesión responde 401', async () => {
    const res = await postComando(
      new NextRequest(new URL('/api/edge/nodos/1/comandos', 'http://localhost'), { method: 'POST', body: JSON.stringify(led) }),
      ctx(1),
    )
    expect(res.status).toBe(401)
  })
})

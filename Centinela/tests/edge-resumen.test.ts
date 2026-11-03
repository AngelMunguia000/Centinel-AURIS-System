import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET as getEventos } from '@/app/api/edge/eventos/route'
import { resumenEdge } from '@/lib/edge/resumen'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario } from './helpers'

// Spec 2026-10-16-enlace-edge-design.md §6.3-6.4; plan Tarea 8.
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

let n = 0
async function conEventos(rol: 'Usuario' | 'Admin' | 'Operador', severidades: string[], conexion = 'ACTIVA') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  const gateway = await prisma.gateway.create({
    data: { nombre: 'Pi', urlBase: 'http://pi:8000', tokenHash: generarToken().tokenHash, usuarioId: usuario.id, ultimoContacto: new Date() },
  })
  const nodeId = `node-${(Date.now().toString(16) + (++n).toString(16)).slice(-12).padStart(12, '0')}`
  const nodo = await prisma.dispositivo.create({
    data: { nombre: nodeId, uid: nodeId, nodeId, tipo: 'sensor', conexion, usuarioId: usuario.id, gatewayId: gateway.id },
  })
  for (const severidad of severidades) {
    await prisma.eventoDispositivo.create({
      data: { id: randomUUID(), dispositivoId: nodo.id, tipo: 'boton', severidad, ocurridoEn: new Date() },
    })
  }
  const sesion = await tokenFor(usuario)
  const auth = (await getAuthenticatedUsuario({ get: (k: string) => (k === 'token' ? { value: sesion } : undefined) }))!
  return { usuario, nodo, sesion, auth }
}

const get = (sesion?: string, query = '') =>
  getEventos(new NextRequest(new URL(`/api/edge/eventos${query}`, 'http://localhost'), { headers: sesion ? { cookie: cookieHeader(sesion) } : {} }))

describe('resumen y listado de eventos edge', () => {
  it('GET eventos solo devuelve los visibles', async () => {
    const a = await conEventos('Usuario', ['baja', 'alta'])
    const b = await conEventos('Usuario', ['media'])
    const data = await (await get(a.sesion)).json()
    expect(data.eventos.map((e: { dispositivoId: number }) => e.dispositivoId)).toEqual([a.nodo.id, a.nodo.id])
    expect(data.eventos.some((e: { dispositivoId: number }) => e.dispositivoId === b.nodo.id)).toBe(false)
    expect(data.total).toBe(2)
    expect(data.eventos[0]).toMatchObject({ dispositivoNombre: a.nodo.nombre, tipo: 'boton' })
  })

  it('GET eventos respeta limite y lo acota a 200', async () => {
    const a = await conEventos('Usuario', ['baja', 'baja', 'baja'])
    expect((await (await get(a.sesion, '?limite=2')).json()).eventos).toHaveLength(2)
    expect((await get(a.sesion, '?limite=999')).status).toBe(200)
  })

  it('GET eventos sin sesión responde 401', async () => {
    expect((await get()).status).toBe(401)
  })

  it('resumenEdge cuenta nodos en línea, eventos de hoy y altas', async () => {
    const a = await conEventos('Usuario', ['baja', 'alta', 'alta'])
    const r = await resumenEdge(a.auth)
    expect(r).toMatchObject({ nodosTotal: 1, nodosEnLinea: 1, eventosHoy: 3, altasHoy: 2 })
    expect(r.ultimosEventos).toHaveLength(3)
  })

  it('resumenEdge no cuenta un nodo desconectado como en línea', async () => {
    const a = await conEventos('Usuario', [], 'DESCONECTADO')
    const r = await resumenEdge(a.auth)
    expect(r).toMatchObject({ nodosTotal: 1, nodosEnLinea: 0 })
  })
})

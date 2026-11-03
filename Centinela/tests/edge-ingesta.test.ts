import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as postTelemetria } from '@/app/api/edge/telemetria/route'
import { POST as postEventos } from '@/app/api/edge/eventos/route'
import { generarToken } from '@/lib/edge/token'
import { suscribir, type EventoBus } from '@/lib/edge/bus'
import { createUsuario, deleteUsuario, deleteReporte } from './helpers'

// Spec 2026-10-16-enlace-edge-design.md §4.2, §6.3 y §8; plan Tarea 3.
const usuarios: number[] = []
const reportes: number[] = []
afterEach(async () => {
  for (const id of reportes.splice(0)) await deleteReporte(id)
  for (const id of usuarios.splice(0)) {
    await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
    await deleteUsuario(id)
  }
})

async function gatewayDe(rol: 'Usuario' | 'Admin' = 'Usuario') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  const { token, tokenHash } = generarToken()
  const gateway = await prisma.gateway.create({ data: { nombre: 'Pi', urlBase: 'http://pi:8000', tokenHash, usuarioId: usuario.id } })
  return { usuario, gateway, token }
}

async function operador() {
  const { usuario } = await createUsuario('Operador')
  usuarios.push(usuario.id)
  return usuario
}

const req = (url: string, token: string, body: unknown) =>
  new NextRequest(new URL(url, 'http://localhost'), {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

let n = 0
const nodo = () => `node-${(Date.now().toString(16) + (++n).toString(16)).padStart(12, '0').slice(-12)}`
const tele = { ts_ms: 1, temp_c: 41.5, rssi_dbm: -60, uptime_s: 10, heap_libre: 200000, pan_deg: 90, tilt_deg: 0 }
const caps = { led: 'real', pantilt: 'simulado', audio: 'simulado', camara: 'ausente' }
const evento = (node_id: string, extra: object = {}) => ({
  id: randomUUID(), node_id, tipo: 'boton', severidad: 'baja', ocurrido_en: new Date().toISOString(), ...extra,
})

describe('ingesta edge', () => {
  it('auto-registra un node_id nuevo bajo el dueño del gateway', async () => {
    const { usuario, gateway, token } = await gatewayDe()
    const id = nodo()
    const res = await postTelemetria(req('/api/edge/telemetria', token, { v: 1, nodos: [{ node_id: id, fw: '0.1.0', capacidades: caps, telemetria: tele }] }))
    expect(res.status).toBe(200)
    const d = await prisma.dispositivo.findUniqueOrThrow({ where: { nodeId: id } })
    expect(d.usuarioId).toBe(usuario.id)
    expect(d.gatewayId).toBe(gateway.id)
    expect(JSON.parse(d.capacidades!)).toEqual(caps)
    expect(d.variableValor).toBe('41.5 °C')
  })

  it('node_id de otro dueño responde 403 y no escribe nada', async () => {
    const a = await gatewayDe()
    const b = await gatewayDe()
    const id = nodo()
    await postTelemetria(req('/api/edge/telemetria', a.token, { v: 1, nodos: [{ node_id: id, telemetria: tele }] }))
    const intruso = nodo()
    const res = await postTelemetria(req('/api/edge/telemetria', b.token, { v: 1, nodos: [{ node_id: intruso, telemetria: tele }, { node_id: id, telemetria: { ...tele, temp_c: 99 } }] }))
    expect(res.status).toBe(403)
    expect(await prisma.dispositivo.findUnique({ where: { nodeId: intruso } })).toBeNull()
    expect((await prisma.dispositivo.findUniqueOrThrow({ where: { nodeId: id } })).variableValor).toBe('41.5 °C')
    expect((await prisma.gateway.findUniqueOrThrow({ where: { id: b.gateway.id } })).ultimoContacto).toBeNull()
  })

  it('actualiza ultimoContacto del gateway y del nodo', async () => {
    const { gateway, token } = await gatewayDe()
    const id = nodo()
    await postTelemetria(req('/api/edge/telemetria', token, { v: 1, nodos: [{ node_id: id, telemetria: tele }] }))
    expect((await prisma.gateway.findUniqueOrThrow({ where: { id: gateway.id } })).ultimoContacto).not.toBeNull()
    expect((await prisma.dispositivo.findUniqueOrThrow({ where: { nodeId: id } })).ultimoContacto).not.toBeNull()
  })

  it('un latido sin nodos también actualiza ultimoContacto', async () => {
    const { gateway, token } = await gatewayDe()
    const res = await postTelemetria(req('/api/edge/telemetria', token, { v: 1, nodos: [] }))
    expect(res.status).toBe(200)
    expect((await prisma.gateway.findUniqueOrThrow({ where: { id: gateway.id } })).ultimoContacto).not.toBeNull()
  })

  it('contrato inválido responde 400', async () => {
    const { token } = await gatewayDe()
    const res = await postTelemetria(req('/api/edge/telemetria', token, { v: 2, nodos: [] }))
    expect(res.status).toBe(400)
  })

  it('eventos repetidos no duplican Reporte ni notificaciones', async () => {
    const op = await operador()
    const { usuario, token } = await gatewayDe()
    const id = nodo()
    const lote = { v: 1, eventos: [evento(id, { severidad: 'alta' })] }
    expect((await postEventos(req('/api/edge/eventos', token, lote))).status).toBe(200)
    expect((await postEventos(req('/api/edge/eventos', token, lote))).status).toBe(200)
    const rs = await prisma.reporte.findMany({ where: { usuarioId: usuario.id } })
    reportes.push(...rs.map((r) => r.id))
    expect(rs).toHaveLength(1)
    expect(await prisma.notificacion.count({ where: { destinatarioId: op.id, reporteId: rs[0].id } })).toBe(1)
    expect(await prisma.eventoDispositivo.count({ where: { id: lote.eventos[0].id } })).toBe(1)
  })

  it('conexion offline notifica sin crear Reporte', async () => {
    const op = await operador()
    const { usuario, token } = await gatewayDe()
    const id = nodo()
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(id, { tipo: 'conexion', severidad: 'media', detalle: 'offline' })] }))
    expect(await prisma.reporte.count({ where: { usuarioId: usuario.id } })).toBe(0)
    expect((await prisma.dispositivo.findUniqueOrThrow({ where: { nodeId: id } })).conexion).toBe('DESCONECTADO')
    expect(await prisma.notificacion.count({ where: { destinatarioId: op.id, reporteId: null } })).toBeGreaterThanOrEqual(1)
  })

  it('conexion online deja el nodo ACTIVA', async () => {
    const { token } = await gatewayDe()
    const id = nodo()
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(id, { tipo: 'conexion', detalle: 'online' })] }))
    expect((await prisma.dispositivo.findUniqueOrThrow({ where: { nodeId: id } })).conexion).toBe('ACTIVA')
  })

  it('severidad alta crea Reporte y notifica a Operadores', async () => {
    const op = await operador()
    const { usuario, token } = await gatewayDe()
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(nodo(), { severidad: 'alta', tipo: 'sobrecorriente' })] }))
    const r = await prisma.reporte.findFirstOrThrow({ where: { usuarioId: usuario.id } })
    reportes.push(r.id)
    expect(r.prioridad).toBe('alta')
    expect(r.categoria).toBe('Hardware')
    expect(r.titulo).toContain('sobrecorriente')
    expect(await prisma.notificacion.count({ where: { destinatarioId: op.id, reporteId: r.id } })).toBe(1)
  })

  it('desarmada: guarda el evento sin abrir Reporte ni avisar, salvo pánico; el latido lo informa', async () => {
    const op = await operador()
    const { usuario, gateway, token } = await gatewayDe()
    await prisma.gateway.update({ where: { id: gateway.id }, data: { modoArmado: 'desarmado' } })
    const id = nodo()
    const mov = evento(id, { severidad: 'alta', tipo: 'movimiento' })
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [mov] }))
    expect(await prisma.eventoDispositivo.count({ where: { id: mov.id } })).toBe(1)
    expect(await prisma.reporte.count({ where: { usuarioId: usuario.id } })).toBe(0)
    expect(await prisma.notificacion.count({ where: { destinatarioId: op.id } })).toBe(0)

    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(id, { severidad: 'alta', tipo: 'panico' })] }))
    const r = await prisma.reporte.findFirstOrThrow({ where: { usuarioId: usuario.id } })
    reportes.push(r.id)
    expect(r.titulo).toContain('panico')

    const res = await postTelemetria(req('/api/edge/telemetria', token, { v: 1, nodos: [{ node_id: id, telemetria: { v: 1, ...tele }, capacidades: caps }] }))
    expect(await res.json()).toMatchObject({ ok: true, armado: false })
  })

  it('disuasión estructurada: la decisión y su resultado; un nodo no toca la de otro', async () => {
    const { token } = await gatewayDe()
    const [a, b] = [nodo(), nodo()]
    const dis = evento(a, { tipo: 'disuasion', detalle: 'Ráfaga tone_am de 2.4 s', datos: { ejecutada: true, patron: 'tone_am', duracion_ms: 2400, ganancia: 0.8 } })
    const sinDisuadir = evento(a, { tipo: 'disuasion', datos: { ejecutada: false, motivo: 'el lugar está desarmado' } })
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [dis, sinDisuadir] }))
    expect(await prisma.disuasion.findUniqueOrThrow({ where: { id: dis.id } })).toMatchObject({ ejecutada: true, patron: 'tone_am', duracionMs: 2400, exito: null })
    expect(await prisma.disuasion.findUniqueOrThrow({ where: { id: sinDisuadir.id } })).toMatchObject({ ejecutada: false, motivo: 'el lugar está desarmado' })

    // El resultado de otro nodo con el mismo id no aplica.
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(b, { tipo: 'disuasion_resultado', datos: { disuasion_id: dis.id, exito: false } })] }))
    expect((await prisma.disuasion.findUniqueOrThrow({ where: { id: dis.id } })).exito).toBeNull()
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(a, { tipo: 'disuasion_resultado', datos: { disuasion_id: dis.id, exito: true } })] }))
    expect(await prisma.disuasion.findUniqueOrThrow({ where: { id: dis.id } })).toMatchObject({ exito: true })
  })

  it('publica en el bus', async () => {
    const { token } = await gatewayDe()
    const recibidos: EventoBus[] = []
    const cancelar = suscribir((e) => recibidos.push(e))
    const id = nodo()
    await postTelemetria(req('/api/edge/telemetria', token, { v: 1, nodos: [{ node_id: id, telemetria: tele }] }))
    await postEventos(req('/api/edge/eventos', token, { v: 1, eventos: [evento(id)] }))
    cancelar()
    expect(recibidos.map((e) => e.tipo)).toEqual(['dispositivo.telemetria', 'evento.nuevo'])
  })
})

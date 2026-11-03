import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as postEvento } from '@/app/api/prototipo/evento/route'
import { PUT as putEstado } from '@/app/api/prototipo/estado/route'
import { DELETE as deleteDatos } from '@/app/api/prototipo/datos/route'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario, deleteReporte } from './helpers'
import { PREFIJO_SIMULADO, uidDispositivoSimulado } from '@/lib/prototipo/eventos'
import { LIMITE_EVENTOS_15MIN, LIMITE_REPORTES_SIMULADOS } from '@/lib/prototipo/servidor'

function req(metodo: string, ruta: string, token?: string, body?: unknown) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (token) headers.set('cookie', cookieHeader(token))
  return new NextRequest(new URL(`http://localhost${ruta}`), {
    method: metodo,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const usuariosCreados: number[] = []

async function nuevo(rol: 'Admin' | 'Operador' | 'Usuario') {
  const { usuario } = await createUsuario(rol)
  usuariosCreados.push(usuario.id)
  return { usuario, token: await tokenFor(usuario) }
}

async function limpiarUsuario(id: number) {
  const reportes = await prisma.reporte.findMany({ where: { usuarioId: id }, select: { id: true } })
  for (const r of reportes) await deleteReporte(r.id)
  await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
  await prisma.dispositivo.deleteMany({ where: { usuarioId: id } })
  await deleteUsuario(id)
}

afterEach(async () => {
  while (usuariosCreados.length) await limpiarUsuario(usuariosCreados.pop()!)
})

const evento = (token: string | undefined, codigo: unknown = 'sobrecorriente') =>
  postEvento(req('POST', '/api/prototipo/evento', token, { codigo, estadoFsm: 'SAFE_MUTE' }))

describe('autorización', () => {
  it('401 sin sesión en los tres endpoints', async () => {
    expect((await evento(undefined)).status).toBe(401)
    expect((await putEstado(req('PUT', '/api/prototipo/estado', undefined, { conexion: 'ESTABLE', estadoFsm: 'IDLE' }))).status).toBe(401)
    expect((await deleteDatos(req('DELETE', '/api/prototipo/datos'))).status).toBe(401)
  })
  it.each(['Usuario', 'Operador'] as const)('403 para %s en los tres endpoints', async (rol) => {
    const { token } = await nuevo(rol)
    expect((await evento(token)).status).toBe(403)
    expect((await putEstado(req('PUT', '/api/prototipo/estado', token, { conexion: 'ESTABLE', estadoFsm: 'IDLE' }))).status).toBe(403)
    expect((await deleteDatos(req('DELETE', '/api/prototipo/datos', token))).status).toBe(403)
  })
})

describe('POST /api/prototipo/evento', () => {
  it.each([
    ['persistencia_objetivo', 'alta'],
    ['broker_caido', 'media'],
    ['sobrecorriente', 'alta'],
    ['fault', 'critica'],
  ])('%s crea un Reporte prioridad %s con el prefijo garantizado, a nombre del Admin y sin asignar', async (codigo, prioridad) => {
    const { usuario, token } = await nuevo('Admin')
    const res = await evento(token, codigo)
    expect(res.status).toBe(201)
    const { reporteId } = await res.json()
    const reporte = await prisma.reporte.findUniqueOrThrow({ where: { id: reporteId } })
    expect(reporte.titulo.startsWith(`${PREFIJO_SIMULADO} `)).toBe(true)
    expect(reporte.prioridad).toBe(prioridad)
    expect(reporte.usuarioId).toBe(usuario.id)
    expect(reporte.operadorAsignadoId).toBeNull()
  })
  it('notifica a cada Operador', async () => {
    const op1 = await nuevo('Operador')
    const op2 = await nuevo('Operador')
    const { token } = await nuevo('Admin')
    const { reporteId } = await (await evento(token)).json()
    const n = await prisma.notificacion.count({
      where: { reporteId, destinatarioId: { in: [op1.usuario.id, op2.usuario.id] } },
    })
    expect(n).toBe(2)
  })
  it('400 con un código fuera de la lista cerrada', async () => {
    const { token } = await nuevo('Admin')
    expect((await evento(token, 'drop_table')).status).toBe(400)
  })
  it('400 con un estadoFsm inválido', async () => {
    const { token } = await nuevo('Admin')
    const res = await postEvento(req('POST', '/api/prototipo/evento', token, { codigo: 'fault', estadoFsm: 'no valido!' }))
    expect(res.status).toBe(400)
  })
  it('409 al llegar al tope de reportes simulados pendientes', async () => {
    const { usuario, token } = await nuevo('Admin')
    for (let i = 0; i < LIMITE_REPORTES_SIMULADOS; i++) {
      await prisma.reporte.create({
        data: { titulo: `${PREFIJO_SIMULADO} relleno ${i}`, descripcion: 'x', usuarioId: usuario.id },
      })
    }
    expect((await evento(token)).status).toBe(409)
  })
  it('429 al superar el límite de eventos por ventana', async () => {
    const { token } = await nuevo('Admin')
    for (let i = 0; i < LIMITE_EVENTOS_15MIN; i++) expect((await evento(token)).status).toBe(201)
    expect((await evento(token)).status).toBe(429)
  })
})

describe('PUT /api/prototipo/estado', () => {
  it('crea el Dispositivo SIM-CENTINEL-<id> (tipo camara) y luego lo actualiza', async () => {
    const { usuario, token } = await nuevo('Admin')
    const put = (conexion: string, estadoFsm: string) =>
      putEstado(req('PUT', '/api/prototipo/estado', token, { conexion, estadoFsm }))
    expect((await put('ESTABLE', 'IDLE')).status).toBe(200)
    expect((await put('ACTIVA', 'DETERRING')).status).toBe(200)
    const d = await prisma.dispositivo.findMany({ where: { usuarioId: usuario.id } })
    expect(d).toHaveLength(1)
    expect(d[0].uid).toBe(uidDispositivoSimulado(usuario.id))
    expect(d[0].tipo).toBe('camara')
    expect(d[0].conexion).toBe('ACTIVA')
    expect(d[0].variableValor).toBe('DETERRING')
  })
  it('dos Admin no chocan en el uid', async () => {
    const a = await nuevo('Admin')
    const b = await nuevo('Admin')
    for (const x of [a, b]) {
      const res = await putEstado(req('PUT', '/api/prototipo/estado', x.token, { conexion: 'ESTABLE', estadoFsm: 'IDLE' }))
      expect(res.status).toBe(200)
    }
    expect(await prisma.dispositivo.count({ where: { usuarioId: { in: [a.usuario.id, b.usuario.id] } } })).toBe(2)
  })
  it('400 con una conexión inválida', async () => {
    const { token } = await nuevo('Admin')
    const res = await putEstado(req('PUT', '/api/prototipo/estado', token, { conexion: 'X', estadoFsm: 'IDLE' }))
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/prototipo/datos', () => {
  it('borra solo lo simulado creado por un Admin y sus dependientes', async () => {
    const op = await nuevo('Operador')
    const admin = await nuevo('Admin')
    const comun = await nuevo('Usuario')

    const { reporteId: simulado } = await (await evento(admin.token)).json()
    const propioReal = await prisma.reporte.create({
      data: { titulo: 'Reporte real del admin', descripcion: 'x', usuarioId: admin.usuario.id },
    })
    const deUsuario = await prisma.reporte.create({
      data: { titulo: `${PREFIJO_SIMULADO} lo escribió un usuario común`, descripcion: 'x', usuarioId: comun.usuario.id },
    })
    await putEstado(req('PUT', '/api/prototipo/estado', admin.token, { conexion: 'ESTABLE', estadoFsm: 'IDLE' }))
    const dispositivoAjeno = await prisma.dispositivo.create({
      data: { nombre: 'ajeno', uid: `SIM-VITEST-${Date.now()}`, tipo: 'sensor', usuarioId: comun.usuario.id },
    })

    const res = await deleteDatos(req('DELETE', '/api/prototipo/datos', admin.token))
    expect(res.status).toBe(200)
    expect((await res.json()).reportesEliminados).toBe(1)

    expect(await prisma.reporte.findUnique({ where: { id: simulado } })).toBeNull()
    expect(await prisma.notificacion.count({ where: { reporteId: simulado, destinatarioId: op.usuario.id } })).toBe(0)
    expect(await prisma.reporte.findUnique({ where: { id: propioReal.id } })).not.toBeNull()
    expect(await prisma.reporte.findUnique({ where: { id: deUsuario.id } })).not.toBeNull()
    expect(await prisma.dispositivo.count({ where: { usuarioId: admin.usuario.id } })).toBe(0)
    expect(await prisma.dispositivo.findUnique({ where: { id: dispositivoAjeno.id } })).not.toBeNull()
  })
})

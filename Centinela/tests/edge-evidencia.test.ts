import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as postEventos } from '@/app/api/edge/eventos/route'
import { PUT as subirEvidencia } from '@/app/api/edge/evidencia/[eventoId]/route'
import { GET as verEvidencia } from '@/app/api/evidencia/[eventoId]/route'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, deleteUsuario, deleteReporte, tokenFor } from './helpers'

// Evidencia: cámara del nodo → Pi → web (lib/edge/evidencia.ts).
beforeAll(() => {
  process.env.EVIDENCIAS_DIR = mkdtempSync(path.join(tmpdir(), 'evidencias-'))
})
const usuarios: number[] = []
afterEach(async () => {
  for (const r of await prisma.reporte.findMany({ where: { usuarioId: { in: usuarios } }, select: { id: true } })) await deleteReporte(r.id)
  for (const id of usuarios.splice(0)) {
    await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
    await deleteUsuario(id)
  }
})

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
let n = 0
const nodo = () => `node-${(Date.now().toString(16) + (++n).toString(16)).padStart(12, '0').slice(-12)}`

async function piCon(rol: 'Usuario' | 'Admin' = 'Usuario') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  const { token, tokenHash } = generarToken()
  await prisma.gateway.create({ data: { nombre: 'Pi', urlBase: 'http://pi:8000', tokenHash, usuarioId: usuario.id } })
  return { usuario, token }
}

async function eventoDe(token: string, extra: object = {}) {
  const id = randomUUID()
  const lote = { v: 1, eventos: [{ id, node_id: nodo(), tipo: 'movimiento', severidad: 'alta', detalle: 'Movimiento detectado por la cámara', ocurrido_en: new Date().toISOString(), ...extra }] }
  await postEventos(new NextRequest(new URL('/api/edge/eventos', 'http://localhost'), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(lote) }))
  return id
}

const subir = (token: string, id: string, cuerpo: Uint8Array = JPEG, tipo = 'image/jpeg') =>
  subirEvidencia(
    new NextRequest(new URL(`/api/edge/evidencia/${id}`, 'http://localhost'), { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': tipo }, body: Buffer.from(cuerpo) }),
    { params: Promise.resolve({ eventoId: id }) }
  )
const ver = async (usuario: { id: number; email: string; rol: { nombre: string } }, id: string) =>
  verEvidencia(new NextRequest(new URL(`/api/evidencia/${id}`, 'http://localhost'), { headers: { cookie: `token=${await tokenFor(usuario)}` } }), { params: Promise.resolve({ eventoId: id }) })

describe('evidencia de la cámara', () => {
  it('la Pi sube la foto de su evento, el reporte la enlaza y el dueño la ve', async () => {
    const { usuario, token } = await piCon()
    const id = await eventoDe(token)
    expect((await subir(token, id)).status).toBe(200)
    expect((await prisma.eventoDispositivo.findUniqueOrThrow({ where: { id } })).evidencia).toBe(`${id}.jpg`)
    const reporte = await prisma.reporte.findFirstOrThrow({ where: { usuarioId: usuario.id } })
    expect(reporte.eventoId).toBe(id)

    const res = await ver(usuario, id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG)
  })

  it('404 mientras el evento no llega, y para el evento de otra Pi', async () => {
    const a = await piCon()
    const b = await piCon()
    expect((await subir(a.token, randomUUID())).status).toBe(404)
    const deB = await eventoDe(b.token)
    expect((await subir(a.token, deB)).status).toBe(404)
  })

  it('rechaza lo que no es JPEG, ids raros y otros tipos', async () => {
    const { token } = await piCon()
    const id = await eventoDe(token)
    expect((await subir(token, id, new Uint8Array([1, 2, 3, 4, 5]))).status).toBe(400)
    expect((await subir(token, id, JPEG, 'image/png')).status).toBe(415)
    expect((await subir(token, '../../etc/passwd')).status).toBe(400)
  })

  it('otra cuenta Usuario no la ve; quien atiende reportes sí', async () => {
    const { token } = await piCon()
    const id = await eventoDe(token)
    await subir(token, id)
    const otro = await createUsuario('Usuario')
    usuarios.push(otro.usuario.id)
    expect((await ver(otro.usuario, id)).status).toBe(404)
    const op = await createUsuario('Operador')
    usuarios.push(op.usuario.id)
    expect((await ver(op.usuario, id)).status).toBe(200)
  })
})

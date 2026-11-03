import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GET as getRevision } from '@/app/api/vision/revision/route'
import { PATCH as patchRevision } from '@/app/api/vision/revision/[eventoId]/route'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario, setExcepcion } from './helpers'

// Revisión de visión (lib/edge/revision.ts, 2026-10-30): permiso, alcance por cuenta y marcas válidas.
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

let n = 0
async function conCamara(conPermiso: boolean) {
  const { usuario } = await createUsuario('Usuario')
  usuarios.push(usuario.id)
  if (conPermiso) await setExcepcion(usuario.id, 'vision.revisar', true)
  const gateway = await prisma.gateway.create({
    data: { nombre: 'Pi', urlBase: 'http://pi:8000', tokenHash: generarToken().tokenHash, usuarioId: usuario.id, ultimoContacto: new Date() },
  })
  const nodeId = `node-${(Date.now().toString(16) + (++n).toString(16)).slice(-12).padStart(12, '0')}`
  const nodo = await prisma.dispositivo.create({
    data: { nombre: nodeId, uid: nodeId, nodeId, tipo: 'sensor', conexion: 'ACTIVA', usuarioId: usuario.id, gatewayId: gateway.id },
  })
  const evento = async (tipo: string, evidencia: string | null) =>
    (await prisma.eventoDispositivo.create({ data: { id: randomUUID(), dispositivoId: nodo.id, tipo, severidad: 'alta', ocurridoEn: new Date(), evidencia } })).id
  const ids = {
    deteccion: await evento('deteccion', 'x.jpg'),
    movimiento: await evento('movimiento', 'x.jpg'),
    sinFoto: await evento('deteccion', null),
    boton: await evento('boton', 'x.jpg'),
  }
  return { sesion: await tokenFor(usuario), ids }
}

const get = (sesion: string) => getRevision(new NextRequest(new URL('/api/vision/revision', 'http://localhost'), { headers: { cookie: cookieHeader(sesion) } }))
const patch = (sesion: string, eventoId: string, revision: unknown) =>
  patchRevision(
    new NextRequest(new URL(`/api/vision/revision/${eventoId}`, 'http://localhost'), {
      method: 'PATCH',
      headers: { cookie: cookieHeader(sesion), 'content-type': 'application/json' },
      body: JSON.stringify({ revision }),
    }),
    { params: Promise.resolve({ eventoId }) },
  )

describe('API de revisión de visión', () => {
  it('sin el permiso vision.revisar: 403', async () => {
    const { sesion, ids } = await conCamara(false)
    expect((await get(sesion)).status).toBe(403)
    expect((await patch(sesion, ids.deteccion, 'objetivo')).status).toBe(403)
  })

  it('lista solo fotos de cámara propias y mide con cada marca', async () => {
    const { sesion, ids } = await conCamara(true)
    const antes = await (await get(sesion)).json()
    expect(antes.fotos.map((f: { id: string }) => f.id).sort()).toEqual([ids.deteccion, ids.movimiento].sort())
    expect(antes.pendientes).toBe(2)

    expect((await patch(sesion, ids.deteccion, 'objetivo')).status).toBe(200)
    expect((await patch(sesion, ids.movimiento, 'objetivo')).status).toBe(200) // un ave que el modelo no vio
    const despues = await (await get(sesion)).json()
    expect(despues.metricas).toMatchObject({ aciertos: 1, escapadas: 1, precision: 100, sensibilidad: 50 })
    expect(despues.pendientes).toBe(0)

    expect((await patch(sesion, ids.deteccion, null)).status).toBe(200) // desmarcar
    expect((await (await get(sesion)).json()).pendientes).toBe(1)
  })

  it('rechaza marcas inválidas, eventos que no son de cámara y eventos ajenos', async () => {
    const { sesion, ids } = await conCamara(true)
    const otro = await conCamara(true)
    expect((await patch(sesion, ids.deteccion, 'quizas')).status).toBe(400)
    expect((await patch(sesion, ids.boton, 'objetivo')).status).toBe(404)
    expect((await patch(sesion, ids.sinFoto, 'objetivo')).status).toBe(404)
    expect((await patch(sesion, otro.ids.deteccion, 'objetivo')).status).toBe(404)
    expect((await prisma.eventoDispositivo.findUnique({ where: { id: otro.ids.deteccion } }))?.revision).toBeNull()
  })
})

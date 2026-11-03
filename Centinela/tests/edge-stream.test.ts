import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estadoDerivado, visiblePara, snapshotPara } from '@/lib/edge/estado'
import { GET as getStream } from '@/app/api/stream/route'
import { getAuthenticatedUsuario } from '@/lib/auth'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, tokenFor, deleteUsuario } from './helpers'

// Spec 2026-10-16-enlace-edge-design.md §4.4 y §8; plan Tarea 4.
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) await deleteUsuario(id)
})

const ahora = new Date('2026-10-16T12:00:00.000Z')
const hace = (ms: number) => new Date(ahora.getTime() - ms)

function jar(token: string) {
  return { get: (name: string) => (name === 'token' ? { value: token } : undefined) }
}

async function usuarioConNodo(rol: 'Usuario' | 'Admin' = 'Usuario') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  const gateway = await prisma.gateway.create({
    data: { nombre: 'Pi', urlBase: 'http://pi:8000', tokenHash: generarToken().tokenHash, usuarioId: usuario.id, ultimoContacto: new Date() },
  })
  const nodeId = `node-${(Date.now().toString(16) + usuario.id.toString(16)).slice(-12).padStart(12, '0')}`
  const nodo = await prisma.dispositivo.create({
    data: { nombre: nodeId, uid: nodeId, nodeId, tipo: 'sensor', conexion: 'ACTIVA', usuarioId: usuario.id, gatewayId: gateway.id },
  })
  const auth = (await getAuthenticatedUsuario(jar(await tokenFor(usuario))))!
  return { usuario, auth, nodo, token: await tokenFor(usuario) }
}

describe('estado y stream edge', () => {
  it('estadoDerivado marca sin_contacto tras 10 s', () => {
    expect(estadoDerivado({ conexion: 'ACTIVA', gateway: { ultimoContacto: hace(9_999) } }, ahora)).toBe('en_linea')
    expect(estadoDerivado({ conexion: 'ACTIVA', gateway: { ultimoContacto: hace(10_001) } }, ahora)).toBe('sin_contacto')
    expect(estadoDerivado({ conexion: 'ACTIVA', gateway: { ultimoContacto: null } }, ahora)).toBe('sin_contacto')
    expect(estadoDerivado({ conexion: 'ACTIVA', gateway: null }, ahora)).toBe('sin_contacto')
  })

  it('estadoDerivado respeta DESCONECTADO con gateway vivo', () => {
    expect(estadoDerivado({ conexion: 'DESCONECTADO', gateway: { ultimoContacto: hace(1_000) } }, ahora)).toBe('desconectado')
  })

  it('visiblePara: dueño sí, ajeno no, dispositivos.otros sí', () => {
    const propio = { id: 1, permisos: new Set(['dispositivos.propios']) }
    const admin = { id: 2, permisos: new Set(['dispositivos.propios', 'dispositivos.otros']) }
    expect(visiblePara(propio, 1)).toBe(true)
    expect(visiblePara(propio, 3)).toBe(false)
    expect(visiblePara(admin, 3)).toBe(true)
  })

  it('snapshotPara solo devuelve nodos propios a un Usuario', async () => {
    const a = await usuarioConNodo()
    const b = await usuarioConNodo()
    const snap = await snapshotPara(a.auth)
    expect(snap.map((n) => n.id)).toContain(a.nodo.id)
    expect(snap.map((n) => n.id)).not.toContain(b.nodo.id)
    expect(snap.find((n) => n.id === a.nodo.id)!.estado).toBe('en_linea')
  })

  it('snapshotPara con dispositivos.otros ve los de otros', async () => {
    const a = await usuarioConNodo()
    const admin = await usuarioConNodo('Admin')
    const snap = await snapshotPara(admin.auth)
    expect(snap.map((n) => n.id)).toContain(a.nodo.id)
  })

  it('stream responde 401 sin sesión', async () => {
    const res = await getStream(new NextRequest(new URL('/api/stream', 'http://localhost')))
    expect(res.status).toBe(401)
  })

  it('stream manda un snapshot inicial', async () => {
    const a = await usuarioConNodo()
    const control = new AbortController()
    const res = await getStream(
      new NextRequest(new URL('/api/stream', 'http://localhost'), { headers: { cookie: `token=${a.token}` }, signal: control.signal }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const lector = res.body!.getReader()
    const { value } = await lector.read()
    control.abort()
    const texto = new TextDecoder().decode(value)
    expect(texto.startsWith('event: snapshot\ndata: ')).toBe(true)
    expect(texto).toContain(a.nodo.nodeId!)
  })
})

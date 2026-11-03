import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST as postTelemetria } from '@/app/api/edge/telemetria/route'
import { avisarGatewaysCaidos, CAIDA_MS } from '@/lib/edge/vigilancia'
import { generarToken } from '@/lib/edge/token'
import { createUsuario, deleteUsuario } from './helpers'

// Aviso de "la Raspberry Pi dejó de responder": sin esto, una Pi desenchufada solo
// se nota si alguien tiene el Monitor abierto.
const usuarios: number[] = []
afterEach(async () => {
  for (const id of usuarios.splice(0)) {
    await prisma.notificacion.deleteMany({ where: { destinatarioId: id } })
    await prisma.gateway.deleteMany({ where: { usuarioId: id } })
    await deleteUsuario(id)
  }
})

async function cuenta(rol: 'Usuario' | 'Operador') {
  const { usuario } = await createUsuario(rol)
  usuarios.push(usuario.id)
  return usuario
}

async function gatewayCon(ultimoContacto: Date | null) {
  const dueno = await cuenta('Usuario')
  const { token, tokenHash } = generarToken()
  const gateway = await prisma.gateway.create({
    data: { nombre: 'Pi cochera', urlBase: 'http://pi:8000', tokenHash, usuarioId: dueno.id, ultimoContacto },
  })
  return { dueno, gateway, token }
}

const avisosDe = (id: number) => prisma.notificacion.findMany({ where: { destinatarioId: id } })
const hace = (ms: number) => new Date(Date.now() - ms)

describe('vigilancia de gateways', () => {
  it('avisa una sola vez al dueño y a los Operadores cuando la Pi deja de responder', async () => {
    const { dueno } = await gatewayCon(hace(CAIDA_MS + 5_000))
    const op = await cuenta('Operador')

    await avisarGatewaysCaidos()
    await avisarGatewaysCaidos()

    for (const id of [dueno.id, op.id]) {
      const avisos = (await avisosDe(id)).filter((n) => n.mensaje.includes('Pi cochera'))
      expect(avisos).toHaveLength(1)
      expect(avisos[0].mensaje).toMatch(/no responde/)
    }
  })

  it('no avisa por un corte breve, ni por una Pi que nunca se conectó o está revocada', async () => {
    const breve = await gatewayCon(hace(CAIDA_MS - 5_000))
    const nunca = await gatewayCon(null)
    const revocada = await gatewayCon(hace(CAIDA_MS * 10))
    await prisma.gateway.update({ where: { id: revocada.gateway.id }, data: { revocadoEn: new Date() } })

    await avisarGatewaysCaidos()

    for (const g of [breve, nunca, revocada]) expect(await avisosDe(g.dueno.id)).toHaveLength(0)
  })

  it('avisa que volvió cuando la Pi manda telemetría otra vez, y puede volver a avisar si cae', async () => {
    const { dueno, gateway, token } = await gatewayCon(hace(CAIDA_MS + 5_000))
    await avisarGatewaysCaidos()

    const res = await postTelemetria(
      new NextRequest(new URL('/api/edge/telemetria', 'http://localhost'), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ v: 1, nodos: [] }),
      }),
    )
    expect(res.status).toBe(200)

    const mensajes = (await avisosDe(dueno.id)).map((n) => n.mensaje)
    expect(mensajes.some((m) => /volvió/.test(m))).toBe(true)
    const g = await prisma.gateway.findUniqueOrThrow({ where: { id: gateway.id } })
    expect(g.avisoSinContactoEn).toBeNull()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { getAuthenticatedUsuario, requireRole, signToken } from '@/lib/auth'
import { resolveOAuthSignIn } from '@/lib/oauth-signin'
import { prisma } from '@/lib/prisma'
import { createUsuario, tokenFor, deleteUsuario } from './helpers'

// Prioridad 1 (auditoría integral 26 ago, AUD2-15): puerta de entrada a todo
// lo demás. Cubre lib/auth.ts (JWT propio) y resolveOAuthSignIn (auth.ts raíz).

function cookieJar(token?: string) {
  return {
    get: (name: string) => (name === 'token' && token !== undefined ? { value: token } : undefined),
  }
}

describe('getAuthenticatedUsuario', () => {
  const cleanupIds: number[] = []
  afterEach(async () => {
    while (cleanupIds.length) await deleteUsuario(cleanupIds.pop()!)
  })

  it('devuelve null sin cookie de token', async () => {
    expect(await getAuthenticatedUsuario(cookieJar())).toBeNull()
  })

  it('devuelve null con un token inválido/corrupto', async () => {
    expect(await getAuthenticatedUsuario(cookieJar('esto-no-es-un-jwt'))).toBeNull()
  })

  it('devuelve el usuario y su rol con un token válido', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupIds.push(usuario.id)
    const token = await tokenFor(usuario)

    const result = await getAuthenticatedUsuario(cookieJar(token))

    expect(result?.id).toBe(usuario.id)
    expect(result?.email).toBe(usuario.email)
    expect(result?.rol.nombre).toBe('Usuario')
  })

  it('devuelve null si el token es válido pero la Cuenta ya no existe', async () => {
    const { usuario } = await createUsuario('Usuario')
    const token = await tokenFor(usuario)
    await deleteUsuario(usuario.id)

    expect(await getAuthenticatedUsuario(cookieJar(token))).toBeNull()
  })

  it('falla cerrado (no lanza) con un token firmado con otro secreto', async () => {
    const foreignToken = signToken(
      { userId: 999999, email: 'x@x.com', role: 'Admin' },
      '1h'
    )
    // Firmado con el mismo JWT_SECRET del proceso pero para un userId
    // inexistente — equivalente al caso de Cuenta borrada de arriba, pero
    // vía un id que nunca existió.
    expect(await getAuthenticatedUsuario(cookieJar(foreignToken))).toBeNull()
  })
})

describe('requireRole', () => {
  const cleanupIds: number[] = []
  afterEach(async () => {
    while (cleanupIds.length) await deleteUsuario(cleanupIds.pop()!)
  })

  it('no_autenticado sin token', async () => {
    const result = await requireRole(cookieJar(), ['Admin'])
    expect(result.authorized).toBe(false)
    if (!result.authorized) expect(result.reason).toBe('no_autenticado')
  })

  it('no_autorizado cuando el Rol no está en la lista permitida', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupIds.push(usuario.id)
    const token = await tokenFor(usuario)

    const result = await requireRole(cookieJar(token), ['Admin', 'Operador'])
    expect(result.authorized).toBe(false)
    if (!result.authorized) expect(result.reason).toBe('no_autorizado')
  })

  it('autoriza cuando el Rol está en la lista permitida', async () => {
    const { usuario } = await createUsuario('Operador')
    cleanupIds.push(usuario.id)
    const token = await tokenFor(usuario)

    const result = await requireRole(cookieJar(token), ['Admin', 'Operador'])
    expect(result.authorized).toBe(true)
    if (result.authorized) expect(result.usuario.id).toBe(usuario.id)
  })
})

describe('resolveOAuthSignIn', () => {
  const cleanupIds: number[] = []
  afterEach(async () => {
    while (cleanupIds.length) await deleteUsuario(cleanupIds.pop()!)
  })

  it('crea una Cuenta nueva (Rol Usuario, sin password) para un correo nunca visto', async () => {
    const email = `vitest-oauth-${Date.now()}@test.local`

    const result = await resolveOAuthSignIn(email)
    const creado = await prisma.usuario.findUniqueOrThrow({ where: { email }, include: { rol: true } })
    cleanupIds.push(creado.id)

    expect(result).toBe(true)
    expect(creado.rol.nombre).toBe('Usuario')
    expect(creado.password).toBeNull()
  })

  it('no duplica la Cuenta si ya existe una previa por OAuth (sin password)', async () => {
    const { usuario } = await createUsuario('Usuario', { password: null })
    cleanupIds.push(usuario.id)

    const result = await resolveOAuthSignIn(usuario.email)
    const total = await prisma.usuario.count({ where: { email: usuario.email } })

    expect(result).toBe(true)
    expect(total).toBe(1)
  })

  it('bloquea el login OAuth si el correo ya es una Cuenta manual (con password)', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupIds.push(usuario.id)

    const result = await resolveOAuthSignIn(usuario.email)

    expect(result).toBe('/iniciar-sesion?error=correo_ya_registrado')
  })
})

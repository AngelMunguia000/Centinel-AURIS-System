import bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import type { Permiso } from '@/lib/permisos'

let counter = 0
export function uniqueEmail(prefix: string): string {
  counter += 1
  return `vitest-${prefix}-${Date.now()}-${counter}@test.local`
}

type RolNombre = 'Admin' | 'Operador' | 'Usuario'

export async function createUsuario(
  rolNombre: RolNombre,
  overrides: Partial<{ email: string; password: string | null }> = {}
) {
  const rol = await prisma.rol.findUniqueOrThrow({ where: { nombre: rolNombre } })
  const email = overrides.email ?? uniqueEmail(rolNombre.toLowerCase())
  const plainPassword = overrides.password === undefined ? 'Test1234!' : overrides.password
  const hashed = plainPassword === null ? null : await bcrypt.hash(plainPassword, 10)

  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Vitest',
      apellido: rolNombre,
      email,
      telefono: '',
      password: hashed,
      rolId: rol.id,
    },
    include: { rol: true },
  })

  return { usuario, password: plainPassword }
}

// Con sesión real (lib/sesiones.ts): un token sin `sid` ya no autentica. Se borra con la cuenta (onDelete: Cascade).
export async function tokenFor(usuario: { id: number; email: string; rol: { nombre: string } }): Promise<string> {
  const sid = randomUUID()
  await prisma.sesion.create({ data: { id: sid, usuarioId: usuario.id, via: 'password', expiraEn: new Date(Date.now() + 3_600_000) } })
  return signToken({ userId: usuario.id, email: usuario.email, role: usuario.rol.nombre, sid })
}

export function cookieHeader(token: string): string {
  return `token=${token}`
}

export async function deleteUsuario(id: number): Promise<void> {
  // Enlace edge: nodos y gateways tienen FK al usuario (los eventos caen en cascada con el nodo).
  await prisma.dispositivo.deleteMany({ where: { usuarioId: id } })
  await prisma.gateway.deleteMany({ where: { usuarioId: id } })
  await prisma.usuario.deleteMany({ where: { id } })
}

export async function deleteReporte(id: number): Promise<void> {
  // Las tablas dependientes (§B historial, §C comentarios, §G notificaciones)
  // tienen FK a Reporte: sin borrarlas primero, el deleteMany falla.
  await prisma.historialReporte.deleteMany({ where: { reporteId: id } })
  await prisma.comentario.deleteMany({ where: { reporteId: id } })
  await prisma.notificacion.deleteMany({ where: { reporteId: id } })
  await prisma.reporte.deleteMany({ where: { id } })
}

export async function setExcepcion(usuarioId: number, permiso: Permiso, otorgado: boolean): Promise<void> {
  await prisma.permisoCuenta.upsert({
    where: { usuarioId_permiso: { usuarioId, permiso } },
    update: { otorgado },
    create: { usuarioId, permiso, otorgado },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { generarToken } from '@/lib/edge/token'
import { CAMPOS_ARMADO, estaArmado } from '@/lib/edge/armado'

// Spec 2026-10-16-enlace-edge-design.md §6.1 y §7: vincular y listar las Raspberry Pi.
const PERMISO = ['dispositivos.propios', 'dispositivos.otros'] as const

const cuerpoSchema = z.object({
  nombre: z.string().trim().min(1).max(60),
  urlBase: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//.test(u), 'urlBase debe ser http(s)')
    .transform((u) => u.replace(/\/+$/, '')),
})

const SIN_SECRETO = { id: true, nombre: true, urlBase: true, ultimoContacto: true, revocadoEn: true, usuarioId: true, createdAt: true, ...CAMPOS_ARMADO } as const

export async function GET(request: NextRequest) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, [...PERMISO])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }
  const gateways = await prisma.gateway.findMany({
    where: usuario.permisos.has('dispositivos.otros') ? {} : { usuarioId: usuario.id },
    select: SIN_SECRETO,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ gateways: gateways.map((g) => ({ ...g, armadoAhora: estaArmado(g) })) })
}

export async function POST(request: NextRequest) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, [...PERMISO])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }
  const parsed = cuerpoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.issues }, { status: 400 })
  }

  const { token, tokenHash } = generarToken()
  const gateway = await prisma.gateway.create({
    data: { ...parsed.data, tokenHash, usuarioId: usuario.id },
    select: SIN_SECRETO,
  })
  // Única respuesta que contiene el token en claro: no se guarda en ningún lado.
  return NextResponse.json({ ...gateway, armadoAhora: estaArmado(gateway), token }, { status: 201 })
}

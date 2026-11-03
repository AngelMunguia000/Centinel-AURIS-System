import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { z } from 'zod'
import { CAMPOS_ARMADO, MODOS_ARMADO, estaArmado, horarioSchema } from '@/lib/edge/armado'

// Spec 2026-10-16-enlace-edge-design.md §7: revocar invalida el token al instante
// (autenticarGateway revisa revocadoEn en cada request). No borra la fila: sus
// nodos y eventos siguen en el historial.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, ['dispositivos.propios', 'dispositivos.otros'])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }
  const id = Number((await params).id)
  const gateway = Number.isInteger(id) ? await prisma.gateway.findUnique({ where: { id } }) : null
  // Ajeno sin dispositivos.otros responde igual que inexistente: no revela que existe.
  if (!gateway || (gateway.usuarioId !== usuario.id && !usuario.permisos.has('dispositivos.otros'))) {
    return NextResponse.json({ error: 'Gateway no encontrado' }, { status: 404 })
  }
  if (!gateway.revocadoEn) {
    await prisma.gateway.update({ where: { id }, data: { revocadoEn: new Date() } })
  }
  return NextResponse.json({ ok: true })
}

// Armado por Pi (roadmap de funciones #4). Mismo permiso y misma regla de dueño que revocar.
const armadoSchema = z.object({
  modoArmado: z.enum(MODOS_ARMADO, { errorMap: () => ({ message: 'Modo de armado inválido' }) }).optional(),
  horario: horarioSchema.nullable().optional(),
  vacacionesHasta: z.string().datetime({ offset: true, message: 'Fecha de vacaciones inválida' }).nullable().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, ['dispositivos.propios', 'dispositivos.otros'])
  if (!authorized) {
    return NextResponse.json({ error: reason === 'no_autenticado' ? 'No autenticado' : 'No autorizado' }, { status: reason === 'no_autenticado' ? 401 : 403 })
  }
  const id = Number((await params).id)
  const gateway = Number.isInteger(id) ? await prisma.gateway.findUnique({ where: { id } }) : null
  if (!gateway || (gateway.usuarioId !== usuario.id && !usuario.permisos.has('dispositivos.otros'))) {
    return NextResponse.json({ error: 'Gateway no encontrado' }, { status: 404 })
  }
  if (gateway.revocadoEn) {
    return NextResponse.json({ error: 'La Pi está revocada' }, { status: 409 })
  }
  const parsed = armadoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos', detalles: parsed.error.issues }, { status: 400 })
  }
  const { modoArmado, horario, vacacionesHasta } = parsed.data
  const horarioFinal = horario !== undefined ? (horario ? JSON.stringify(horario) : null) : gateway.horarioArmado
  if ((modoArmado ?? gateway.modoArmado) === 'horario' && !horarioFinal) {
    return NextResponse.json({ error: 'Para armar por horario, define el horario' }, { status: 400 })
  }

  const actualizado = await prisma.gateway.update({
    where: { id },
    data: {
      ...(modoArmado ? { modoArmado } : {}),
      ...(horario !== undefined ? { horarioArmado: horarioFinal } : {}),
      ...(vacacionesHasta !== undefined ? { vacacionesHasta: vacacionesHasta ? new Date(vacacionesHasta) : null } : {}),
      armadoCambiadoPor: usuario.nombre,
      armadoCambiadoEn: new Date(),
    },
    select: { id: true, ...CAMPOS_ARMADO },
  })
  return NextResponse.json({ ...actualizado, armadoAhora: estaArmado(actualizado) })
}

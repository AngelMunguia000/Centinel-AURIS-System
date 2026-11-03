import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"
import { revocarSesiones } from "@/lib/sesiones"

// Verificación en dos pasos (roadmap de funciones #8): la salida para quien perdió el teléfono y
// sus códigos de respaldo. Queda en la auditoría de cuentas y cierra las sesiones de esa cuenta.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario: admin, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")
  if (!authorized) {
    return NextResponse.json({ error: reason === "no_autenticado" ? "No autenticado" : "No autorizado" }, { status: reason === "no_autenticado" ? 401 : 403 })
  }
  const userId = Number((await params).id)
  if (!Number.isInteger(userId)) return NextResponse.json({ error: "ID de usuario inválido" }, { status: 400 })
  if (userId === admin.id) {
    return NextResponse.json({ error: "Para tu propia cuenta, desactívala desde Ajustes" }, { status: 400 })
  }

  const objetivo = await prisma.usuario.findUnique({ where: { id: userId }, select: { email: true, totpSecreto: true } })
  if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (!objetivo.totpSecreto) return NextResponse.json({ error: "Esa cuenta no tiene verificación en dos pasos" }, { status: 400 })

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: userId },
      data: { totpSecreto: null, totpPendiente: null, totpActivadoEn: null, codigosRespaldo: null },
    }),
    prisma.auditoriaCuenta.create({
      data: { accion: "dos_pasos_quitado", adminId: admin.id, adminEmail: admin.email, objetivoId: userId, objetivoEmail: objetivo.email, valorAnterior: "activa", valorNuevo: "desactivada" },
    }),
  ])
  await revocarSesiones(userId)
  return NextResponse.json({ ok: true })
}

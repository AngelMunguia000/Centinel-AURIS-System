import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  const id = idParam ? Number(idParam) : NaN

  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID de notificación inválido" }, { status: 400 })
  }

  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const notificacion = await prisma.notificacion.findUnique({ where: { id }, select: { destinatarioId: true } })
  if (!notificacion) {
    return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 })
  }
  if (notificacion.destinatarioId !== usuario.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const actualizada = await prisma.notificacion.update({
      where: { id },
      data: { leida: true }
    })
    return NextResponse.json(actualizada)
  } catch (error) {
    console.error("Error updating notificacion:", error)
    return NextResponse.json({ error: "Error al actualizar la notificación" }, { status: 500 })
  }
}

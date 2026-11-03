import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  try {
    await prisma.notificacion.updateMany({
      where: { destinatarioId: usuario.id, leida: false },
      data: { leida: true }
    })

    return NextResponse.json({ message: "Notificaciones marcadas como leídas" })
  } catch (error) {
    console.error("Error marking notificaciones as read:", error)
    return NextResponse.json({ error: "Error al actualizar notificaciones" }, { status: 500 })
  }
}

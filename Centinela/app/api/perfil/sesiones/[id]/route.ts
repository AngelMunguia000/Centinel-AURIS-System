import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"

// Cerrar una sesión a distancia. Ajena o inexistente responden igual (404): no revela ids.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const { count } = await prisma.sesion.updateMany({
    where: { id, usuarioId: usuario.id, revocadaEn: null },
    data: { revocadaEn: new Date() },
  })
  if (count === 0) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
  return NextResponse.json({ ok: true, eraLaActual: id === usuario.sesionId })
}

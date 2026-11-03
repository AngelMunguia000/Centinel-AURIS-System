import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"

// 06_UI_UX.md §J: solo lectura. La auditoría de cuentas se escribe únicamente
// desde PATCH/DELETE /api/admin/usuarios/[id], nunca directo.
export async function GET(request: NextRequest) {
  const { authorized, reason } = await requirePermiso(request.cookies, "auditoria.ver")
  if (!authorized) {
    return NextResponse.json(
      { error: reason === "no_autenticado" ? "No autenticado" : "Acceso denegado" },
      { status: reason === "no_autenticado" ? 401 : 403 }
    )
  }

  try {
    const registros = await prisma.auditoriaCuenta.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    })
    return NextResponse.json({ registros })
  } catch (error) {
    console.error("Error fetching auditoria:", error)
    return NextResponse.json({ error: "Error al obtener la auditoría" }, { status: 500 })
  }
}

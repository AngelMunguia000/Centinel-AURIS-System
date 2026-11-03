import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"

// Migrado desde /api/roles (sin autenticación) — 19§4.3 exige que toda Consulta
// transporte y verifique la identidad y el Rol del consumidor. Soporta la Acción
// "cambiar el Rol de una Cuenta" (19§5.4), que requiere conocer los Roles existentes.
export async function GET(request: NextRequest) {
  const { authorized, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")

  if (!authorized) {
    return NextResponse.json(
      { error: reason === "no_autenticado" ? "No autenticado" : "No autorizado" },
      { status: reason === "no_autenticado" ? 401 : 403 }
    )
  }

  try {
    const roles = await prisma.rol.findMany()
    return NextResponse.json(roles)
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 })
  }
}

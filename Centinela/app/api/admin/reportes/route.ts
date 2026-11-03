import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const { authorized, reason } = await requirePermiso(request.cookies, "reportes.ver_todos")

  if (!authorized) {
    return NextResponse.json(
      { error: reason === "no_autenticado" ? "No autenticado" : "Acceso denegado" },
      { status: reason === "no_autenticado" ? 401 : 403 }
    )
  }

  try {
    const reportes = await prisma.reporte.findMany({
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        estado: true,
        createdAt: true,
        usuario: {
          select: {
            nombre: true,
            email: true
          }
        },
        operadorAsignadoId: true,
        operadorAsignado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ reportes })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json({ error: "Error al obtener reportes" }, { status: 500 })
  }
}

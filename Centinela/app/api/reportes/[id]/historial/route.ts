import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"

// 06_UI_UX.md §B: mismo criterio de visibilidad que comentarios (misma
// ruta padre /api/reportes/[id]/...) — Usuario solo en sus propios
// reportes, quien tenga reportes.ver_todos en cualquiera (06_UI_UX.md §F). Sin POST: el historial se
// escribe únicamente desde PATCH /api/reportes/[id], nunca directo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  const reporteId = idParam ? Number(idParam) : NaN

  if (!idParam || Number.isNaN(reporteId)) {
    return NextResponse.json({ error: "ID de reporte inválido" }, { status: 400 })
  }

  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const reporte = await prisma.reporte.findUnique({ where: { id: reporteId }, select: { usuarioId: true } })
  if (!reporte) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 })
  }

  const esVisibilidadAmplia = usuario.permisos.has("reportes.ver_todos")
  if (!esVisibilidadAmplia && reporte.usuarioId !== usuario.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    const historial = await prisma.historialReporte.findMany({
      where: { reporteId },
      include: {
        autor: {
          select: { id: true, nombre: true, email: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(historial)
  } catch (error) {
    console.error("Error fetching historial:", error)
    return NextResponse.json({ error: "Error al obtener el historial" }, { status: 500 })
  }
}

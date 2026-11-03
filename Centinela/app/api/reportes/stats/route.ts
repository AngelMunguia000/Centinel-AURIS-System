import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { metricas, vencido } from "@/lib/respuesta"

// Corrección de no conformidad: la implementación anterior de esta ruta consultaba
// un campo `resuelto` (booleano) inexistente en el esquema real y no exigía
// autenticación. El campo real del dominio (16§4.2, 18§5.2) es `Reporte.estado`
// ("pendiente" | "resuelto"). Ver Brain/21_ChangeRecoveryLog.md, Fase 2.
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    )
  }

  // Mismo criterio de alcance que GET /api/reportes: quien tenga
  // reportes.ver_todos ve el sistema completo, sin él solo debe ver agregados
  // de sus propios reportes — antes esta ruta no filtraba nunca, revelando
  // conteos globales a cualquier Cuenta autenticada (hallazgo Fase 27, cerrado aquí).
  const filtro = usuario.permisos.has("reportes.ver_todos")
    ? {}
    : { usuarioId: usuario.id }

  try {
    const ahora = Date.now()
    const [totalReportes, reportesPendientes, reportesResueltos, recientes, pendientes] = await Promise.all([
      prisma.reporte.count({ where: filtro }),
      prisma.reporte.count({ where: { ...filtro, estado: "pendiente" } }),
      prisma.reporte.count({ where: { ...filtro, estado: "resuelto" } }),
      // Tiempos de respuesta (lib/respuesta.ts) sobre los últimos 30 días.
      prisma.reporte.findMany({
        where: { ...filtro, createdAt: { gte: new Date(ahora - 30 * 86_400_000) } },
        select: { createdAt: true, atendidoEn: true, resueltoEn: true, motivoCierre: true },
      }),
      prisma.reporte.findMany({
        where: { ...filtro, estado: "pendiente", atendidoEn: null },
        select: { estado: true, prioridad: true, createdAt: true, atendidoEn: true },
      }),
    ])

    return NextResponse.json(
      {
        totalReportes,
        reportesPendientes,
        reportesResueltos,
        ...metricas(recientes),
        vencidos: pendientes.filter((r) => vencido(r, ahora)).length,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { avisarGatewaysCaidos } from "@/lib/edge/vigilancia"
import { escalarVencidos } from "@/lib/escalamiento"
import { enviarResumenesPendientes } from "@/lib/resumen-semanal"
import { mantenimientoDiario } from "@/lib/mantenimiento"

// 06_UI_UX.md §G: solo lo propio, sin excepción por Rol (a diferencia de
// GET /api/reportes, aquí no hay "visibilidad amplia" — una notificación es
// siempre personal).
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // Un fallo aquí no debe dejar a nadie sin ver sus notificaciones.
  await avisarGatewaysCaidos().catch((error) => console.error("[edge] vigilancia de gateways falló:", error))
  await escalarVencidos().catch((error) => console.error("[escalamiento] falló:", error))
  // Resumen semanal: sin esperarlo, para no demorar la campanita mientras se arman los correos.
  void enviarResumenesPendientes(request.nextUrl.origin).catch((error) => console.error("[resumen] falló:", error))
  void mantenimientoDiario().catch((error) => console.error("[mantenimiento] falló:", error))

  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { destinatarioId: usuario.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })

    const noLeidas = await prisma.notificacion.count({
      where: { destinatarioId: usuario.id, leida: false }
    })

    return NextResponse.json({ notificaciones, noLeidas })
  } catch (error) {
    console.error("Error fetching notificaciones:", error)
    return NextResponse.json({ error: "Error al obtener notificaciones" }, { status: 500 })
  }
}

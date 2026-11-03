import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { describirAgente } from "@/lib/sesiones"

// Sesiones activas (roadmap de funciones #8): dónde está abierta la cuenta. Solo las propias.
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const sesiones = await prisma.sesion.findMany({
    where: { usuarioId: usuario.id, revocadaEn: null, expiraEn: { gt: new Date() } },
    orderBy: { ultimaActividad: "desc" },
  })
  return NextResponse.json({
    sesiones: sesiones.map((s) => ({
      id: s.id,
      dispositivo: describirAgente(s.agente),
      ip: s.ip,
      via: s.via,
      creadaEn: s.creadaEn,
      ultimaActividad: s.ultimaActividad,
      actual: s.id === usuario.sesionId,
    })),
  })
}

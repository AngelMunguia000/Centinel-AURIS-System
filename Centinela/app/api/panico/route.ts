import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"

// Botón de pánico del sidebar: hasta 2026-10-23 era un botón sin acción. Ahora abre una incidencia
// crítica y avisa en el momento a todos los Operadores y Admin.
const MAX_PANICOS = 5

export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const limite = getRateLimitIdentifier("panico", request, String(usuario.id))
  const rate = checkRateLimit(limite, MAX_PANICOS)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Ya enviaste varias alertas de pánico. Los Operadores ya están avisados." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }
  recordAttempt(limite)

  const quien = `${usuario.nombre} ${usuario.apellido}`.trim() || usuario.email
  const hora = new Date().toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  const reporte = await prisma.$transaction(async (tx) => {
    const creado = await tx.reporte.create({
      data: {
        titulo: "Botón de pánico",
        descripcion: `${quien} activó el botón de pánico desde la plataforma (${hora}).`,
        usuarioId: usuario.id,
        estado: "pendiente",
        prioridad: "critica",
        categoria: "Seguridad",
      },
      select: { id: true },
    })
    const responsables = await tx.usuario.findMany({
      where: { rol: { nombre: { in: ["Operador", "Admin"] } }, id: { not: usuario.id } },
      select: { id: true },
    })
    await tx.notificacion.createMany({
      data: responsables.map((r) => ({
        destinatarioId: r.id,
        reporteId: creado.id,
        mensaje: `PÁNICO: ${quien} pidió ayuda (${hora})`,
      })),
    })
    return { id: creado.id, avisados: responsables.length }
  })

  return NextResponse.json(reporte, { status: 201 })
}

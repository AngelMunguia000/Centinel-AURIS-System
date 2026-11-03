import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"

const MAX_LONGITUD_COMENTARIO = 2000

// 06_UI_UX.md §C: intercambio de información entre quien reporta y quien
// atiende (15§4.2). Mismo criterio de visibilidad que GET /api/reportes:
// Usuario solo en sus propios reportes, quien tenga reportes.ver_todos en cualquiera (06_UI_UX.md §F).
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
    const comentarios = await prisma.comentario.findMany({
      where: { reporteId },
      include: {
        autor: {
          select: { id: true, nombre: true, email: true }
        }
      },
      orderBy: { createdAt: "asc" }
    })

    return NextResponse.json(comentarios)
  } catch (error) {
    console.error("Error fetching comentarios:", error)
    return NextResponse.json({ error: "Error al obtener comentarios" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Límite alto, igual que reportes-crear/reclasificar: comentar es uso legítimo
  // frecuente, no un intento de login.
  const rateLimitId = getRateLimitIdentifier("reportes-comentar", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId, 60)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  recordAttempt(rateLimitId)

  const body = await request.json().catch(() => null)
  const contenido = typeof body?.contenido === "string" ? body.contenido.trim() : ""

  if (!contenido) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 })
  }
  if (contenido.length > MAX_LONGITUD_COMENTARIO) {
    return NextResponse.json(
      { error: `El comentario no puede superar ${MAX_LONGITUD_COMENTARIO} caracteres` },
      { status: 400 }
    )
  }

  try {
    const comentario = await prisma.comentario.create({
      data: {
        contenido,
        reporteId,
        autorId: usuario.id
      },
      include: {
        autor: {
          select: { id: true, nombre: true, email: true }
        }
      }
    })

    return NextResponse.json(comentario, { status: 201 })
  } catch (error) {
    console.error("Error creating comentario:", error)
    return NextResponse.json({ error: "Error al crear el comentario" }, { status: 500 })
  }
}

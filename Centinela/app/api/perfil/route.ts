import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"

// Perfil (06_UI_UX.md §A): editar nombre/apellido/username/telefono desde dentro
// de la app. El email NO es editable aquí — es la identidad de login (ligada al
// JWT y, para cuentas OAuth, a Auth.js), cambiarlo es una decisión aparte.
export async function PATCH(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // Límite generoso: editar el propio perfil es una acción legítima de uso
  // frecuente, no un intento de fuerza bruta (mismo criterio que reportes-reclasificar).
  const rateLimitId = getRateLimitIdentifier("perfil-actualizar", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId, 20)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  recordAttempt(rateLimitId)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const { nombre, apellido, username, telefono } = body as Record<string, unknown>
  const data: { nombre?: string; apellido?: string; username?: string | null; telefono?: string } = {}

  if (nombre !== undefined) {
    if (typeof nombre !== "string" || nombre.trim().length === 0) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 })
    }
    data.nombre = nombre.trim()
  }
  if (apellido !== undefined) {
    if (typeof apellido !== "string" || apellido.trim().length === 0) {
      return NextResponse.json({ error: "El apellido no puede estar vacío" }, { status: 400 })
    }
    data.apellido = apellido.trim()
  }
  if (telefono !== undefined) {
    if (typeof telefono !== "string" || telefono.trim().length === 0) {
      return NextResponse.json({ error: "El teléfono no puede estar vacío" }, { status: 400 })
    }
    data.telefono = telefono.trim()
  }
  if (username !== undefined) {
    if (username !== null && (typeof username !== "string" || username.trim().length === 0)) {
      return NextResponse.json({ error: "El nombre de usuario no puede estar vacío" }, { status: 400 })
    }
    data.username = username === null ? null : (username as string).trim()
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  try {
    const actualizado = await prisma.usuario.update({
      where: { id: usuario.id },
      data,
      select: { id: true, nombre: true, apellido: true, username: true, email: true, telefono: true },
    })
    return NextResponse.json({ usuario: actualizado })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ese nombre de usuario ya está en uso" }, { status: 409 })
    }
    console.error("Error actualizando perfil:", error)
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { revocarSesiones } from "@/lib/sesiones"
import { checkRateLimit, recordAttempt, resetRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"

// Cambiar contraseña desde dentro de la app, ya autenticado (06_UI_UX.md §A) —
// distinto del flujo de "recuperar contraseña" por email (forgot/reset-password).
export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // Mismo límite que login: esto verifica una contraseña, es superficie de fuerza bruta.
  const rateLimitId = getRateLimitIdentifier("perfil-password", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }

  const body = await request.json().catch(() => null)
  const { passwordActual, passwordNueva } = (body ?? {}) as {
    passwordActual?: unknown
    passwordNueva?: unknown
  }

  if (typeof passwordNueva !== "string" || passwordNueva.length < 8) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres" }, { status: 400 })
  }

  // Cuenta creada por OAuth (Google/GitHub): nunca tuvo password propio, igual que en /api/login.
  if (usuario.password === null) {
    return NextResponse.json(
      { error: "Esta cuenta inició sesión con Google o GitHub y no tiene contraseña propia." },
      { status: 400 }
    )
  }

  const actual = typeof passwordActual === "string" ? passwordActual : ""
  const esValida = await bcrypt.compare(actual, usuario.password)
  if (!esValida) {
    recordAttempt(rateLimitId)
    return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 })
  }

  resetRateLimit(rateLimitId)

  const hashedPassword = await bcrypt.hash(passwordNueva, 10)
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { password: hashedPassword },
  })
  // Si alguien más conocía la contraseña anterior, sus sesiones dejan de valer; esta sigue abierta.
  const cerradas = await revocarSesiones(usuario.id, usuario.sesionId)

  return NextResponse.json({ message: "Contraseña actualizada", sesionesCerradas: cerradas })
}

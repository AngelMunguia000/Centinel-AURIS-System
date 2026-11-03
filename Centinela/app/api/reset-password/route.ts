import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import crypto from "crypto"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { revocarSesiones } from "@/lib/sesiones"

const INVALID_TOKEN_MESSAGE = "El enlace de recuperación no es válido o ha expirado."
const RATE_LIMIT_MESSAGE = "Demasiados intentos. Intenta de nuevo más tarde."

export async function POST(request: NextRequest) {
  try {
    // Por IP únicamente (sin key adicional): no hay un correo en este payload,
    // solo token + nueva contraseña. Mismo criterio que register (lib/rate-limit.ts).
    const rateLimitId = getRateLimitIdentifier("reset-password", request)
    const rateLimit = checkRateLimit(rateLimitId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }
    recordAttempt(rateLimitId)

    const data = await request.json()
    const token = typeof data.token === "string" ? data.token : ""
    const password = typeof data.password === "string" ? data.password : ""

    if (!token) {
      return NextResponse.json({ success: false, error: INVALID_TOKEN_MESSAGE }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "La contraseña debe tener al menos 8 caracteres" },
        { status: 400 },
      )
    }

    // El token nunca se busca ni se guarda en claro — solo su hash (regla 8).
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const usuario = await prisma.usuario.findFirst({
      where: { passwordResetTokenHash: tokenHash },
    })

    if (!usuario || !usuario.passwordResetTokenExpires || usuario.passwordResetTokenExpires < new Date()) {
      return NextResponse.json({ success: false, error: INVALID_TOKEN_MESSAGE }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Un solo uso: la contraseña se actualiza y el token queda invalidado en la misma operación.
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetTokenExpires: null,
      },
    })
    // Recuperar la contraseña cierra todas las sesiones: quien tuviera la anterior queda fuera.
    await revocarSesiones(usuario.id)

    return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente." })
  } catch (error) {
    console.error("Error al restablecer la contraseña:", error)
    return NextResponse.json(
      { success: false, error: "Error al procesar la solicitud. Intenta nuevamente." },
      { status: 500 },
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/mail"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { isValidEmail } from "@/lib/validation"
import crypto from "crypto"

const GENERIC_MESSAGE = "Si el correo existe en nuestro sistema, se envió un enlace de recuperación."
const RATE_LIMIT_MESSAGE = "Demasiadas solicitudes. Intenta de nuevo más tarde."
const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hora — misma vigencia que la sesión (lib/auth.ts, signToken)

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const email = typeof data.email === "string" ? data.email.trim() : ""

    // Verificado antes de tocar Prisma/Resend, con el mismo correo tal como se recibió
    // (aún sin validar formato), para que el límite también contenga entradas malformadas.
    const rateLimitId = getRateLimitIdentifier("forgot-password", request, email)
    const rateLimit = checkRateLimit(rateLimitId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: RATE_LIMIT_MESSAGE },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      )
    }
    recordAttempt(rateLimitId)

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: "El correo electrónico no es válido" }, { status: 400 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } })

    if (usuario) {
      const rawToken = crypto.randomBytes(32).toString("hex")
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetTokenExpires: new Date(Date.now() + TOKEN_TTL_MS),
        },
      })

      const resetUrl = `${request.nextUrl.origin}/recuperar-contrasena?token=${rawToken}`

      try {
        await sendPasswordResetEmail(usuario.email, resetUrl)
      } catch (error) {
        console.error("No se pudo enviar el correo de recuperación de contraseña:", error)
      }
    }

    // Mismo mensaje exista o no el correo, para evitar enumeración de usuarios.
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
  } catch (error) {
    console.error("Error en la solicitud de recuperación de contraseña:", error)
    return NextResponse.json(
      { success: false, error: "Error al procesar la solicitud. Intenta nuevamente." },
      { status: 500 },
    )
  }
}

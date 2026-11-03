import { type NextRequest, NextResponse } from "next/server"
import { sendCuestionarioEmail } from "@/lib/mail"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { isValidEmail } from "@/lib/validation"

const RATE_LIMIT_MESSAGE = "Demasiadas solicitudes. Intenta de nuevo más tarde."

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const email = typeof data.email === "string" ? data.email.trim() : ""
    const answers = typeof data.answers === "object" && data.answers !== null ? data.answers : {}

    const rateLimitId = getRateLimitIdentifier("cuestionario", request, email)
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

    const registerUrl = `${request.nextUrl.origin}/registrarse`
    const result = await sendCuestionarioEmail(email, answers, registerUrl)

    return NextResponse.json({ success: true, emailSent: result.sent, emailSkippedReason: result.reason })
  } catch (error) {
    console.error("Error al procesar el cuestionario:", error)
    return NextResponse.json(
      { success: false, error: "Error al procesar la solicitud. Intenta nuevamente." },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, recordAttempt, resetRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { abrirSesion, ponerCookieSesion } from "@/lib/sesiones"
import { codigosRestantes, leerDesafio, verificarSegundoPaso } from "@/lib/dos-pasos"

const VENCIDO = "El paso de verificación venció. Vuelve a iniciar sesión."

// Segundo paso del login (lib/dos-pasos.ts): canjea el desafío + un código por la sesión.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const desafio = leerDesafio(body?.desafio)
  if (!desafio) return NextResponse.json({ error: VENCIDO }, { status: 400 })

  // Por cuenta: 6 dígitos son pocos, sin límite se adivinan.
  const rateLimitId = getRateLimitIdentifier("login-2fa", req, String(desafio.userId))
  const rateLimit = checkRateLimit(rateLimitId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: desafio.userId }, include: { rol: true } })
  if (!usuario?.totpSecreto) return NextResponse.json({ error: VENCIDO }, { status: 400 })
  const metodo = await verificarSegundoPaso(usuario, body?.codigo)
  if (!metodo) {
    recordAttempt(rateLimitId)
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401 })
  }
  resetRateLimit(rateLimitId)

  const ultimoLoginAnterior = usuario.ultimoLogin
  const actualizado = await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLogin: new Date() }, select: { codigosRespaldo: true } })
  const { token, maxAge } = await abrirSesion(usuario, req, { recordarme: desafio.recordarme, via: desafio.via, ultimoLoginAnterior })

  const response = NextResponse.json({
    message: "Login exitoso",
    user: { id: usuario.id, username: usuario.username, email: usuario.email, role: usuario.rol.nombre },
    // Con un código de respaldo conviene avisar cuántos quedan.
    ...(metodo === "respaldo" ? { codigosRespaldoRestantes: codigosRestantes(actualizado.codigosRespaldo) } : {}),
  })
  ponerCookieSesion(response, token, maxAge)
  return response
}

import { prisma } from "@/lib/prisma"
import bcrypt from "bcrypt"
import { NextResponse } from "next/server"
import { abrirSesion, ponerCookieSesion } from "@/lib/sesiones"
import { crearDesafio } from "@/lib/dos-pasos"
import { checkRateLimit, recordAttempt, resetRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"

export async function POST(req: Request) {

  const body = await req.json()

  const { email, password, recordarme } = body

  const rateLimitId = getRateLimitIdentifier("login", req, typeof email === "string" ? email : undefined)
  const rateLimit = checkRateLimit(rateLimitId)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }

  const usuario = await prisma.usuario.findUnique({
    where: {
      email
    },
    include: {
      rol: true
    }
  })

  if (!usuario) {
    recordAttempt(rateLimitId)
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    )
  }

  // Cuenta creada por OAuth (Google/GitHub) nunca tiene password propio.
  // Se responde igual que una contraseña incorrecta — revelar "esta cuenta es
  // solo-OAuth" sería una forma nueva de enumeración de correos.
  const isValid = usuario.password !== null && (await bcrypt.compare(password, usuario.password))

  if (!isValid) {
    recordAttempt(rateLimitId)
    return NextResponse.json(
      { error: "Correo o contraseña incorrectos" },
      { status: 401 }
    )
  }

  resetRateLimit(rateLimitId)

  // Verificación en dos pasos (lib/dos-pasos.ts): sin sesión todavía, solo el desafío para el código.
  if (usuario.totpSecreto) {
    return NextResponse.json({ requiere2fa: true, desafio: crearDesafio({ userId: usuario.id, recordarme: recordarme === true, via: "password" }) })
  }

  // Fase 46: se captura el valor ANTERIOR antes de sobrescribirlo — es lo que permite
  // que la notificación de /operador distinga "nuevo desde la última vez" de "todo lo
  // pendiente ahora mismo" (Fase 45.6, dejado pendiente entonces).
  const ultimoLoginAnterior = usuario.ultimoLogin
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoLogin: new Date() },
  })

  // Fase 41: "Recordarme" real — sesión de 30 días en vez de 1 hora. El maxAge de la
  // cookie abajo debe coincidir exactamente con la expiración del JWT: si el JWT dura
  // más pero la cookie expira antes, el navegador borra la cookie y el usuario queda
  // deslogueado de todas formas; si fuera al revés, la cookie sobreviviría a un JWT ya
  // inválido — inofensivo (jwt.verify lo rechazaría) pero inconsistente.
  // abrirSesion (lib/sesiones.ts) firma el JWT y crea la fila Sesion con la misma duración.
  let sesion: { token: string; maxAge: number }
  try {
    sesion = await abrirSesion(usuario, req, { recordarme: recordarme === true, via: "password", ultimoLoginAnterior })
  } catch (error) {
    console.error("No se pudo firmar el token de sesión:", error)
    return NextResponse.json(
      { error: "El servidor no está configurado correctamente. Intenta más tarde." },
      { status: 500 }
    )
  }

  const response = NextResponse.json({
    message: "Login exitoso",
    user: {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      role: usuario.rol.nombre
    }
  })

  ponerCookieSesion(response, sesion.token, sesion.maxAge)

  return response
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { abrirSesion, ponerCookieSesion } from "@/lib/sesiones"
import { crearDesafio } from "@/lib/dos-pasos"
import { prisma } from "@/lib/prisma"

// Puente entre la sesión de Auth.js (usada únicamente para el handshake OAuth)
// y el sistema de identidad propio de la app (cookie httpOnly "token", lib/auth.ts).
// Auth.js nunca autoriza nada por sí mismo en el resto del sistema — solo llega
// hasta aquí, y de aquí en adelante todo pasa por signToken/getAuthenticatedUsuario
// como en el login normal.
export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.usuarioId || !session.user.email || !session.user.role) {
    return NextResponse.redirect(new URL("/iniciar-sesion?error=oauth_fallido", request.url))
  }

  // Fase 46: mismo tratamiento que el login normal — capturar el valor anterior
  // antes de sobrescribirlo, para que el campo tenga el mismo significado sin
  // importar por qué puerta entró la sesión.
  const usuarioPrevio = await prisma.usuario.findUnique({
    where: { id: session.user.usuarioId },
    select: { ultimoLogin: true, totpSecreto: true },
  })
  // Con dos pasos, Google/GitHub no basta: el formulario de acceso pide el código.
  if (usuarioPrevio?.totpSecreto) {
    const desafio = crearDesafio({ userId: session.user.usuarioId, recordarme: false, via: "oauth" })
    return NextResponse.redirect(new URL(`/iniciar-sesion?desafio=${encodeURIComponent(desafio)}`, request.url))
  }
  await prisma.usuario.update({
    where: { id: session.user.usuarioId },
    data: { ultimoLogin: new Date() },
  })

  const { token, maxAge } = await abrirSesion(
    { id: session.user.usuarioId, email: session.user.email, rol: { nombre: session.user.role } },
    request,
    { via: "oauth", ultimoLoginAnterior: usuarioPrevio?.ultimoLogin ?? null }
  )

  // Mismo destino que el login normal (LoginForm.tsx): el Inicio, para todos los roles.
  const response = NextResponse.redirect(new URL("/dashboard", request.url))

  ponerCookieSesion(response, token, maxAge)

  return response
}

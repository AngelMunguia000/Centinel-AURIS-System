import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  // Sesiones activas (lib/sesiones.ts): salir revoca la sesión en el servidor, no solo borra la cookie.
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (usuario?.sesionId) {
    await prisma.sesion.updateMany({ where: { id: usuario.sesionId, revocadaEn: null }, data: { revocadaEn: new Date() } })
  }

  const response = NextResponse.redirect(new URL('/iniciar-sesion', request.url))

  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  })

  return response
}

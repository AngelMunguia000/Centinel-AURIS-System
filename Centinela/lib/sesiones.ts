import { randomUUID } from "node:crypto"
import type { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"

// Sesiones activas (roadmap de funciones #8): cada login crea una fila `Sesion` y el JWT lleva
// su id (`sid`). getAuthenticatedUsuario rechaza el token si la sesión fue revocada, así se
// puede cerrar sesión a distancia. Lo usan login, login con 2 pasos y el puente OAuth.

const HORA_S = 60 * 60
const MES_S = 30 * 24 * HORA_S

type Cuenta = { id: number; email: string; rol: { nombre: string } }

export async function abrirSesion(
  usuario: Cuenta,
  request: Request,
  { recordarme = false, via, ultimoLoginAnterior = null }: { recordarme?: boolean; via: "password" | "oauth"; ultimoLoginAnterior?: Date | null }
): Promise<{ token: string; maxAge: number }> {
  const maxAge = recordarme ? MES_S : HORA_S
  const sesion = await prisma.sesion.create({
    data: {
      id: randomUUID(),
      usuarioId: usuario.id,
      agente: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      // shortcut: sin proxy delante, Next no expone la IP del socket; con proxy, este header la trae.
      ip: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null,
      via,
      expiraEn: new Date(Date.now() + maxAge * 1000),
    },
  })
  const token = signToken(
    { userId: usuario.id, email: usuario.email, role: usuario.rol.nombre, sid: sesion.id, ultimoLoginAnterior: ultimoLoginAnterior?.toISOString() ?? null },
    maxAge
  )
  return { token, maxAge }
}

/** La cookie dura lo mismo que el JWT (ver el comentario de "Recordarme" en app/api/login/route.ts). */
export function ponerCookieSesion(response: NextResponse, token: string, maxAge: number): void {
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  })
}

/** Revoca las sesiones vivas de una cuenta, salvo `excepto` (la actual, al cambiar la contraseña). */
export async function revocarSesiones(usuarioId: number, excepto?: string): Promise<number> {
  const { count } = await prisma.sesion.updateMany({
    where: { usuarioId, revocadaEn: null, ...(excepto ? { id: { not: excepto } } : {}) },
    data: { revocadaEn: new Date() },
  })
  return count
}

/** "Chrome en Windows", "Centinela Desktop 0.5.0", "Safari en iPhone". */
export function describirAgente(ua: string | null): string {
  if (!ua) return "Dispositivo desconocido"
  const desktop = ua.match(/CentinelaDesktop\/([\d.]+)/)
  if (desktop) return `Centinela Desktop ${desktop[1]}`
  const navegador = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /python-httpx|curl/i.test(ua) ? "Cliente de API" : "Navegador"
  const sistema = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : null
  return sistema ? `${navegador} en ${sistema}` : navegador
}

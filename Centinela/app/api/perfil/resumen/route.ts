import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { enviarResumen, resumenDe } from "@/lib/resumen-semanal"

// Resumen semanal desde Ajustes (roadmap de funciones #7): activarlo, verlo y pedirlo ahora. Solo la propia cuenta.

// GET → { activo, asunto, html }: la vista previa es el mismo correo que llegaría hoy.
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const r = await resumenDe(usuario.id, request.nextUrl.origin)
  return NextResponse.json({ activo: usuario.resumenSemanal, asunto: r?.asunto, html: r?.html })
}

// PATCH { activo: boolean }
export async function PATCH(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.activo !== "boolean") return NextResponse.json({ error: "Se espera { activo: true | false }" }, { status: 400 })
  await prisma.usuario.update({ where: { id: usuario.id }, data: { resumenSemanal: body.activo } })
  return NextResponse.json({ activo: body.activo })
}

// POST → lo envía ahora a la propia cuenta. Pocas veces por hora: cada uno es un correo real.
export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const limiteId = getRateLimitIdentifier("resumen-ahora", request, String(usuario.id))
  const limite = checkRateLimit(limiteId, 3)
  if (!limite.allowed) {
    return NextResponse.json({ error: "Ya pediste varios resúmenes. Intenta más tarde." }, { status: 429, headers: { "Retry-After": String(limite.retryAfterSeconds) } })
  }
  recordAttempt(limiteId)
  const res = await enviarResumen(usuario.id, request.nextUrl.origin)
  return res.sent
    ? NextResponse.json({ enviado: true, a: usuario.email })
    : NextResponse.json({ enviado: false, error: res.reason ?? "No se pudo enviar el correo" }, { status: 502 })
}

import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { checkRateLimit, recordAttempt, resetRateLimit, getRateLimitIdentifier } from "@/lib/rate-limit"
import { cifrarSecreto, descifrarSecreto, nuevoSecreto, nuevosCodigosRespaldo, uriOtpauth, verificarTotp } from "@/lib/totp"
import { codigosRestantes, verificarSegundoPaso } from "@/lib/dos-pasos"

// Verificación en dos pasos desde Ajustes (roadmap de funciones #8). Solo la propia cuenta.
export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  return NextResponse.json({
    activo: !!usuario.totpSecreto,
    activadoEn: usuario.totpActivadoEn,
    codigosRestantes: codigosRestantes(usuario.codigosRespaldo),
  })
}

// { accion: "iniciar" } → secreto + QR · { accion: "activar", codigo } → códigos de respaldo
// { accion: "desactivar", codigo } · { accion: "regenerar", codigo } → códigos de respaldo nuevos
export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const accion = body?.accion

  if (accion === "iniciar") {
    if (usuario.totpSecreto) return NextResponse.json({ error: "La verificación en dos pasos ya está activa" }, { status: 409 })
    const secreto = nuevoSecreto()
    await prisma.usuario.update({ where: { id: usuario.id }, data: { totpPendiente: cifrarSecreto(secreto) } })
    const uri = uriOtpauth(secreto, usuario.email)
    return NextResponse.json({ secreto, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) })
  }

  if (!["activar", "desactivar", "regenerar"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  }

  const rateLimitId = getRateLimitIdentifier("2fa-perfil", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  const fallo = () => {
    recordAttempt(rateLimitId)
    return NextResponse.json({ error: "Código incorrecto" }, { status: 401 })
  }

  if (accion === "activar") {
    if (usuario.totpSecreto) return NextResponse.json({ error: "La verificación en dos pasos ya está activa" }, { status: 409 })
    if (!usuario.totpPendiente) return NextResponse.json({ error: "Primero genera el código QR" }, { status: 400 })
    if (typeof body.codigo !== "string" || !verificarTotp(descifrarSecreto(usuario.totpPendiente), body.codigo)) return fallo()
    const { codigos, hashes } = nuevosCodigosRespaldo()
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { totpSecreto: usuario.totpPendiente, totpPendiente: null, totpActivadoEn: new Date(), codigosRespaldo: JSON.stringify(hashes) },
    })
    resetRateLimit(rateLimitId)
    return NextResponse.json({ activo: true, codigos })
  }

  if (!usuario.totpSecreto) return NextResponse.json({ error: "La verificación en dos pasos no está activa" }, { status: 400 })

  if (accion === "regenerar") {
    // Solo con la app: un código de respaldo no debe servir para fabricar más.
    if (typeof body.codigo !== "string" || !verificarTotp(descifrarSecreto(usuario.totpSecreto), body.codigo)) return fallo()
    const { codigos, hashes } = nuevosCodigosRespaldo()
    await prisma.usuario.update({ where: { id: usuario.id }, data: { codigosRespaldo: JSON.stringify(hashes) } })
    resetRateLimit(rateLimitId)
    return NextResponse.json({ codigos })
  }

  // desactivar: con la app o con un código de respaldo (por si se perdió el teléfono)
  if (!(await verificarSegundoPaso(usuario, body.codigo))) return fallo()
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { totpSecreto: null, totpPendiente: null, totpActivadoEn: null, codigosRespaldo: null },
  })
  resetRateLimit(rateLimitId)
  return NextResponse.json({ activo: false })
}

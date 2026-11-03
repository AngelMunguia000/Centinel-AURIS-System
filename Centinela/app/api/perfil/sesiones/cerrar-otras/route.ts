import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { revocarSesiones } from "@/lib/sesiones"

// "Cerrar todas las demás": la sesión desde la que se pide sigue abierta.
export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  return NextResponse.json({ cerradas: await revocarSesiones(usuario.id, usuario.sesionId) })
}

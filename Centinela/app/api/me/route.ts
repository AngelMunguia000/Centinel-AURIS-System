import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedUsuario } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    )
  }

  return NextResponse.json({
    user: {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      // Para el saludo de Centinela Desktop (app nativa, 2026-10-23).
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono,
      ultimoLoginAnterior: usuario.ultimoLoginAnterior,
      role: usuario.rol.nombre,
      permisos: Array.from(usuario.permisos),
    }
  })
}

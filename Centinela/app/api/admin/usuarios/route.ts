import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // 06_UI_UX.md §F: lectura también para dispositivos.otros — el buscador del Centro de Dispositivos necesita esta lista.
  const { authorized, reason } = await requirePermiso(request.cookies, ["usuarios.gestionar", "dispositivos.otros"])

  if (!authorized) {
    return NextResponse.json(
      { error: reason === "no_autenticado" ? "No autenticado" : "Acceso denegado" },
      { status: reason === "no_autenticado" ? 401 : 403 }
    )
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        ultimoLogin: true,
        totpActivadoEn: true,
        rol: {
          select: {
            nombre: true
          }
        },
        // Carga del Operador: cuántos pendientes tiene asignados (para decidir a quién asignar)
        _count: { select: { reportesAsignados: { where: { estado: "pendiente" } } } }
      }
    })

    return NextResponse.json({ usuarios })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 })
  }
}

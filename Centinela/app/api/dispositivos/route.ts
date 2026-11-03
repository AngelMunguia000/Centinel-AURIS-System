import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { TIPOS_VALIDOS, CONEXIONES_VALIDAS, VARIABLE_POR_TIPO, type TipoDispositivo } from "@/lib/dispositivos-ejemplos"

// Centro de Dispositivos (2 sep 2026): cada Usuario tiene su propio equipo.
// 06_UI_UX.md §F: quien tenga `dispositivos.otros` (por defecto Admin) opera
// sobre otras cuentas (vía ?usuarioId= en GET o usuarioId en el body de
// POST); quien tenga `dispositivos.propios` (por defecto Usuario y Admin)
// opera sobre el equipo propio.

function generarUid(): string {
  const sufijo = Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase()
  return `CC-${sufijo}`
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // 06_UI_UX.md §F: quien tiene dispositivos.otros opera en "modo otros"
  // (antes: Admin) y debe indicar usuarioId; si no, su propio equipo.
  const puedeVerOtros = usuario.permisos.has("dispositivos.otros")
  if (!puedeVerOtros && !usuario.permisos.has("dispositivos.propios")) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
  }

  let usuarioIdObjetivo = usuario.id

  if (puedeVerOtros) {
    const usuarioIdParam = request.nextUrl.searchParams.get("usuarioId")
    if (!usuarioIdParam) {
      return NextResponse.json({ error: "Falta el parámetro usuarioId" }, { status: 400 })
    }
    const parsed = Number(usuarioIdParam)
    if (!Number.isInteger(parsed)) {
      return NextResponse.json({ error: "usuarioId inválido" }, { status: 400 })
    }
    usuarioIdObjetivo = parsed
  }

  try {
    const dispositivos = await prisma.dispositivo.findMany({
      where: { usuarioId: usuarioIdObjetivo },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ dispositivos })
  } catch (error) {
    console.error("Error fetching dispositivos:", error)
    return NextResponse.json({ error: "Error al obtener dispositivos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  // 06_UI_UX.md §F: quien tiene dispositivos.otros opera en "modo otros"
  // (antes: Admin) y debe indicar usuarioId; si no, su propio equipo.
  const puedeVerOtros = usuario.permisos.has("dispositivos.otros")
  if (!puedeVerOtros && !usuario.permisos.has("dispositivos.propios")) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
  }

  const body = await request.json()
  const { nombre, tipo } = body

  if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json(
      { error: `Tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(", ")}` },
      { status: 400 }
    )
  }

  const conexion = body.conexion !== undefined ? body.conexion : "ESTABLE"
  if (!CONEXIONES_VALIDAS.includes(conexion)) {
    return NextResponse.json(
      { error: `Conexión inválida. Valores permitidos: ${CONEXIONES_VALIDAS.join(", ")}` },
      { status: 400 }
    )
  }

  let usuarioIdObjetivo = usuario.id

  if (puedeVerOtros) {
    const usuarioIdBody = body.usuarioId
    if (!Number.isInteger(usuarioIdBody)) {
      return NextResponse.json({ error: "Falta usuarioId en el cuerpo de la solicitud" }, { status: 400 })
    }
    const destino = await prisma.usuario.findUnique({ where: { id: usuarioIdBody } })
    if (!destino) {
      return NextResponse.json({ error: "El usuario destino no existe" }, { status: 404 })
    }
    usuarioIdObjetivo = usuarioIdBody
  }

  const variablePorDefecto = VARIABLE_POR_TIPO[tipo as TipoDispositivo]

  try {
    const dispositivo = await prisma.dispositivo.create({
      data: {
        nombre: nombre.trim(),
        uid: generarUid(),
        tipo,
        conexion,
        bateria: 100,
        variableLabel: variablePorDefecto.label,
        variableValor: variablePorDefecto.valor,
        usuarioId: usuarioIdObjetivo,
      },
    })

    return NextResponse.json(dispositivo, { status: 201 })
  } catch (error) {
    console.error("Error creating dispositivo:", error)
    return NextResponse.json({ error: "Error al crear el dispositivo" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"
import {
  PERMISOS,
  PERMISOS_POR_ROL,
  esPermisoValido,
  esEstadoPermiso,
  estadoActual,
  normalizarEstado,
  permisosEfectivos,
  type EstadoPermiso,
  type Permiso,
  type RolNombre,
} from "@/lib/permisos"

// 06_UI_UX.md §F — spec 2026-09-24-permisos-granulares-design.md §4–§6.
// Excepciones de permisos de UNA cuenta Usuario/Operador sobre los defaults
// de su rol. Cuentas Admin: siempre todo, no editables (400).

type Excepcion = { permiso: string; otorgado: boolean }

function deny(reason: "no_autenticado" | "no_autorizado") {
  return NextResponse.json(
    { error: reason === "no_autenticado" ? "No autenticado" : "Acceso denegado" },
    { status: reason === "no_autenticado" ? 401 : 403 }
  )
}

function respuesta(rol: string, excepciones: Excepcion[]) {
  const estados = Object.fromEntries(
    PERMISOS.map((p) => [p.clave, estadoActual(p.clave, excepciones)])
  ) as Record<Permiso, EstadoPermiso>
  return {
    rol,
    estados,
    porDefecto: [...(PERMISOS_POR_ROL[rol as RolNombre] ?? [])],
    efectivos: Array.from(permisosEfectivos(rol, excepciones)),
  }
}

async function cargarObjetivo(id: number) {
  return prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      rol: { select: { nombre: true } },
      permisosCuenta: { select: { permiso: true, otorgado: true } },
    },
  })
}

function parseId(raw: string) {
  const id = parseInt(raw)
  return Number.isNaN(id) ? null : id
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")
  if (!authorized) return deny(reason)

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const objetivo = await cargarObjetivo(id)
  if (!objetivo) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  return NextResponse.json(respuesta(objetivo.rol.nombre, objetivo.permisosCuenta))
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario: actor, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")
  if (!authorized) return deny(reason)

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  // Spec §4.2: nadie edita sus propios permisos.
  if (id === actor.id) {
    return NextResponse.json({ error: "No puedes editar tus propios permisos" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const pedidos = body?.permisos
  if (!pedidos || typeof pedidos !== "object" || Array.isArray(pedidos)) {
    return NextResponse.json({ error: "Falta el objeto permisos" }, { status: 400 })
  }
  // Spec §4.6: todo o nada — una clave o estado inválido rechaza la petición entera.
  for (const [clave, estado] of Object.entries(pedidos)) {
    if (!esPermisoValido(clave)) {
      return NextResponse.json({ error: `Permiso desconocido: ${clave}` }, { status: 400 })
    }
    if (!esEstadoPermiso(estado)) {
      return NextResponse.json(
        { error: `Estado inválido para ${clave}. Valores permitidos: defecto, otorgado, quitado` },
        { status: 400 }
      )
    }
  }

  // Revisión 2026-09-25 (fix round 1, ruling §3): cargarObjetivo, el 400 de
  // cuenta Admin, el chequeo de escalada (§1) y el cálculo de `cambios` se
  // hacen todos DENTRO de la transacción, con la fila que la propia
  // transacción leyó — un cambio de rol concurrente no puede colar
  // excepciones normalizadas contra un rol viejo ni un "antes" de auditoría
  // obsoleto. Los desenlaces 404/400/403 salen como un resultado tipado, no
  // como un throw genérico que terminaría en 500.
  type Resultado =
    | { tipo: "no_encontrado" }
    | { tipo: "admin_objetivo" }
    | { tipo: "escalada"; mensaje: string }
    | { tipo: "ok"; rol: string }

  let resultado: Resultado
  try {
    resultado = await prisma.$transaction(async (tx): Promise<Resultado> => {
      const objetivo = await tx.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          rol: { select: { nombre: true } },
          permisosCuenta: { select: { permiso: true, otorgado: true } },
        },
      })
      if (!objetivo) return { tipo: "no_encontrado" }

      // Spec §4.1: una cuenta Admin siempre tiene todo.
      if (objetivo.rol.nombre === "Admin") return { tipo: "admin_objetivo" }

      const rol = objetivo.rol.nombre
      const cambios: { clave: Permiso; antes: EstadoPermiso; despues: EstadoPermiso }[] = []
      for (const [clave, estado] of Object.entries(pedidos) as [Permiso, EstadoPermiso][]) {
        const antes = estadoActual(clave, objetivo.permisosCuenta)
        const despues = normalizarEstado(rol, clave, estado)
        if (antes !== despues) cambios.push({ clave, antes, despues })
      }

      // 06_UI_UX.md §F — sin escalada por cuenta intermedia (revisión 2026-09-25):
      // un actor que no es Admin (llegó aquí por una excepción usuarios.gestionar
      // otorgada) no puede otorgar ni quitar la gestión de usuarios, ni otorgar o
      // quitar ningún permiso que él mismo no tenga — sería fabricarse acceso vía
      // una cuenta intermedia. Nada se escribe antes de este chequeo.
      if (actor.rol.nombre !== "Admin") {
        for (const { clave } of cambios) {
          if (clave === "usuarios.gestionar") {
            return { tipo: "escalada", mensaje: "Solo un Admin puede otorgar o quitar la gestión de usuarios" }
          }
          if (!actor.permisos.has(clave)) {
            return { tipo: "escalada", mensaje: "No puedes otorgar ni quitar un permiso que no tienes" }
          }
        }
      }

      for (const { clave, antes, despues } of cambios) {
        await tx.permisoCuenta.deleteMany({ where: { usuarioId: id, permiso: clave } })
        if (despues !== "defecto") {
          await tx.permisoCuenta.create({
            data: { usuarioId: id, permiso: clave, otorgado: despues === "otorgado" },
          })
        }
        // Spec §4.5: una fila de auditoría por permiso que cambió.
        await tx.auditoriaCuenta.create({
          data: {
            accion: "permiso_cambiado",
            adminId: actor.id,
            adminEmail: actor.email,
            objetivoId: id,
            objetivoEmail: objetivo.email,
            valorAnterior: `${clave}: ${antes}`,
            valorNuevo: `${clave}: ${despues}`,
          },
        })
      }

      return { tipo: "ok", rol }
    })
  } catch (error) {
    console.error("Error actualizando permisos:", error)
    return NextResponse.json({ error: "Error al actualizar permisos" }, { status: 500 })
  }

  if (resultado.tipo === "no_encontrado") {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  }
  if (resultado.tipo === "admin_objetivo") {
    return NextResponse.json({ error: "Las cuentas Admin siempre tienen todos los permisos" }, { status: 400 })
  }
  if (resultado.tipo === "escalada") {
    return NextResponse.json({ error: resultado.mensaje }, { status: 403 })
  }

  const actualizado = await cargarObjetivo(id)
  return NextResponse.json(respuesta(resultado.rol, actualizado?.permisosCuenta ?? []))
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermiso } from "@/lib/auth"
import { permisosEfectivos, type Permiso } from "@/lib/permisos"

function unauthorizedResponse(reason: "no_autenticado" | "no_autorizado") {
  return NextResponse.json(
    { error: reason === "no_autenticado" ? "No autenticado" : "Acceso denegado" },
    { status: reason === "no_autenticado" ? 401 : 403 }
  )
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario: admin, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")
  if (!authorized) return unauthorizedResponse(reason)

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  const data = await request.json()
  if (!data.rolId || typeof data.rolId !== "number") {
    return NextResponse.json({ error: "rolId inválido" }, { status: 400 })
  }

  // Invariante 3 (16§7.1), misma protección que ya existe en DELETE: una Cuenta
  // con Rol Admin nunca puede modificarse a sí misma — sin esto, un Admin podía
  // quitarse su propio rol y dejar el panel de administración inalcanzable.
  if (userId === admin.id) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 })
  }

  const rolExiste = await prisma.rol.findUnique({ where: { id: data.rolId } })
  if (!rolExiste) {
    return NextResponse.json({ error: "rolId no corresponde a un rol existente" }, { status: 400 })
  }

  // 06_UI_UX.md §F, spec §4.3 — sin escalada: quien gestiona usuarios por
  // permiso otorgado (no por rol Admin) no puede crear Admins ni tocar uno.
  if (admin.rol.nombre !== "Admin") {
    const objetivo = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: { select: { nombre: true } } },
    })
    if (rolExiste.nombre === "Admin" || objetivo?.rol.nombre === "Admin") {
      return NextResponse.json({ error: "Solo un Admin puede asignar o modificar cuentas Admin" }, { status: 403 })
    }
  }

  type ResultadoPatch =
    | { tipo: "no_encontrado" }
    | { tipo: "escalada"; mensaje: string }
    | { tipo: "ok"; usuario: { id: number; nombre: string; email: string; rol: { nombre: string } } }

  try {
    // 06_UI_UX.md §J: el rol anterior se lee de la BD, no del body, y la
    // auditoría se escribe en la misma transacción que el cambio — nunca
    // existe un cambio de rol sin su registro.
    const resultado = await prisma.$transaction(async (tx): Promise<ResultadoPatch> => {
      const actual = await tx.usuario.findUnique({
        where: { id: userId },
        select: {
          email: true,
          rol: { select: { nombre: true } },
          permisosCuenta: { select: { permiso: true, otorgado: true } },
        }
      })
      if (!actual) return { tipo: "no_encontrado" }

      // 06_UI_UX.md §F — sin escalada por cuenta intermedia (revisión 2026-09-25):
      // se repite aquí, con la fila que esta misma transacción acaba de leer, para
      // que una promoción a Admin concurrente entre el pre-chequeo y esta escritura
      // no se cuele. Este chequeo dentro de la transacción es el autoritativo.
      if (admin.rol.nombre !== "Admin" && (rolExiste.nombre === "Admin" || actual.rol.nombre === "Admin")) {
        return { tipo: "escalada", mensaje: "Solo un Admin puede asignar o modificar cuentas Admin" }
      }

      // 06_UI_UX.md §F — anti-escalación extendida a cambios de rol (I-1,
      // revisión de cierre 2026-09-25): un cambio de rol puede otorgar o
      // quitar permisos igual que una excepción explícita del PUT de
      // permisos, así que un actor no-Admin queda sujeto a la misma regla.
      // Las excepciones de la cuenta se purgan en un cambio de rol real
      // (más abajo), así que "después" se calcula sin ellas. `usuarios.gestionar`
      // se bloquea en cualquier dirección (otorgarlo o quitarlo); el resto
      // de permisos solo bloquea lo que el cambio OTORGARÍA sin que el actor
      // lo tenga — perder un permiso que ni el actor ni el objetivo dependen
      // de él no es escalación.
      if (admin.rol.nombre !== "Admin") {
        const antes = permisosEfectivos(actual.rol.nombre, actual.permisosCuenta)
        const despues = permisosEfectivos(rolExiste.nombre, [])
        const cambiados = new Set<Permiso>(
          [...antes, ...despues].filter((p) => antes.has(p) !== despues.has(p))
        )
        if (cambiados.has("usuarios.gestionar")) {
          return { tipo: "escalada", mensaje: "Solo un Admin puede otorgar o quitar la gestión de usuarios" }
        }
        for (const p of despues) {
          if (!antes.has(p) && !admin.permisos.has(p)) {
            return { tipo: "escalada", mensaje: "Este cambio de rol otorgaría o quitaría permisos que no tienes" }
          }
        }
      }

      const actualizado = await tx.usuario.update({
        where: { id: userId },
        data: { rolId: data.rolId },
        select: {
          id: true,
          nombre: true,
          email: true,
          rol: { select: { nombre: true } }
        }
      })

      if (actual.rol.nombre !== actualizado.rol.nombre) {
        // Spec §4.4: las excepciones eran relativas al rol anterior.
        await tx.permisoCuenta.deleteMany({ where: { usuarioId: userId } })
        await tx.auditoriaCuenta.create({
          data: {
            accion: "cambio_rol",
            adminId: admin.id,
            adminEmail: admin.email,
            objetivoId: userId,
            objetivoEmail: actual.email,
            valorAnterior: actual.rol.nombre,
            valorNuevo: actualizado.rol.nombre
          }
        })
      }
      return { tipo: "ok", usuario: actualizado }
    })

    if (resultado.tipo === "no_encontrado") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }
    if (resultado.tipo === "escalada") {
      return NextResponse.json({ error: resultado.mensaje }, { status: 403 })
    }

    return NextResponse.json({ usuario: resultado.usuario })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ error: "Error al actualizar usuario" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, usuario: admin, reason } = await requirePermiso(request.cookies, "usuarios.gestionar")
  if (!authorized) return unauthorizedResponse(reason)

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 })
  }

  // Invariante 3 (16§7.1): una Cuenta con Rol Admin nunca puede eliminarse a sí misma.
  if (userId === admin.id) {
    return NextResponse.json({ error: "No puedes eliminarte a ti mismo" }, { status: 400 })
  }

  if (admin.rol.nombre !== "Admin") {
    const objetivo = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { rol: { select: { nombre: true } } },
    })
    if (objetivo?.rol.nombre === "Admin") {
      return NextResponse.json({ error: "Solo un Admin puede eliminar cuentas Admin" }, { status: 403 })
    }
  }

  type ResultadoDelete = { tipo: "no_encontrado" } | { tipo: "escalada"; mensaje: string } | { tipo: "ok" }

  try {
    // 06_UI_UX.md §J: si el DELETE falla (p. ej. P2003), la transacción
    // revierte también la auditoría — no queda registro de algo que no pasó.
    const resultado = await prisma.$transaction(async (tx): Promise<ResultadoDelete> => {
      const objetivo = await tx.usuario.findUnique({
        where: { id: userId },
        select: {
          email: true,
          rol: { select: { nombre: true } },
          permisosCuenta: { select: { permiso: true, otorgado: true } },
        }
      })
      if (!objetivo) return { tipo: "no_encontrado" }

      // 06_UI_UX.md §F — sin escalada por cuenta intermedia (revisión 2026-09-25):
      // repetido aquí con la fila recién leída por esta transacción; autoritativo
      // frente al pre-chequeo de arriba.
      if (admin.rol.nombre !== "Admin" && objetivo.rol.nombre === "Admin") {
        return { tipo: "escalada", mensaje: "Solo un Admin puede eliminar cuentas Admin" }
      }

      // 06_UI_UX.md §F — anti-escalación extendida a borrado de cuenta (I-1,
      // revisión de cierre 2026-09-25): eliminar una cuenta que gestiona
      // usuarios (por rol o por excepción) es equivalente a quitarle
      // usuarios.gestionar — reservado a un Admin, igual que en el PUT de
      // permisos y en el cambio de rol de arriba.
      if (admin.rol.nombre !== "Admin") {
        const efectivos = permisosEfectivos(objetivo.rol.nombre, objetivo.permisosCuenta)
        if (efectivos.has("usuarios.gestionar")) {
          return { tipo: "escalada", mensaje: "Solo un Admin puede eliminar una cuenta que gestiona usuarios" }
        }
      }

      await tx.usuario.delete({ where: { id: userId } })
      await tx.auditoriaCuenta.create({
        data: {
          accion: "cuenta_eliminada",
          adminId: admin.id,
          adminEmail: admin.email,
          objetivoId: userId,
          objetivoEmail: objetivo.email,
          valorAnterior: objetivo.rol.nombre,
          valorNuevo: null
        }
      })
      return { tipo: "ok" }
    })

    if (resultado.tipo === "no_encontrado") {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }
    if (resultado.tipo === "escalada") {
      return NextResponse.json({ error: resultado.mensaje }, { status: 403 })
    }

    return NextResponse.json({ message: "Usuario eliminado" })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        { error: "No se puede eliminar: el usuario tiene reportes asociados" },
        { status: 409 }
      )
    }
    console.error("Error deleting user:", error)
    return NextResponse.json({ error: "Error al eliminar usuario" }, { status: 500 })
  }
}

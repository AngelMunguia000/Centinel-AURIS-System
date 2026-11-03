import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../lib/prisma"
import { requirePermiso } from "@/lib/auth"
import { PRIORIDADES, CATEGORIAS, esPrioridad, esCategoria } from "@/lib/reportes-catalogos"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { MOTIVOS_CIERRE, esMotivo } from "@/lib/respuesta"

// SEC-L1 (auditoría 26 ago): mismo criterio que POST /api/reportes — límite alto
// porque resolver/reclasificar en la cola del Operador es una acción legítima
// de uso frecuente, no un intento de login.
const MAX_ATTEMPTS_REPORTES = 60

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  const id = idParam ? Number(idParam) : NaN

  if (!idParam || Number.isNaN(id)) {
    return NextResponse.json({ error: "ID de reporte inválido" }, { status: 400 })
  }

  // 06_UI_UX.md §F: basta con tener alguna de las 3 acciones; cada campo del
  // body se vuelve a verificar abajo contra su permiso concreto.
  const { authorized, usuario, reason } = await requirePermiso(request.cookies, [
    "reportes.resolver",
    "reportes.reclasificar",
    "reportes.asignar",
  ])
  if (!authorized) {
    return NextResponse.json(
      { error: reason === "no_autenticado" ? "No autenticado" : "No autorizado" },
      { status: reason === "no_autenticado" ? 401 : 403 }
    )
  }

  const rateLimitId = getRateLimitIdentifier("reportes-reclasificar", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId, MAX_ATTEMPTS_REPORTES)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  recordAttempt(rateLimitId)

  // 06_UI_UX.md §B: se necesita el estado ANTES de escribir, para poder
  // registrar qué cambió realmente (no solo qué se envió) en el historial.
  // De paso, ahora hay un 404 real si el reporte no existe — antes solo el
  // bloque de asignación lo verificaba; el resto caía al catch genérico (500).
  const reporteAntes = await prisma.reporte.findUnique({
    where: { id },
    select: {
      estado: true,
      prioridad: true,
      categoria: true,
      operadorAsignadoId: true,
      operadorAsignado: { select: { nombre: true } },
      usuarioId: true,
      atendidoEn: true,
    },
  })
  if (!reporteAntes) {
    return NextResponse.json({ error: "Reporte no encontrado" }, { status: 404 })
  }

  // Spec §4.7: acción ≠ visibilidad — sin reportes.ver_todos solo se actúa
  // sobre los reportes propios (mismo 403 que comentarios/historial).
  if (!usuario.permisos.has("reportes.ver_todos") && reporteAntes.usuarioId !== usuario.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  // Sin cuerpo (o vacío): comportamiento original, sin cambios — marca la Incidencia como resuelta.
  const body = await request.text().then((text) => (text ? JSON.parse(text) : {}))
  const { prioridad, categoria, resolver, operadorAsignadoId, atender, motivoCierre } = body as {
    prioridad?: unknown
    categoria?: unknown
    resolver?: unknown
    operadorAsignadoId?: unknown
    atender?: unknown
    motivoCierre?: unknown
  }
  const esReclasificacion = prioridad !== undefined || categoria !== undefined
  const esAsignacion = operadorAsignadoId !== undefined
  // Respuesta a alarmas (lib/respuesta.ts): acusar recibo es su propia Acción, no resuelve.
  // Lo puede hacer quien puede resolver. motivoCierre acompaña a la resolución.
  const esAtencion = atender === true
  if (esAtencion && !usuario.permisos.has("reportes.resolver")) {
    return NextResponse.json({ error: "No tienes permiso para atender reportes" }, { status: 403 })
  }
  if (motivoCierre !== undefined && !esMotivo(motivoCierre)) {
    return NextResponse.json(
      { error: `Motivo de cierre inválido. Valores permitidos: ${MOTIVOS_CIERRE.join(", ")}` },
      { status: 400 }
    )
  }
  // Fase 39: `resolver: true` es opcional y aditivo — permite resolver y reclasificar en
  // la misma llamada. Sin él, el comportamiento es idéntico al de antes: cuerpo vacío (sin
  // prioridad/categoria/operadorAsignadoId) resuelve; cuerpo con prioridad/categoria solo
  // reclasifica. 06_UI_UX.md §E (2026-09-18): asignar un Operador tampoco resuelve por sí
  // solo — es su propia Acción, igual de aditiva que reclasificar.
  const debeResolver = resolver === true || (!esReclasificacion && !esAsignacion && !esAtencion)
  const yaResuelto = reporteAntes.estado === "resuelto"
  const acusaAhora = esAtencion && !reporteAntes.atendidoEn && !yaResuelto
  const ahora = new Date()

  if (debeResolver && !usuario.permisos.has("reportes.resolver")) {
    return NextResponse.json({ error: "No tienes permiso para resolver reportes" }, { status: 403 })
  }
  if (esReclasificacion && !usuario.permisos.has("reportes.reclasificar")) {
    return NextResponse.json({ error: "No tienes permiso para reclasificar reportes" }, { status: 403 })
  }

  if (prioridad !== undefined && !esPrioridad(prioridad)) {
    return NextResponse.json(
      { error: `Prioridad inválida. Valores permitidos: ${PRIORIDADES.join(", ")}` },
      { status: 400 }
    )
  }

  if (categoria !== undefined && categoria !== null && !esCategoria(categoria)) {
    return NextResponse.json(
      { error: `Categoría inválida. Valores permitidos: ${CATEGORIAS.join(", ")}` },
      { status: 400 }
    )
  }

  // 06_UI_UX.md §E: requiere reportes.asignar, por defecto solo Admin — 06_UI_UX.md §F.
  let operadorNuevoNombre: string | null = null
  if (esAsignacion) {
    if (!usuario.permisos.has("reportes.asignar")) {
      return NextResponse.json({ error: "No tienes permiso para asignar reportes" }, { status: 403 })
    }
    if (operadorAsignadoId !== null && typeof operadorAsignadoId !== "number") {
      return NextResponse.json({ error: "operadorAsignadoId inválido" }, { status: 400 })
    }
    if (operadorAsignadoId !== null) {
      const operador = await prisma.usuario.findUnique({
        where: { id: operadorAsignadoId },
        include: { rol: true },
      })
      if (!operador || operador.rol.nombre !== "Operador") {
        return NextResponse.json(
          { error: "El usuario indicado no existe o no tiene Rol Operador" },
          { status: 400 }
        )
      }
      operadorNuevoNombre = operador.nombre
    }
  }

  try {
    const reporte = await prisma.reporte.update({
      where: { id },
      data: {
        ...(prioridad !== undefined ? { prioridad } : {}),
        ...(categoria !== undefined ? { categoria } : {}),
        ...(esAsignacion ? { operadorAsignadoId: operadorAsignadoId as number | null } : {}),
        ...(debeResolver ? { estado: 'resuelto', resueltoPorId: usuario.id } : {}),
        ...(debeResolver && !yaResuelto ? { resueltoEn: ahora } : {}),
        ...(debeResolver && motivoCierre !== undefined ? { motivoCierre: motivoCierre as string } : {}),
        ...(acusaAhora ? { atendidoEn: ahora, atendidoPorId: usuario.id } : {}),
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true
          }
        },
        resueltoPor: {
          select: {
            nombre: true,
            email: true
          }
        },
        operadorAsignado: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        },
        atendidoPor: { select: { nombre: true } },
      }
    })

    // 06_UI_UX.md §B: un registro por campo que realmente cambió — comparado
    // contra reporteAntes, no contra lo que llegó en el body (evita registrar
    // "cambios" cuando el valor enviado es igual al que ya tenía).
    const historialEntradas: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = []
    if (prioridad !== undefined && prioridad !== reporteAntes.prioridad) {
      historialEntradas.push({ campo: "prioridad", valorAnterior: reporteAntes.prioridad, valorNuevo: prioridad })
    }
    if (categoria !== undefined && categoria !== reporteAntes.categoria) {
      historialEntradas.push({ campo: "categoria", valorAnterior: reporteAntes.categoria, valorNuevo: categoria })
    }
    if (debeResolver && reporteAntes.estado !== 'resuelto') {
      historialEntradas.push({ campo: "estado", valorAnterior: reporteAntes.estado, valorNuevo: "resuelto" })
    }
    if (debeResolver && motivoCierre !== undefined && !yaResuelto) {
      historialEntradas.push({ campo: "motivoCierre", valorAnterior: null, valorNuevo: motivoCierre as string })
    }
    if (acusaAhora) {
      historialEntradas.push({ campo: "atencion", valorAnterior: null, valorNuevo: usuario.nombre })
    }
    if (esAsignacion && operadorAsignadoId !== reporteAntes.operadorAsignadoId) {
      historialEntradas.push({
        campo: "operadorAsignado",
        valorAnterior: reporteAntes.operadorAsignado?.nombre ?? null,
        valorNuevo: operadorNuevoNombre,
      })
    }
    if (historialEntradas.length > 0) {
      await prisma.historialReporte.createMany({
        data: historialEntradas.map((entrada) => ({
          reporteId: id,
          autorId: usuario.id,
          campo: entrada.campo,
          valorAnterior: entrada.valorAnterior,
          valorNuevo: entrada.valorNuevo,
        })),
      })
    }

    // 06_UI_UX.md §G: notificar solo en una asignación real y nueva — no en
    // desasignar (null) ni en volver a guardar el mismo Operador (evita
    // duplicados si el Admin reenvía el mismo valor).
    if (
      esAsignacion &&
      operadorAsignadoId !== null &&
      operadorAsignadoId !== reporteAntes.operadorAsignadoId
    ) {
      await prisma.notificacion.create({
        data: {
          destinatarioId: operadorAsignadoId as number,
          mensaje: `Se te asignó el reporte "${reporte.titulo}"`,
          reporteId: id,
        },
      })
    }

    return NextResponse.json(reporte)
  } catch (error) {
    console.error('Error updating reporte:', error)
    return NextResponse.json({ error: 'Error al actualizar el reporte' }, { status: 500 })
  }
}

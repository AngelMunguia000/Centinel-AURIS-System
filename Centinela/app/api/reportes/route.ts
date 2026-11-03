import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { PRIORIDADES, CATEGORIAS, DEFAULT_PRIORIDAD } from "@/lib/reportes-catalogos"
import { checkRateLimit, recordAttempt, getRateLimitIdentifier } from "@/lib/rate-limit"
import { parseFiltrosReportes, construirWhereReportes, filtrarPorBusqueda } from "@/lib/reportes-filtros"

// SEC-L1 (auditoría 26 ago): ya requiere autenticación, pero sin límite una
// cuenta Usuario podía crear reportes sin tope vía script. 60/15min (vs. el
// default de 5) porque es una acción legítima de uso frecuente, no un intento
// de login — el límite es para bloquear scripts, no para estorbar el uso normal.
const MAX_ATTEMPTS_REPORTES = 60

export async function POST(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    )
  }

  const rateLimitId = getRateLimitIdentifier("reportes-crear", request, String(usuario.id))
  const rateLimit = checkRateLimit(rateLimitId, MAX_ATTEMPTS_REPORTES)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo más tarde." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    )
  }
  recordAttempt(rateLimitId)

  const body = await request.json()
  const { titulo, descripcion, prioridad, categoria } = body

  if (!titulo || !descripcion) {
    return NextResponse.json(
      { error: "Título y descripción son requeridos" },
      { status: 400 }
    )
  }

  if (prioridad !== undefined && !PRIORIDADES.includes(prioridad)) {
    return NextResponse.json(
      { error: `Prioridad inválida. Valores permitidos: ${PRIORIDADES.join(", ")}` },
      { status: 400 }
    )
  }

  if (categoria !== undefined && categoria !== null && !CATEGORIAS.includes(categoria)) {
    return NextResponse.json(
      { error: `Categoría inválida. Valores permitidos: ${CATEGORIAS.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const reporte = await prisma.reporte.create({
      data: {
        titulo,
        descripcion,
        usuarioId: usuario.id,
        estado: "pendiente",
        prioridad: prioridad ?? DEFAULT_PRIORIDAD,
        categoria: categoria ?? null,
      },
      include: {
        usuario: {
          select: {
            nombre: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(reporte, { status: 201 })
  } catch (error) {
    console.error("Error creating reporte:", error)
    return NextResponse.json({ error: "Error al crear el reporte" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)

  if (!usuario) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    )
  }

  // 06_UI_UX.md §D: la cola del Operador (y el resto de consumidores de este
  // endpoint) puede filtrar/buscar, en vez del `orderBy` fijo de antes. Sin
  // parámetros, el comportamiento es idéntico al de siempre — compatible con
  // ReportesList.tsx y OperadorAlertaModal.tsx, que no los envían.
  const { searchParams } = new URL(request.url)
  const resultado = parseFiltrosReportes(searchParams)
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 })
  }
  const filtros = resultado.filtros

  try {
    const reportes = await prisma.reporte.findMany({
      where: construirWhereReportes(usuario, filtros),
      include: {
        usuario: {
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
        evento: { select: { evidencia: true } },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(filtrarPorBusqueda(reportes, filtros.busqueda))
  } catch (error) {
    console.error("Error fetching reportes:", error)
    return NextResponse.json({ error: "Error al obtener reportes" }, { status: 500 })
  }
}

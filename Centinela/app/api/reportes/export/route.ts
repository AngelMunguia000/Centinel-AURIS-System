import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthenticatedUsuario } from "@/lib/auth"
import { parseFiltrosReportes, construirWhereReportes, filtrarPorBusqueda } from "@/lib/reportes-filtros"

// 06_UI_UX.md §H: exportar reportes a CSV. Misma visibilidad/filtros que
// GET /api/reportes (mismo lib/reportes-filtros.ts) — el CSV siempre coincide
// con lo que la UI está mostrando en ese momento, filtros incluidos.
function csvEscape(valor: string): string {
  if (/[",\n\r]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`
  }
  return valor
}

export async function GET(request: NextRequest) {
  const usuario = await getAuthenticatedUsuario(request.cookies)
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

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
        usuario: { select: { nombre: true, email: true } },
        operadorAsignado: { select: { nombre: true, email: true } },
        resueltoPor: { select: { nombre: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    const filtrados = filtrarPorBusqueda(reportes, filtros.busqueda)

    const encabezados = [
      "ID", "Título", "Descripción", "Estado", "Prioridad", "Categoría",
      "Reportado por", "Email de quien reporta", "Asignado a", "Resuelto por",
      "Fecha de creación"
    ]
    const filas = filtrados.map((r) => [
      String(r.id),
      r.titulo,
      r.descripcion,
      r.estado,
      r.prioridad,
      r.categoria ?? "",
      r.usuario.nombre,
      r.usuario.email,
      r.operadorAsignado?.nombre ?? "",
      r.resueltoPor?.nombre ?? "",
      r.createdAt.toISOString()
    ])

    // BOM UTF-8: sin él, Excel en Windows abre acentos/ñ mal codificados.
    const bom = "﻿"
    const csv = bom + [encabezados, ...filas].map((fila) => fila.map(csvEscape).join(",")).join("\r\n")
    const fecha = new Date().toISOString().slice(0, 10)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reportes-${fecha}.csv"`
      }
    })
  } catch (error) {
    console.error("Error exporting reportes:", error)
    return NextResponse.json({ error: "Error al exportar reportes" }, { status: 500 })
  }
}

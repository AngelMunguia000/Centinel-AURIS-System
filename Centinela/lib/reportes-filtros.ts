import { Prisma } from "@prisma/client"
import { PRIORIDADES, CATEGORIAS, esPrioridad, esCategoria } from "./reportes-catalogos"
import type { Permiso } from "@/lib/permisos"

// Compartido por GET /api/reportes y GET /api/reportes/export (06_UI_UX.md §D,
// §H): mismos filtros de estado/prioridad/categoria/asignado/q, misma regla de
// visibilidad por Rol — para que exportar siempre coincida exactamente con lo
// que la UI está mostrando en ese momento, sin reimplementar la lógica dos veces.
export const ESTADOS = ["pendiente", "resuelto"] as const
export function esEstado(valor: unknown): valor is (typeof ESTADOS)[number] {
  return typeof valor === "string" && (ESTADOS as readonly string[]).includes(valor)
}

export interface FiltrosReportes {
  estado: string | null
  prioridad: string | null
  categoria: string | null
  asignado: "mi" | "sin-asignar" | null
  busqueda: string
}

export type ParseFiltrosResult =
  | { ok: true; filtros: FiltrosReportes }
  | { ok: false; error: string }

export function parseFiltrosReportes(searchParams: URLSearchParams): ParseFiltrosResult {
  const estado = searchParams.get("estado")
  const prioridad = searchParams.get("prioridad")
  const categoria = searchParams.get("categoria")
  const asignado = searchParams.get("asignado")
  const busqueda = searchParams.get("q")?.trim() ?? ""

  if (estado !== null && !esEstado(estado)) {
    return { ok: false, error: `Estado inválido. Valores permitidos: ${ESTADOS.join(", ")}` }
  }
  if (prioridad !== null && !esPrioridad(prioridad)) {
    return { ok: false, error: `Prioridad inválida. Valores permitidos: ${PRIORIDADES.join(", ")}` }
  }
  if (categoria !== null && !esCategoria(categoria)) {
    return { ok: false, error: `Categoría inválida. Valores permitidos: ${CATEGORIAS.join(", ")}` }
  }
  if (asignado !== null && asignado !== "mi" && asignado !== "sin-asignar") {
    return { ok: false, error: "Filtro de asignación inválido. Valores permitidos: mi, sin-asignar" }
  }

  return {
    ok: true,
    filtros: { estado, prioridad, categoria, asignado: asignado as "mi" | "sin-asignar" | null, busqueda }
  }
}

export function construirWhereReportes(
  usuario: { id: number; permisos: Set<Permiso> },
  filtros: FiltrosReportes
): Prisma.ReporteWhereInput {
  // 06_UI_UX.md §F: antes era "Admin u Operador"; ahora el permiso reportes.ver_todos.
  const esVisibilidadAmplia = usuario.permisos.has("reportes.ver_todos")
  return {
    ...(esVisibilidadAmplia ? {} : { usuarioId: usuario.id }),
    ...(filtros.estado ? { estado: filtros.estado } : {}),
    ...(filtros.prioridad ? { prioridad: filtros.prioridad } : {}),
    ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
    ...(filtros.asignado === "mi" ? { operadorAsignadoId: usuario.id } : {}),
    ...(filtros.asignado === "sin-asignar" ? { operadorAsignadoId: null } : {}),
  }
}

// Búsqueda en memoria, no vía `contains` de Prisma: SQLite no soporta
// `mode: "insensitive"` (solo Postgres) y sin eso `contains` distingue
// mayúsculas/minúsculas — el dataset es chico, filtrar aquí es correcto y
// más simple que un LIKE crudo.
export function filtrarPorBusqueda<T extends { titulo: string; descripcion: string }>(
  reportes: T[],
  busqueda: string
): T[] {
  if (!busqueda) return reportes
  const texto = busqueda.toLowerCase()
  return reportes.filter((r) => r.titulo.toLowerCase().includes(texto) || r.descripcion.toLowerCase().includes(texto))
}

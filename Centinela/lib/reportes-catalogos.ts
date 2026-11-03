/**
 * Catálogos de Prioridad y Categoría de Incidencia (15§4.2, 16§4.2).
 * Adoptados por decisión explícita del Product Owner en la Fase 20 — ningún valor
 * concreto estaba evidenciado en Brain/11–21 antes de esta decisión (ver Brain/21).
 * Categoría reutiliza el ejemplo ya presente en Brain/04_Database.md §Categorías.
 */
export const PRIORIDADES = ["baja", "media", "alta", "critica"] as const
export type Prioridad = (typeof PRIORIDADES)[number]
export const DEFAULT_PRIORIDAD: Prioridad = "media"

export const CATEGORIAS = ["Hardware", "Software", "Seguridad", "Cuenta"] as const
export type Categoria = (typeof CATEGORIAS)[number]

// Type guards para validar valores de origen externo (body de request) contra
// los catálogos — reemplaza los `as any`/`as string` que había en
// app/api/reportes/[id]/route.ts (DAT-L2, auditoría 26 ago).
export function esPrioridad(valor: unknown): valor is Prioridad {
  return typeof valor === "string" && (PRIORIDADES as readonly string[]).includes(valor)
}

export function esCategoria(valor: unknown): valor is Categoria {
  return typeof valor === "string" && (CATEGORIAS as readonly string[]).includes(valor)
}

export const PRIORIDAD_LABELS: Record<string, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
}

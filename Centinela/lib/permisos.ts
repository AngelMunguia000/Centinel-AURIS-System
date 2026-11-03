// 06_UI_UX.md §F (2026-09-24): permisos granulares DENTRO de los 3 roles —
// decisión del PO que resuelve 15§4.5 (sin roles nuevos). Catálogo y defaults
// viven en código; la DB solo guarda excepciones por cuenta (PermisoCuenta).
// Puro a propósito: sin Prisma ni Next, para poder usarlo en cliente y tests.
// Spec: docs/diseno/2026-09-24-permisos-granulares-design.md

export type RolNombre = "Usuario" | "Admin" | "Operador"

export const PERMISOS = [
  { clave: "reportes.ver_todos", etiqueta: "Ver todos los reportes", descripcion: "Lista, estadísticas, comentarios, historial y CSV de reportes de cualquier cuenta, no solo los propios." },
  { clave: "reportes.resolver", etiqueta: "Resolver reportes", descripcion: "Marcar un reporte como resuelto." },
  { clave: "reportes.reclasificar", etiqueta: "Reclasificar reportes", descripcion: "Cambiar prioridad y categoría de un reporte." },
  { clave: "reportes.asignar", etiqueta: "Asignar reportes", descripcion: "Asignar o reasignar un reporte a un Operador." },
  { clave: "usuarios.gestionar", etiqueta: "Gestionar usuarios", descripcion: "Listar cuentas, cambiar roles, eliminar cuentas y ajustar permisos." },
  { clave: "auditoria.ver", etiqueta: "Ver auditoría de cuentas", descripcion: "Consultar el registro de cambios de rol, permisos y cuentas eliminadas." },
  { clave: "dispositivos.propios", etiqueta: "Dispositivos propios", descripcion: "Bitácora, Centro de Dispositivos y Monitor en Vivo de la propia cuenta." },
  { clave: "dispositivos.otros", etiqueta: "Dispositivos de otras cuentas", descripcion: "Ver y gestionar el equipo de cualquier otra cuenta." },
  { clave: "prototipo.ejecutar", etiqueta: "Ejecutar simulación del prototipo", descripcion: "Correr la simulación FSM y limpiar sus datos en /prototipo." },
  { clave: "vision.revisar", etiqueta: "Revisar la detección por cámara", descripcion: "Marcar en las fotos de los nodos si había un ave y ver qué tan bien detecta el modelo, en /vision." },
] as const

export type Permiso = (typeof PERMISOS)[number]["clave"]

export type EstadoPermiso = "defecto" | "otorgado" | "quitado"

const TODOS: readonly Permiso[] = PERMISOS.map((p) => p.clave)

export const PERMISOS_POR_ROL: Record<RolNombre, readonly Permiso[]> = {
  Usuario: ["dispositivos.propios"],
  Operador: ["reportes.ver_todos", "reportes.resolver", "reportes.reclasificar"],
  Admin: TODOS,
}

export function esPermisoValido(clave: string): clave is Permiso {
  return (TODOS as readonly string[]).includes(clave)
}

export function esEstadoPermiso(v: unknown): v is EstadoPermiso {
  return v === "defecto" || v === "otorgado" || v === "quitado"
}

function defaultsDe(rol: string): readonly Permiso[] {
  return Object.prototype.hasOwnProperty.call(PERMISOS_POR_ROL, rol) ? PERMISOS_POR_ROL[rol as RolNombre] : []
}

/**
 * defaults(rol) ∪ otorgados − quitados. Admin: siempre el catálogo completo,
 * ignorando excepciones (spec §4.1) — así nunca se puede dejar el sistema sin
 * alguien capaz de gestionar permisos.
 */
export function permisosEfectivos(
  rol: string,
  excepciones: { permiso: string; otorgado: boolean }[]
): Set<Permiso> {
  if (rol === "Admin") return new Set(TODOS)
  const efectivos = new Set<Permiso>(defaultsDe(rol))
  for (const { permiso, otorgado } of excepciones) {
    if (!esPermisoValido(permiso)) continue
    if (otorgado) efectivos.add(permiso)
    else efectivos.delete(permiso)
  }
  return efectivos
}

export function estadoActual(
  clave: Permiso,
  excepciones: { permiso: string; otorgado: boolean }[]
): EstadoPermiso {
  const fila = excepciones.find((e) => e.permiso === clave)
  if (!fila) return "defecto"
  return fila.otorgado ? "otorgado" : "quitado"
}

/** Otorgar lo que el rol ya trae, o quitar lo que no trae, no es una excepción real. */
export function normalizarEstado(rol: string, clave: Permiso, estado: EstadoPermiso): EstadoPermiso {
  const porDefecto = defaultsDe(rol).includes(clave)
  if (estado === "otorgado" && porDefecto) return "defecto"
  if (estado === "quitado" && !porDefecto) return "defecto"
  return estado
}

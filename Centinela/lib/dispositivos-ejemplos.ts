// Tipos y catálogos del Centro de Dispositivos — el "equipo" de seguridad de
// un Usuario individual (cámaras, sensores, biométricos, etc.), cada Usuario
// tiene el suyo. Los datos en sí viven en la base de datos (modelo
// `Dispositivo` en prisma/schema.prisma) desde el 2 sep 2026 — este archivo
// solo define el shape compartido entre cliente y `/api/dispositivos`.

export type ConexionDispositivo = "ESTABLE" | "ACTIVA" | "LATENCIA" | "DESCONECTADO"

export type TipoDispositivo = "gateway" | "biometrico" | "firewall" | "camara" | "sensor"

export interface Dispositivo {
  id: number
  nombre: string
  uid: string
  tipo: TipoDispositivo
  conexion: ConexionDispositivo
  bateria: number | null // null = conectado a corriente (AC), sin batería
  variableLabel: string | null
  variableValor: string | null
}

export const TIPO_LABEL: Record<TipoDispositivo, string> = {
  gateway: "Gateway",
  biometrico: "Biométrico",
  firewall: "Firewall",
  camara: "Cámara",
  sensor: "Sensor",
}

export const TIPOS_VALIDOS = Object.keys(TIPO_LABEL) as TipoDispositivo[]

export const CONEXIONES_VALIDAS: ConexionDispositivo[] = ["ESTABLE", "ACTIVA", "LATENCIA", "DESCONECTADO"]

// Variable por defecto al crear un dispositivo nuevo del tipo dado (no hay
// telemetría real todavía, así que se inicializa vacía/sin datos).
export const VARIABLE_POR_TIPO: Record<TipoDispositivo, { label: string; valor: string }> = {
  gateway: { label: "Latencia", valor: "— ms" },
  biometrico: { label: "Integridad", valor: "Sin verificar" },
  firewall: { label: "Flujo", valor: "— GB/s" },
  camara: { label: "Señal", valor: "Sin datos" },
  sensor: { label: "Temperatura", valor: "— °C" },
}

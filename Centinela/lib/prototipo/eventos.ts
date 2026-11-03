import type { Categoria, Prioridad } from '@/lib/reportes-catalogos'
import type { ConexionDispositivo } from '@/lib/dispositivos-ejemplos'
import type { CodigoEvento, Estado } from './tipos'

// Datos simulados: el prefijo lo agrega el servidor, nunca el cliente.
export const PREFIJO_SIMULADO = '[SIMULADO]'
export const PREFIJO_UID_SIMULADO = 'SIM-'

// El uid de Dispositivo es único en toda la BD: lleva el id del Admin que simula.
export const uidDispositivoSimulado = (adminId: number) => `${PREFIJO_UID_SIMULADO}CENTINEL-${adminId}`

export const CODIGOS_EVENTO: readonly CodigoEvento[] = [
  'persistencia_objetivo',
  'broker_caido',
  'sobrecorriente',
  'fault',
]

export interface DefEvento {
  titulo: string
  descripcion: string
  prioridad: Prioridad
  categoria: Categoria
  severidad: 'S2' | 'S3' | 'S4' // PDF §9.1
}

export const EVENTOS: Record<CodigoEvento, DefEvento> = {
  persistencia_objetivo: {
    titulo: 'Persistencia del objetivo tras 3 intentos',
    descripcion: 'El ave permaneció en la zona protegida tras tres ráfagas con patrones distintos.',
    prioridad: 'alta',
    categoria: 'Seguridad',
    severidad: 'S3',
  },
  broker_caido: {
    titulo: 'Pérdida del broker MQTT: nodo en modo autónomo',
    descripcion: 'Sin heartbeat durante 10 s. El nodo aplicó reglas locales (home + MUTE) y sigue reintentando.',
    prioridad: 'media',
    categoria: 'Hardware',
    severidad: 'S2',
  },
  sobrecorriente: {
    titulo: 'Sobrecorriente en el riel de audio',
    descripcion: 'El INA219 midió más de 1.3 A. El amplificador quedó silenciado (SAFE_MUTE) durante 30 s.',
    prioridad: 'alta',
    categoria: 'Hardware',
    severidad: 'S3',
  },
  fault: {
    titulo: 'Falla del prototipo: tercera sobrecorriente en 10 minutos',
    descripcion: 'El nodo entró en FAULT y requiere intervención técnica antes de volver a operar.',
    prioridad: 'critica',
    categoria: 'Hardware',
    severidad: 'S4',
  },
}

export function esCodigoEvento(valor: unknown): valor is CodigoEvento {
  return typeof valor === 'string' && (CODIGOS_EVENTO as readonly string[]).includes(valor)
}

// Estado de la FSM → conexión del Dispositivo en el Centro de Dispositivos.
export function conexionDe(estado: Estado): ConexionDispositivo {
  switch (estado) {
    case 'DETERRING':
      return 'ACTIVA'
    case 'SAFE_MUTE':
      return 'LATENCIA'
    case 'AUTONOMOUS':
    case 'FAULT':
      return 'DESCONECTADO'
    default:
      return 'ESTABLE'
  }
}

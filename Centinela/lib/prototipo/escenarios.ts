import { C } from './constantes'
import { estadoInicial, step } from './fsm'
import { crearRng } from './rng'
import type { Contexto, Efecto, Entrada, Estado, FsmState, Marco } from './tipos'

export type EscenarioId = 'ave_real' | 'ave_persistente' | 'falsa_alarma' | 'caida_broker' | 'sobrecorriente'

// Un guion decide la entrada de cada paso a partir del estado actual de la FSM.
// Devuelve null cuando el escenario terminó. Cada ejecución crea su propio guion
// (`crear`) para que pueda llevar memoria (p. ej. "el ave ya se fue").
export type Guion = (s: FsmState, i: number) => Omit<Entrada, 'dtMs'> | null

export interface Escenario {
  id: EscenarioId
  nombre: string
  descripcion: string
  crear: () => Guion
}

// Pasos de arranque (BOOT + SELFTEST = 1 s a 100 ms por paso).
const INICIO = 10
const AVE_MUNDO = { pan: 120, tilt: 10 }

// Marco de visión de un ave fija en el mundo: el error depende de hacia dónde apunta la torreta.
export function marcoHacia(s: FsmState, obj: { pan: number; tilt: number }, o: Partial<Marco> = {}): Marco {
  return { conf: 0.8, desplazamiento: 0.05, panErr: obj.pan - s.pan, tiltErr: obj.tilt - s.tilt, ...o }
}

const terminado = (s: FsmState, i: number) => i > INICIO + 2 && s.estado === 'IDLE'

export const ESCENARIOS: Escenario[] = [
  {
    id: 'ave_real',
    nombre: 'Ave real',
    descripcion: 'Un ave entra al campo, se apunta, se confirma, se emite una ráfaga y el ave se va.',
    crear: () => {
      let fuera = false
      return (s, i) => {
        if (i < INICIO) return {}
        if (terminado(s, i)) return null
        if (s.estado === 'DETERRING' && s.sub === 'PAUSA') fuera = true
        return { presencia: i === INICIO, marco: fuera ? null : marcoHacia(s, AVE_MUNDO) }
      }
    },
  },
  {
    id: 'ave_persistente',
    nombre: 'Ave persistente',
    descripcion: 'El ave no se va: 3 intentos con patrones distintos y una alerta de persistencia.',
    crear: () => (s, i) => {
      if (i < INICIO) return {}
      if (terminado(s, i)) return null
      return { presencia: i === INICIO, marco: marcoHacia(s, AVE_MUNDO) }
    },
  },
  {
    id: 'falsa_alarma',
    nombre: 'Falsa alarma (viento)',
    descripcion: 'El sensor dispara y una detección débil aparece un instante; se descarta sin emitir.',
    crear: () => (s, i) => {
      if (i < INICIO) return {}
      if (terminado(s, i)) return null
      return i === INICIO
        ? { presencia: true, marco: marcoHacia(s, AVE_MUNDO, { conf: 0.6 }) }
        : { marco: null }
    },
  },
  {
    id: 'caida_broker',
    nombre: 'Caída del broker',
    descripcion: 'Se pierde el heartbeat 10 s: el nodo pasa a modo autónomo (home + MUTE) y luego se recupera.',
    crear: () => (s, i) => {
      if (i < INICIO) return { heartbeatOk: true }
      if (i > 125 && s.estado === 'IDLE') return null
      return { heartbeatOk: i >= 125 }
    },
  },
  {
    id: 'sobrecorriente',
    nombre: 'Sobrecorriente de audio',
    descripcion: 'El riel de audio supera 1.3 A: SAFE_MUTE. A la tercera en 10 minutos, FAULT.',
    crear: () => (s, i) => {
      if (i < INICIO) return {}
      if (s.estado === 'FAULT') return null
      return s.estado === 'IDLE' ? { amperios: 1.5 } : {}
    },
  },
]

export interface Traza {
  estadoFinal: FsmState
  efectos: Efecto[]
  visitados: Estado[]
  pasos: number
}

// Ejecuta un escenario completo de forma síncrona (usado por las pruebas).
export function ejecutarEscenario(esc: Escenario, semilla = 1, maxPasos = 20_000): Traza {
  const ctx: Contexto = { rng: crearRng(semilla) }
  const guion = esc.crear()
  let s = estadoInicial()
  const efectos: Efecto[] = []
  const visitados = new Set<Estado>([s.estado])
  let pasos = 0
  for (; pasos < maxPasos; pasos++) {
    const parcial = guion(s, pasos)
    if (parcial === null) break
    const r = step(s, { dtMs: C.DT_MS, ...parcial }, ctx)
    s = r.estado
    efectos.push(...r.efectos)
    visitados.add(s.estado)
  }
  return { estadoFinal: s, efectos, visitados: [...visitados], pasos }
}

export type Estado =
  | 'BOOT' | 'SELFTEST' | 'IDLE' | 'SCANNING' | 'TRACKING' | 'AIMING'
  | 'CONFIRMING' | 'DETERRING' | 'COOLDOWN' | 'HOMING'
  | 'SAFE_MUTE' | 'AUTONOMOUS' | 'FAULT'

export type SubDeterring = 'RAFAGA' | 'PAUSA'

export type CodigoEvento = 'persistencia_objetivo' | 'broker_caido' | 'sobrecorriente' | 'fault'

export type FamiliaPatron = 'sweep_chirp' | 'sweep_log' | 'tone_am' | 'random_mix' | 'distress'

export interface Patron {
  familia: FamiliaPatron
  duracionMs: number
  gapMs: number
  amRateHz: number
  gain: number
  seed: number
}

// Un marco de visión: errores angulares del ave respecto del centro del encuadre.
export interface Marco {
  conf: number
  panErr: number
  tiltErr: number
  desplazamiento: number // fracción del marco que se movió el centroide
}

// marco: undefined = no llegó marco; null = llegó marco sin ave.
export interface Entrada {
  dtMs: number
  presencia?: boolean
  marco?: Marco | null
  heartbeatOk?: boolean
  amperios?: number
}

export type Efecto =
  | { tipo: 'mover'; pan: number; tilt: number }
  | { tipo: 'audio'; activo: boolean; patron?: Patron }
  | { tipo: 'mqtt'; topico: string; payload: Record<string, unknown> }
  | { tipo: 'persistir'; codigo: CodigoEvento }
  | { tipo: 'registro'; evento: string; detalle?: string }

export interface FsmState {
  estado: Estado
  sub: SubDeterring | null
  enEstadoMs: number
  ahoraMs: number
  pan: number
  tilt: number
  estables: number
  vistoAlgunaVez: boolean
  vaciosSeguidos: number
  sinAveMs: number
  ventana: { total: number; positivos: number; sumaConf: number }
  intentos: number
  audio: boolean
  rafagaMs: number
  patron: Patron | null
  emisiones: { inicioMs: number; duracionMs: number }[]
  historial: Record<number, FamiliaPatron[]>
  sobrecorrientes: number[]
  sinHeartbeatMs: number
}

export interface Contexto {
  rng: () => number
}

export interface Resultado {
  estado: FsmState
  efectos: Efecto[]
}

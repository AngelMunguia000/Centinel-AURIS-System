import { C } from './constantes'
import { elegirPatron, sectorDePan } from './antihabituacion'
import type { Contexto, Efecto, Entrada, Estado, FsmState, Resultado, SubDeterring } from './tipos'

export function estadoInicial(): FsmState {
  return {
    estado: 'BOOT',
    sub: null,
    enEstadoMs: 0,
    ahoraMs: 0,
    pan: C.HOME_PAN,
    tilt: C.HOME_TILT,
    estables: 0,
    vistoAlgunaVez: false,
    vaciosSeguidos: 0,
    sinAveMs: 0,
    ventana: { total: 0, positivos: 0, sumaConf: 0 },
    intentos: 0,
    audio: false,
    rafagaMs: 0,
    patron: null,
    emisiones: [],
    historial: {},
    sobrecorrientes: [],
    sinHeartbeatMs: 0,
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Estados en los que se descarta el objetivo y el conteo de intentos.
const REINICIAN: Estado[] = ['IDLE', 'HOMING', 'SAFE_MUTE', 'AUTONOMOUS', 'FAULT']

// Única puerta de cambio de estado. Garantiza estructuralmente el invariante de
// seguridad: el audio solo puede seguir encendido en DETERRING/RAFAGA.
function entrar(n: FsmState, ef: Efecto[], estado: Estado, sub: SubDeterring | null = null): void {
  n.estado = estado
  n.sub = sub
  n.enEstadoMs = 0
  const emitiendo = estado === 'DETERRING' && sub === 'RAFAGA'
  if (n.audio && !emitiendo) {
    n.audio = false
    ef.push({ tipo: 'audio', activo: false })
    ef.push({ tipo: 'mqtt', topico: 'centinel/command/audio', payload: { activo: false } })
  }
  if (REINICIAN.includes(estado)) {
    n.estables = 0
    n.vistoAlgunaVez = false
    n.vaciosSeguidos = 0
    n.ventana = { total: 0, positivos: 0, sumaConf: 0 }
    n.intentos = 0
    n.patron = null
    n.rafagaMs = 0
  }
  ef.push({ tipo: 'mqtt', topico: 'centinel/telemetry', payload: { estado, sub } })
}

function fijarHome(n: FsmState, ef: Efecto[]): void {
  n.pan = C.HOME_PAN
  n.tilt = C.HOME_TILT
  ef.push({ tipo: 'mover', pan: n.pan, tilt: n.tilt })
}

function volverAHome(n: FsmState, ef: Efecto[]): void {
  fijarHome(n, ef)
  entrar(n, ef, 'HOMING')
}

function escanear(n: FsmState, ef: Efecto[], hayMarco: boolean, ave: boolean): void {
  if (ave) {
    n.estables += 1
    n.vistoAlgunaVez = true
    n.vaciosSeguidos = 0
    if (n.estables >= C.MARCOS_ESTABLES) {
      entrar(n, ef, 'TRACKING')
      return
    }
  } else {
    n.estables = 0
    if (hayMarco && n.vistoAlgunaVez) {
      n.vaciosSeguidos += 1
      if (n.vaciosSeguidos >= C.FRAMES_VACIOS_DESCARTE) {
        ef.push({ tipo: 'registro', evento: 'falsa_alarma' })
        entrar(n, ef, 'IDLE')
        return
      }
    }
  }
  if (n.enEstadoMs >= C.REPOSO_MS) entrar(n, ef, 'IDLE')
}

function iniciarRafaga(n: FsmState, ef: Efecto[], ctx: Contexto): void {
  const sector = sectorDePan(n.pan)
  const previo = n.historial[sector] ?? []
  const patron = elegirPatron(previo, ctx.rng)
  n.historial[sector] = [...previo, patron.familia].slice(-C.HISTORIAL_POR_SECTOR)

  n.emisiones = n.emisiones.filter((x) => n.ahoraMs - x.inicioMs < C.VENTANA_CICLO_MS)
  const usado = n.emisiones.reduce((a, x) => a + x.duracionMs, 0)
  const restante = C.CICLO_TRABAJO_MAX * C.VENTANA_CICLO_MS - usado
  const dur = Math.min(patron.duracionMs, C.RAFAGA_MAX_MS, restante)

  if (dur < C.RAFAGA_MIN_MS) {
    ef.push({ tipo: 'registro', evento: 'ciclo_trabajo_excedido' })
    entrar(n, ef, 'COOLDOWN')
    return
  }

  n.patron = { ...patron, duracionMs: dur }
  n.rafagaMs = dur
  n.emisiones.push({ inicioMs: n.ahoraMs, duracionMs: dur })
  n.audio = true
  entrar(n, ef, 'DETERRING', 'RAFAGA')
  ef.push({ tipo: 'audio', activo: true, patron: n.patron })
  ef.push({ tipo: 'mqtt', topico: 'centinel/command/audio', payload: { activo: true, ...n.patron } })
}

export function step(s: FsmState, e: Entrada, ctx: Contexto): Resultado {
  const n: FsmState = {
    ...s,
    ventana: { ...s.ventana },
    emisiones: [...s.emisiones],
    historial: { ...s.historial },
    sobrecorrientes: [...s.sobrecorrientes],
  }
  const ef: Efecto[] = []
  n.ahoraMs += e.dtMs
  n.enEstadoMs += e.dtMs

  if (n.estado === 'FAULT') return { estado: n, efectos: ef }

  const m = e.marco ?? null
  const hayMarco = e.marco !== undefined
  const ave = m !== null && m.conf >= C.CONF_DETECCION
  n.sinAveMs = ave ? 0 : n.sinAveMs + e.dtMs

  // Heartbeat con el broker (PDF §4.5.1): sin señal 10 s → modo autónomo.
  if (e.heartbeatOk === false) n.sinHeartbeatMs += e.dtMs
  else if (e.heartbeatOk === true) n.sinHeartbeatMs = 0

  if (n.estado === 'AUTONOMOUS') {
    if (e.heartbeatOk === true) {
      ef.push({ tipo: 'registro', evento: 'broker_restablecido' })
      volverAHome(n, ef)
    }
    return { estado: n, efectos: ef }
  }

  if (n.estado !== 'BOOT' && n.estado !== 'SELFTEST') {
    if (n.sinHeartbeatMs >= C.HEARTBEAT_TIMEOUT_MS) {
      fijarHome(n, ef)
      entrar(n, ef, 'AUTONOMOUS')
      ef.push({ tipo: 'persistir', codigo: 'broker_caido' })
      return { estado: n, efectos: ef }
    }

    // Sobrecorriente del riel de audio (PDF §9.2 F-05): corte a > 1.3 A.
    if (e.amperios !== undefined && e.amperios > C.CORRIENTE_CORTE_A && n.estado !== 'SAFE_MUTE') {
      n.sobrecorrientes = [
        ...n.sobrecorrientes.filter((t) => n.ahoraMs - t < C.SOBRECORRIENTE_VENTANA_MS),
        n.ahoraMs,
      ]
      if (n.sobrecorrientes.length >= C.SOBRECORRIENTE_MAX) {
        entrar(n, ef, 'FAULT')
        ef.push({ tipo: 'persistir', codigo: 'fault' })
      } else {
        entrar(n, ef, 'SAFE_MUTE')
        ef.push({ tipo: 'persistir', codigo: 'sobrecorriente' })
      }
      return { estado: n, efectos: ef }
    }
  }

  const actual = n.estado as Estado
  switch (actual) {
    case 'BOOT':
      if (n.enEstadoMs >= C.ARRANQUE_MS) entrar(n, ef, 'SELFTEST')
      break
    case 'SELFTEST':
      if (n.enEstadoMs >= C.ARRANQUE_MS) {
        ef.push({ tipo: 'registro', evento: 'autodiagnostico_ok' })
        entrar(n, ef, 'IDLE')
      }
      break
    case 'IDLE':
      if (e.presencia === true || ave) {
        entrar(n, ef, 'SCANNING')
        escanear(n, ef, hayMarco, ave)
      }
      break
    case 'SCANNING':
      escanear(n, ef, hayMarco, ave)
      break
    case 'TRACKING':
      if (ave) {
        entrar(n, ef, 'AIMING')
      } else if (n.sinAveMs >= C.OBJETIVO_PERDIDO_MS) {
        ef.push({ tipo: 'registro', evento: 'falsa_alarma' })
        volverAHome(n, ef)
      }
      break
    case 'AIMING':
      if (n.sinAveMs >= C.OBJETIVO_PERDIDO_MS) {
        ef.push({ tipo: 'registro', evento: 'objetivo_perdido' })
        volverAHome(n, ef)
      } else if (n.enEstadoMs >= C.APUNTADO_MAX_MS) {
        ef.push({ tipo: 'registro', evento: 'apuntado_fallido' })
        volverAHome(n, ef)
      } else if (ave && m) {
        if (Math.abs(m.panErr) <= C.DEADBAND_DEG && Math.abs(m.tiltErr) <= C.DEADBAND_DEG) {
          entrar(n, ef, 'CONFIRMING')
        } else {
          n.pan = clamp(n.pan + m.panErr * C.GANANCIA_APUNTADO, C.PAN_MIN, C.PAN_MAX)
          n.tilt = clamp(n.tilt + m.tiltErr * C.GANANCIA_APUNTADO, C.TILT_MIN, C.TILT_MAX)
          ef.push({ tipo: 'mover', pan: n.pan, tilt: n.tilt })
          ef.push({
            tipo: 'mqtt',
            topico: 'centinel/command/pantilt',
            payload: { mode: 'relative', ease: 'cosine', pan: n.pan, tilt: n.tilt },
          })
        }
      }
      break
    case 'CONFIRMING':
      if (n.sinAveMs >= C.OBJETIVO_PERDIDO_MS) {
        ef.push({ tipo: 'registro', evento: 'falsa_alarma' })
        volverAHome(n, ef)
        break
      }
      if (hayMarco) {
        n.ventana.total += 1
        if (ave && m && m.desplazamiento < C.DESPLAZAMIENTO_MAX) {
          n.ventana.positivos += 1
          n.ventana.sumaConf += m.conf
        }
      }
      if (n.ventana.total >= C.VENTANA_CONFIRMACION) {
        const media = n.ventana.positivos > 0 ? n.ventana.sumaConf / n.ventana.positivos : 0
        if (n.ventana.positivos >= C.POSITIVOS_MIN && media >= C.CONF_CONFIRMACION) {
          n.intentos = 1
          iniciarRafaga(n, ef, ctx)
        } else {
          ef.push({ tipo: 'registro', evento: 'confirmacion_fallida' })
          volverAHome(n, ef)
        }
      }
      break
    case 'DETERRING':
      if (n.sub === 'RAFAGA') {
        if (n.enEstadoMs >= n.rafagaMs) entrar(n, ef, 'DETERRING', 'PAUSA')
      } else if (n.sinAveMs >= C.OBJETIVO_PERDIDO_MS) {
        ef.push({ tipo: 'registro', evento: 'disuasion_exitosa' })
        entrar(n, ef, 'COOLDOWN')
      } else if (n.enEstadoMs >= C.ENFRIAMIENTO_MS) {
        if (n.intentos < C.INTENTOS_MAX) {
          n.intentos += 1
          iniciarRafaga(n, ef, ctx)
        } else {
          ef.push({ tipo: 'registro', evento: 'persistencia_objetivo' })
          ef.push({ tipo: 'persistir', codigo: 'persistencia_objetivo' })
          entrar(n, ef, 'COOLDOWN')
        }
      }
      break
    case 'COOLDOWN':
      volverAHome(n, ef)
      break
    case 'HOMING':
      if (n.enEstadoMs >= C.HOMING_MS) entrar(n, ef, 'IDLE')
      break
    case 'SAFE_MUTE':
      if (n.enEstadoMs >= C.SAFE_MUTE_MS) volverAHome(n, ef)
      break
    case 'AUTONOMOUS':
    case 'FAULT':
      break
    default: {
      const inalcanzable: never = actual
      throw new Error(`Estado sin manejar: ${String(inalcanzable)}`)
    }
  }

  return { estado: n, efectos: ef }
}

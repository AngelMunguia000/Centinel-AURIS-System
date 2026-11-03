import { describe, it, expect } from 'vitest'
import { C } from '@/lib/prototipo/constantes'
import { estadoInicial, step } from '@/lib/prototipo/fsm'
import { crearRng } from '@/lib/prototipo/rng'
import type { Efecto, Entrada, Estado, FsmState, Marco } from '@/lib/prototipo/tipos'

const ctx = () => ({ rng: crearRng(123) })
type Parcial = Omit<Entrada, 'dtMs'>

const marco = (o: Partial<Marco> = {}): Marco => ({ conf: 0.8, panErr: 0, tiltErr: 0, desplazamiento: 0.05, ...o })
// Ave en el mundo: el error se calcula contra la orientación actual de la torreta.
const ave = (s: FsmState, obj = { pan: 90, tilt: 0 }, o: Partial<Marco> = {}): Marco =>
  marco({ panErr: obj.pan - s.pan, tiltErr: obj.tilt - s.tilt, ...o })

interface Corrida { s: FsmState; efectos: Efecto[]; visitados: Set<Estado> }

// Avanza pasos de DT_MS hasta que `hasta` sea verdadera (o se agote `max`).
function avanzar(
  s0: FsmState,
  mk: (s: FsmState, i: number) => Parcial,
  hasta: (s: FsmState) => boolean,
  max = 5000,
  c = ctx(),
): Corrida {
  let s = s0
  const efectos: Efecto[] = []
  const visitados = new Set<Estado>([s.estado])
  const violaciones: string[] = []
  for (let i = 0; i < max && !hasta(s); i++) {
    const r = step(s, { dtMs: C.DT_MS, ...mk(s, i) }, c)
    s = r.estado
    efectos.push(...r.efectos)
    visitados.add(s.estado)
    // Invariante de seguridad: el audio solo existe en DETERRING/RAFAGA.
    const emitiendo = s.estado === 'DETERRING' && s.sub === 'RAFAGA'
    if (s.audio !== emitiendo) violaciones.push(`paso ${i}: audio=${s.audio} en ${s.estado}/${s.sub}`)
    if (!emitiendo && audioOn(r.efectos).length > 0) violaciones.push(`paso ${i}: efecto audio activo en ${s.estado}/${s.sub}`)
  }
  expect(violaciones, 'invariante de audio violada').toEqual([])
  return { s, efectos, visitados }
}

const ticks = (s0: FsmState, n: number, p: Parcial | ((s: FsmState) => Parcial), c = ctx()) =>
  avanzar(s0, (s) => (typeof p === 'function' ? p(s) : p), () => false, n, c)

const aIdle = () => ticks(estadoInicial(), 10, {}).s
const audioOn = (ef: Efecto[]) => ef.filter((x) => x.tipo === 'audio' && x.activo)
const registros = (ef: Efecto[], evento: string) => ef.filter((x) => x.tipo === 'registro' && x.evento === evento)

// Lleva la FSM hasta el primer marco de CONFIRMING con el ave en home.
function aConfirming() {
  return avanzar(aIdle(), (s) => ({ presencia: true, marco: ave(s) }), (s) => s.estado === 'CONFIRMING')
}

describe('FSM — arranque y reposo', () => {
  it('BOOT → SELFTEST → IDLE tras 10 pasos, con el audio apagado', () => {
    const s = aIdle()
    expect(s.estado).toBe('IDLE')
    expect(s.audio).toBe(false)
  })
  it('no muta el estado de entrada', () => {
    const s = estadoInicial()
    const copia = JSON.stringify(s)
    step(s, { dtMs: 100 }, ctx())
    expect(JSON.stringify(s)).toBe(copia)
  })
  it('IDLE + presencia → SCANNING', () => {
    expect(step(aIdle(), { dtMs: 100, presencia: true }, ctx()).estado.estado).toBe('SCANNING')
  })
})

describe('FSM — detección', () => {
  it('3 marcos estables pasan a TRACKING; 2 no', () => {
    const s0 = step(aIdle(), { dtMs: 100, presencia: true }, ctx()).estado
    expect(ticks(s0, 2, { marco: marco() }).s.estado).toBe('SCANNING')
    expect(ticks(s0, 3, { marco: marco() }).s.estado).toBe('TRACKING')
  })
  it('un marco con confianza < 0.55 no cuenta', () => {
    const s0 = step(aIdle(), { dtMs: 100, presencia: true }, ctx()).estado
    expect(ticks(s0, 5, { marco: marco({ conf: 0.5 }) }).s.estado).toBe('SCANNING')
  })
  it('un marco sin ave reinicia la racha de estables', () => {
    const s0 = step(aIdle(), { dtMs: 100, presencia: true }, ctx()).estado
    const a = ticks(s0, 2, { marco: marco() }).s
    const b = ticks(a, 1, { marco: null }).s
    expect(ticks(b, 2, { marco: marco() }).s.estado).toBe('SCANNING')
  })
  it('candidato visto y luego perdido 10 marcos → falsa alarma y vuelve a IDLE', () => {
    const s0 = step(aIdle(), { dtMs: 100, presencia: true, marco: marco() }, ctx()).estado
    const r = ticks(s0, 10, { marco: null })
    expect(r.s.estado).toBe('IDLE')
    expect(registros(r.efectos, 'falsa_alarma')).toHaveLength(1)
  })
  it('90 s sin candidato vuelven a IDLE', () => {
    const s0 = step(aIdle(), { dtMs: 100, presencia: true }, ctx()).estado
    expect(ticks(s0, 899, {}).s.estado).toBe('SCANNING')
    expect(ticks(s0, 900, {}).s.estado).toBe('IDLE')
  })
})

describe('FSM — apuntado y confirmación', () => {
  it('apunta a un ave a 30°/10° y llega a CONFIRMING dentro de la zona muerta', () => {
    const obj = { pan: 120, tilt: 10 }
    const r = avanzar(aIdle(), (s) => ({ presencia: true, marco: ave(s, obj) }), (s) => s.estado === 'CONFIRMING')
    expect(r.s.estado).toBe('CONFIRMING')
    expect(Math.abs(obj.pan - r.s.pan)).toBeLessThanOrEqual(C.DEADBAND_DEG)
    expect(Math.abs(obj.tilt - r.s.tilt)).toBeLessThanOrEqual(C.DEADBAND_DEG)
    expect(r.efectos.some((x) => x.tipo === 'mover')).toBe(true)
  })
  it('la torreta nunca sale de sus límites mecánicos (superiores)', () => {
    const obj = { pan: 500, tilt: 500 }
    const r = ticks(aIdle(), 200, (s) => ({ presencia: true, marco: ave(s, obj) }))
    expect(r.s.pan).toBeLessThanOrEqual(C.PAN_MAX)
    expect(r.s.tilt).toBeLessThanOrEqual(C.TILT_MAX)
  })
  it('la torreta nunca sale de sus límites mecánicos (inferiores)', () => {
    const obj = { pan: -500, tilt: -500 }
    const r = ticks(aIdle(), 200, (s) => ({ presencia: true, marco: ave(s, obj) }))
    expect(r.s.pan).toBeGreaterThanOrEqual(C.PAN_MIN)
    expect(r.s.tilt).toBeGreaterThanOrEqual(C.TILT_MIN)
  })
  it('si el apuntado no converge (límite mecánico) se abandona y vuelve a HOMING', () => {
    const obj = { pan: 500, tilt: 500 }
    const r = avanzar(aIdle(), (s) => ({ presencia: true, marco: ave(s, obj) }), (s) => s.estado === 'HOMING', 600)
    expect(r.s.estado).toBe('HOMING')
    expect(registros(r.efectos, 'apuntado_fallido')).toHaveLength(1)
    expect(r.s.pan).toBeLessThanOrEqual(C.PAN_MAX)
    expect(r.s.tilt).toBeLessThanOrEqual(C.TILT_MAX)
  })
  it('20 marcos positivos confirman y disparan la primera ráfaga', () => {
    const r0 = aConfirming()
    const r = avanzar(r0.s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'DETERRING')
    expect(r.s.estado).toBe('DETERRING')
    expect(r.s.sub).toBe('RAFAGA')
    expect(r.s.intentos).toBe(1)
    expect(r.s.audio).toBe(true)
    const on = audioOn(r.efectos)
    expect(on).toHaveLength(1)
    expect(on[0].tipo === 'audio' && on[0].patron?.duracionMs).toBeLessThanOrEqual(C.RAFAGA_MAX_MS)
  })
  it('con < 12 positivos la confirmación falla y no se emite audio', () => {
    const r0 = aConfirming()
    // 10 marcos con el centroide moviéndose demasiado (descarta vehículos/personas en tránsito)
    const r = avanzar(
      r0.s,
      (s, i) => ({ marco: ave(s, undefined, { desplazamiento: i < 10 ? 0.5 : 0.05 }) }),
      (s) => s.estado === 'HOMING',
    )
    expect(r.s.estado).toBe('HOMING')
    expect(audioOn(r.efectos)).toHaveLength(0)
    expect(registros(r.efectos, 'confirmacion_fallida')).toHaveLength(1)
  })
})

describe('FSM — disuasión', () => {
  it('la ráfaga termina, pasa a PAUSA y apaga el audio', () => {
    const r0 = avanzar(aConfirming().s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'DETERRING')
    const r = avanzar(r0.s, (s) => ({ marco: ave(s) }), (s) => s.sub === 'PAUSA')
    expect(r.s.audio).toBe(false)
    expect(r.efectos.some((x) => x.tipo === 'audio' && !x.activo)).toBe(true)
  })
  it('si el ave se va: disuasion_exitosa y termina en IDLE, sin persistir nada', () => {
    const r0 = avanzar(aConfirming().s, (s) => ({ marco: ave(s) }), (s) => s.sub === 'PAUSA')
    const r = avanzar(r0.s, () => ({ marco: null }), (s) => s.estado === 'IDLE')
    expect(r.s.estado).toBe('IDLE')
    expect(registros(r.efectos, 'disuasion_exitosa')).toHaveLength(1)
    expect(r.efectos.some((x) => x.tipo === 'persistir')).toBe(false)
  })
  it('si el ave persiste: 3 intentos con familias distintas y luego persistencia_objetivo', () => {
    const r0 = aConfirming()
    const r = avanzar(r0.s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'IDLE', 20000)
    const on = audioOn(r.efectos)
    expect(on).toHaveLength(3)
    const familias = on.map((x) => (x.tipo === 'audio' ? x.patron?.familia : undefined))
    expect(new Set(familias).size).toBe(3)
    expect(r.efectos.filter((x) => x.tipo === 'persistir' && x.codigo === 'persistencia_objetivo')).toHaveLength(1)
    expect(r.s.estado).toBe('IDLE')
  })
  it('respeta el ciclo de trabajo del 20 %: sin presupuesto no emite y lo registra', () => {
    const r0 = aConfirming()
    const agotado: FsmState = { ...r0.s, emisiones: [{ inicioMs: r0.s.ahoraMs, duracionMs: 12_000 }] }
    const r = avanzar(agotado, (s) => ({ marco: ave(s) }), (s) => s.estado === 'IDLE', 20000)
    expect(audioOn(r.efectos)).toHaveLength(0)
    expect(registros(r.efectos, 'ciclo_trabajo_excedido')).toHaveLength(1)
  })
  it('ciclo completo con ave persistente: audio encendido alguna vez y la invariante se cumple en cada paso', () => {
    // `avanzar` verifica en cada paso audio === (DETERRING && RAFAGA) y falla ante cualquier violación.
    const r = avanzar(aConfirming().s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'IDLE', 20000)
    expect(audioOn(r.efectos).length).toBeGreaterThan(0)
    expect(r.visitados.has('DETERRING')).toBe(true)
    expect(r.visitados.has('IDLE')).toBe(true)
    expect(r.s.audio).toBe(false)
  })
})

describe('FSM — pérdida de heartbeat', () => {
  it('10 s sin heartbeat → AUTONOMOUS con persistencia broker_caido', () => {
    const r = avanzar(aIdle(), () => ({ heartbeatOk: false }), (s) => s.estado === 'AUTONOMOUS')
    expect(r.s.estado).toBe('AUTONOMOUS')
    expect(r.efectos.filter((x) => x.tipo === 'persistir' && x.codigo === 'broker_caido')).toHaveLength(1)
    expect(r.efectos.some((x) => x.tipo === 'mover' && x.pan === C.HOME_PAN && x.tilt === C.HOME_TILT)).toBe(true)
  })
  it('9.9 s sin heartbeat todavía no dispara', () => {
    expect(ticks(aIdle(), 99, { heartbeatOk: false }).s.estado).toBe('IDLE')
  })
  it('un heartbeat recibido reinicia la cuenta', () => {
    const a = ticks(aIdle(), 60, { heartbeatOk: false }).s
    const b = ticks(a, 1, { heartbeatOk: true }).s
    expect(ticks(b, 60, { heartbeatOk: false }).s.estado).toBe('IDLE')
  })
  it('si ocurre en plena ráfaga, el audio se apaga en el acto', () => {
    const rafaga = avanzar(aConfirming().s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'DETERRING').s
    expect(rafaga.audio).toBe(true)
    const r = step({ ...rafaga, sinHeartbeatMs: C.HEARTBEAT_TIMEOUT_MS - 50 }, { dtMs: 100, heartbeatOk: false }, ctx())
    expect(r.estado.estado).toBe('AUTONOMOUS')
    expect(r.estado.audio).toBe(false)
    expect(r.efectos.some((x) => x.tipo === 'audio' && !x.activo)).toBe(true)
  })
  it('al volver el heartbeat regresa a HOMING y luego a IDLE', () => {
    const auto = avanzar(aIdle(), () => ({ heartbeatOk: false }), (s) => s.estado === 'AUTONOMOUS').s
    const r = avanzar(auto, () => ({ heartbeatOk: true }), (s) => s.estado === 'IDLE')
    expect(r.s.estado).toBe('IDLE')
    expect(r.visitados.has('HOMING')).toBe(true)
  })
  it('se ignora durante el arranque', () => {
    const r = step(estadoInicial(), { dtMs: 20_000, heartbeatOk: false }, ctx())
    expect(r.estado.estado).not.toBe('AUTONOMOUS')
  })
})

describe('FSM — sobrecorriente', () => {
  it('> 1.3 A → SAFE_MUTE con persistencia sobrecorriente', () => {
    const r = step(aIdle(), { dtMs: 100, amperios: 1.4 }, ctx())
    expect(r.estado.estado).toBe('SAFE_MUTE')
    expect(r.efectos.filter((x) => x.tipo === 'persistir' && x.codigo === 'sobrecorriente')).toHaveLength(1)
  })
  it('exactamente 1.3 A no dispara', () => {
    expect(step(aIdle(), { dtMs: 100, amperios: 1.3 }, ctx()).estado.estado).toBe('IDLE')
  })
  it('en plena ráfaga apaga el audio de inmediato', () => {
    const rafaga = avanzar(aConfirming().s, (s) => ({ marco: ave(s) }), (s) => s.estado === 'DETERRING').s
    const r = step(rafaga, { dtMs: 100, amperios: 1.5 }, ctx())
    expect(r.estado.estado).toBe('SAFE_MUTE')
    expect(r.estado.audio).toBe(false)
  })
  it('SAFE_MUTE dura 30 s y luego vuelve a IDLE', () => {
    const mute = step(aIdle(), { dtMs: 100, amperios: 2 }, ctx()).estado
    expect(ticks(mute, 299, {}).s.estado).toBe('SAFE_MUTE')
    expect(avanzar(mute, () => ({}), (s) => s.estado === 'IDLE').s.estado).toBe('IDLE')
  })
  it('la 3.ª en 10 min lleva a FAULT (crítico) y FAULT es terminal', () => {
    const base = { ...aIdle(), ahoraMs: 1_000_000 }
    const r = step({ ...base, sobrecorrientes: [900_000, 950_000] }, { dtMs: 100, amperios: 1.5 }, ctx())
    expect(r.estado.estado).toBe('FAULT')
    expect(r.efectos.filter((x) => x.tipo === 'persistir' && x.codigo === 'fault')).toHaveLength(1)
    const despues = ticks(r.estado, 50, { presencia: true, marco: marco() }).s
    expect(despues.estado).toBe('FAULT')
    expect(despues.audio).toBe(false)
  })
  it('las sobrecorrientes de hace más de 10 min ya no cuentan', () => {
    const base = { ...aIdle(), ahoraMs: 1_000_000 }
    const r = step({ ...base, sobrecorrientes: [100_000, 200_000] }, { dtMs: 100, amperios: 1.5 }, ctx())
    expect(r.estado.estado).toBe('SAFE_MUTE')
  })
})

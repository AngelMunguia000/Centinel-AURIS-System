'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { C } from '@/lib/prototipo/constantes'
import { ESCENARIOS, marcoHacia, type EscenarioId, type Guion } from '@/lib/prototipo/escenarios'
import { conexionDe } from '@/lib/prototipo/eventos'
import { estadoInicial, step } from '@/lib/prototipo/fsm'
import { crearRng } from '@/lib/prototipo/rng'
import type { CodigoEvento, Contexto, Efecto, Entrada, FsmState } from '@/lib/prototipo/tipos'

export type Velocidad = 1 | 2 | 4
export interface EntradaLog { id: number; t: number; texto: string }
export interface Guardado { id: number; ok: boolean; texto: string; href?: string }
export interface Vista {
  s: FsmState
  ave: { pan: number; tilt: number } | null
  escenario: EscenarioId | null
  corriendo: boolean
  velocidad: Velocidad
  barreras: number[]
  cicloPct: number
}

const MAX_LOG = 100
const BARRERA_MS = 5000 // tiempo simulado que una barrera permanece encendida

interface Sim {
  s: FsmState
  ctx: Contexto
  guion: Guion | null
  i: number
  escenario: EscenarioId | null
  ave: { pan: number; tilt: number } | null
  presenciaPendiente: boolean
  barreras: Record<number, number>
  ultimaClave: string
  ultimoEnvio: number
}

let contadorId = 0
const siguienteId = () => ++contadorId

// Deja la FSM ya en reposo (10 pasos de BOOT + SELFTEST) para que la pestaña abra sin esperar.
function arrancar(ctx: Contexto): FsmState {
  let s = estadoInicial()
  for (let k = 0; k < 10; k++) s = step(s, { dtMs: C.DT_MS }, ctx).estado
  return s
}

function nuevoSim(): Sim {
  const ctx: Contexto = { rng: crearRng(Date.now() >>> 0) }
  return {
    s: arrancar(ctx), ctx, guion: null, i: 0, escenario: null, ave: null, presenciaPendiente: false,
    barreras: {}, ultimaClave: '', ultimoEnvio: 0,
  }
}

function cicloDe(s: FsmState): number {
  const usado = s.emisiones
    .filter((x) => s.ahoraMs - x.inicioMs < C.VENTANA_CICLO_MS)
    .reduce((a, x) => a + x.duracionMs, 0)
  return Math.min(100, Math.round((usado / (C.CICLO_TRABAJO_MAX * C.VENTANA_CICLO_MS)) * 100))
}

export function useSimulacion(puedeEjecutar: boolean) {
  const ref = useRef<Sim | null>(null)
  const getSim = () => (ref.current ??= nuevoSim())

  const velRef = useRef<Velocidad>(1)
  const corriendoRef = useRef(true)
  const puedeRef = useRef(puedeEjecutar)
  const pausaGuardadoRef = useRef(false)
  const dispositivoOkRef = useRef(true)

  const [vista, setVista] = useState<Vista>(() => {
    const sim = getSim()
    return { s: sim.s, ave: null, escenario: null, corriendo: true, velocidad: 1, barreras: [], cicloPct: 0 }
  })
  const [mqtt, setMqtt] = useState<EntradaLog[]>([])
  const [guardados, setGuardados] = useState<Guardado[]>([])
  const [guardadoPausado, setGuardadoPausado] = useState(false)

  const anotarGuardado = useCallback((g: Omit<Guardado, 'id'>) => {
    setGuardados((prev) => [{ id: siguienteId(), ...g }, ...prev].slice(0, MAX_LOG))
  }, [])

  const pausarGuardado = useCallback((texto: string) => {
    pausaGuardadoRef.current = true
    setGuardadoPausado(true)
    anotarGuardado({ ok: false, texto })
  }, [anotarGuardado])

  const guardarEvento = useCallback(async (codigo: CodigoEvento, estadoFsm: string) => {
    if (!puedeRef.current || pausaGuardadoRef.current) return
    try {
      const res = await fetch('/api/prototipo/evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, estadoFsm }),
      })
      if (res.ok) {
        const { reporteId } = (await res.json()) as { reporteId: number }
        anotarGuardado({ ok: true, texto: `Reporte #${reporteId} creado (${codigo})`, href: '/reportes' })
      } else if (res.status === 429 || res.status === 409) {
        const { error } = (await res.json().catch(() => ({ error: 'Límite alcanzado' }))) as { error: string }
        pausarGuardado(`Guardado en pausa: ${error}`)
      } else if (res.status === 403) {
        pausarGuardado('Guardado deshabilitado: solo el Admin puede ejecutar la simulación.')
      } else {
        anotarGuardado({ ok: false, texto: `No se pudo guardar ${codigo} (HTTP ${res.status}). La simulación continúa.` })
      }
    } catch {
      anotarGuardado({ ok: false, texto: `Sin conexión con el servidor al guardar ${codigo}. La simulación continúa.` })
    }
  }, [anotarGuardado, pausarGuardado])

  const sincronizarDispositivo = useCallback(async (estadoFsm: string, conexion: string) => {
    try {
      const res = await fetch('/api/prototipo/estado', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estadoFsm, conexion }),
      })
      if (!res.ok && dispositivoOkRef.current) {
        anotarGuardado({ ok: false, texto: `No se pudo actualizar el dispositivo (HTTP ${res.status}).` })
      }
      dispositivoOkRef.current = res.ok
    } catch {
      if (dispositivoOkRef.current) anotarGuardado({ ok: false, texto: 'Sin conexión al actualizar el dispositivo.' })
      dispositivoOkRef.current = false
    }
  }, [anotarGuardado])

  const tick = useCallback(() => {
    if (document.hidden || !corriendoRef.current) return
    const sim = getSim()
    const nuevos: EntradaLog[] = []

    for (let k = 0; k < velRef.current; k++) {
      let parcial: Omit<Entrada, 'dtMs'> = { heartbeatOk: true }
      if (sim.guion) {
        const p = sim.guion(sim.s, sim.i++)
        if (p === null) {
          sim.guion = null
          sim.escenario = null
        } else {
          parcial = p
        }
      }
      if (!sim.guion) {
        parcial = {
          heartbeatOk: true,
          presencia: sim.presenciaPendiente,
          marco: sim.ave ? marcoHacia(sim.s, sim.ave) : null,
        }
        sim.presenciaPendiente = false
      }

      const r = step(sim.s, { dtMs: C.DT_MS, ...parcial }, sim.ctx)
      sim.s = r.estado
      for (const ef of r.efectos as Efecto[]) {
        if (ef.tipo === 'mqtt') {
          nuevos.push({ id: siguienteId(), t: sim.s.ahoraMs, texto: `${ef.topico}  ${JSON.stringify(ef.payload)}` })
        } else if (ef.tipo === 'registro') {
          nuevos.push({ id: siguienteId(), t: sim.s.ahoraMs, texto: `evento · ${ef.evento}` })
          if (ef.evento === 'ciclo_trabajo_excedido') sim.barreras[1] = sim.s.ahoraMs + BARRERA_MS
        } else if (ef.tipo === 'persistir') {
          if (ef.codigo === 'sobrecorriente' || ef.codigo === 'fault') sim.barreras[4] = sim.s.ahoraMs + BARRERA_MS
          void guardarEvento(ef.codigo, sim.s.estado)
        }
      }
    }

    if (nuevos.length) {
      const orden = [...nuevos].reverse()
      setMqtt((prev) => [...orden, ...prev].slice(0, MAX_LOG))
    }

    // Refleja el estado en el Dispositivo simulado: solo si cambió y máx. 1 vez por segundo.
    const clave = `${sim.s.estado}|${conexionDe(sim.s.estado)}`
    if (puedeRef.current && clave !== sim.ultimaClave && Date.now() - sim.ultimoEnvio >= 1000) {
      sim.ultimaClave = clave
      sim.ultimoEnvio = Date.now()
      void sincronizarDispositivo(sim.s.estado, conexionDe(sim.s.estado))
    }

    setVista({
      s: sim.s,
      ave: sim.ave,
      escenario: sim.escenario,
      corriendo: corriendoRef.current,
      velocidad: velRef.current,
      barreras: Object.entries(sim.barreras).filter(([, hasta]) => hasta > sim.s.ahoraMs).map(([id]) => Number(id)),
      cicloPct: cicloDe(sim.s),
    })
  }, [guardarEvento, sincronizarDispositivo])

  useEffect(() => {
    puedeRef.current = puedeEjecutar
  }, [puedeEjecutar])

  useEffect(() => {
    const id = setInterval(tick, C.DT_MS)
    return () => clearInterval(id)
  }, [tick])

  const reiniciar = useCallback(() => {
    const sim = getSim()
    sim.s = arrancar(sim.ctx)
    sim.guion = null
    sim.escenario = null
    sim.ave = null
    sim.barreras = {}
  }, [])

  const lanzar = useCallback((id: EscenarioId) => {
    if (!puedeRef.current) return
    const esc = ESCENARIOS.find((e) => e.id === id)
    if (!esc) return
    const sim = getSim()
    sim.ctx = { rng: crearRng(Date.now() >>> 0) }
    sim.s = estadoInicial() // los guiones asumen un arranque en frío
    sim.guion = esc.crear()
    sim.i = 0
    sim.escenario = id
    sim.ave = null
    sim.barreras = {}
    corriendoRef.current = true
  }, [])

  const colocarAve = useCallback((pan: number, tilt: number) => {
    if (!puedeRef.current) return
    const sim = getSim()
    sim.guion = null
    sim.escenario = null
    sim.ave = { pan, tilt }
    sim.presenciaPendiente = true
    corriendoRef.current = true
  }, [])

  const retirarAve = useCallback(() => {
    getSim().ave = null
  }, [])

  const alternar = useCallback(() => {
    corriendoRef.current = !corriendoRef.current
    setVista((v) => ({ ...v, corriendo: corriendoRef.current }))
  }, [])

  const setVelocidad = useCallback((v: Velocidad) => {
    velRef.current = v
    setVista((prev) => ({ ...prev, velocidad: v }))
  }, [])

  const limpiarDatos = useCallback(async () => {
    if (!puedeRef.current) return
    try {
      const res = await fetch('/api/prototipo/datos', { method: 'DELETE' })
      if (res.ok) {
        const { reportesEliminados } = (await res.json()) as { reportesEliminados: number }
        pausaGuardadoRef.current = false
        setGuardadoPausado(false)
        dispositivoOkRef.current = true
        getSim().ultimaClave = '' // fuerza recrear el dispositivo en el siguiente cambio
        anotarGuardado({ ok: true, texto: `Datos simulados eliminados (${reportesEliminados} reportes).` })
      } else {
        anotarGuardado({ ok: false, texto: `No se pudieron limpiar los datos (HTTP ${res.status}).` })
      }
    } catch {
      anotarGuardado({ ok: false, texto: 'Sin conexión al limpiar los datos simulados.' })
    }
  }, [anotarGuardado])

  return { vista, mqtt, guardados, guardadoPausado, lanzar, colocarAve, retirarAve, alternar, reiniciar, setVelocidad, limpiarDatos }
}

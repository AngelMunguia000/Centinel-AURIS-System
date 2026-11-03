import { describe, it, expect } from 'vitest'
import { C } from '@/lib/prototipo/constantes'
import { ESCENARIOS, ejecutarEscenario, type EscenarioId } from '@/lib/prototipo/escenarios'
import { estadoInicial, step } from '@/lib/prototipo/fsm'
import { crearRng } from '@/lib/prototipo/rng'
import type { Efecto, Entrada } from '@/lib/prototipo/tipos'

const porId = (id: EscenarioId) => ESCENARIOS.find((e) => e.id === id)!
const registro = (ef: Efecto[], ev: string) => ef.filter((x) => x.tipo === 'registro' && x.evento === ev)
const persistidos = (ef: Efecto[], codigo: string) => ef.filter((x) => x.tipo === 'persistir' && x.codigo === codigo)
const audioOn = (ef: Efecto[]) => ef.filter((x) => x.tipo === 'audio' && x.activo)

describe('escenarios', () => {
  it('hay exactamente 5, con id único', () => {
    expect(ESCENARIOS).toHaveLength(5)
    expect(new Set(ESCENARIOS.map((e) => e.id)).size).toBe(5)
  })
  it('ave_real: disuade y vuelve a IDLE sin persistir nada', () => {
    const t = ejecutarEscenario(porId('ave_real'))
    expect(t.estadoFinal.estado).toBe('IDLE')
    expect(registro(t.efectos, 'disuasion_exitosa')).toHaveLength(1)
    expect(audioOn(t.efectos)).toHaveLength(1)
    expect(t.efectos.some((x) => x.tipo === 'persistir')).toBe(false)
  })
  it('ave_persistente: 3 ráfagas y una persistencia_objetivo', () => {
    const t = ejecutarEscenario(porId('ave_persistente'))
    expect(audioOn(t.efectos)).toHaveLength(3)
    expect(persistidos(t.efectos, 'persistencia_objetivo')).toHaveLength(1)
    expect(t.estadoFinal.estado).toBe('IDLE')
  })
  it('falsa_alarma: descarta el candidato, nunca disuade ni persiste', () => {
    const t = ejecutarEscenario(porId('falsa_alarma'))
    expect(registro(t.efectos, 'falsa_alarma')).toHaveLength(1)
    expect(t.visitados).not.toContain('DETERRING')
    expect(t.efectos.some((x) => x.tipo === 'persistir')).toBe(false)
    expect(t.estadoFinal.estado).toBe('IDLE')
  })
  it('caida_broker: pasa por AUTONOMOUS, persiste una vez y se recupera', () => {
    const t = ejecutarEscenario(porId('caida_broker'))
    expect(t.visitados).toContain('AUTONOMOUS')
    expect(persistidos(t.efectos, 'broker_caido')).toHaveLength(1)
    expect(audioOn(t.efectos)).toHaveLength(0)
    expect(t.estadoFinal.estado).toBe('IDLE')
  })
  it('sobrecorriente: 2 SAFE_MUTE y luego FAULT en la 3.ª', () => {
    const t = ejecutarEscenario(porId('sobrecorriente'))
    expect(t.visitados).toContain('SAFE_MUTE')
    expect(persistidos(t.efectos, 'sobrecorriente')).toHaveLength(2)
    expect(persistidos(t.efectos, 'fault')).toHaveLength(1)
    expect(t.estadoFinal.estado).toBe('FAULT')
  })
  it('todos terminan por sí solos (no agotan el máximo de pasos)', () => {
    for (const esc of ESCENARIOS) expect(ejecutarEscenario(esc).pasos).toBeLessThan(20_000)
  })
  it('son deterministas: misma semilla, mismo rastro', () => {
    const a = ejecutarEscenario(porId('ave_persistente'), 7)
    const b = ejecutarEscenario(porId('ave_persistente'), 7)
    expect(JSON.stringify(a.efectos)).toBe(JSON.stringify(b.efectos))
  })
})

describe('invariantes con entradas aleatorias', () => {
  it('con entradas totalmente aleatorias: torreta dentro de límites y audio coherente (sin garantía de llegar a RAFAGA)', () => {
    const violaciones: string[] = []
    for (let semilla = 1; semilla <= 60; semilla++) {
      const rng = crearRng(semilla)
      const ctx = { rng }
      let s = estadoInicial()
      for (let i = 0; i < 1500; i++) {
        const e: Entrada = {
          dtMs: [50, 100, 500, 1000][Math.floor(rng() * 4)],
          presencia: rng() < 0.2,
          marco:
            rng() < 0.15
              ? undefined
              : rng() < 0.3
                ? null
                : { conf: rng(), panErr: (rng() - 0.5) * 40, tiltErr: (rng() - 0.5) * 20, desplazamiento: rng() * 0.5 },
          heartbeatOk: rng() < 0.9 ? true : rng() < 0.5 ? false : undefined,
          amperios: rng() < 0.0003 ? 2 : rng() < 0.5 ? undefined : rng(),
        }
        const r = step(s, e, ctx)
        s = r.estado
        const emitiendo = s.estado === 'DETERRING' && s.sub === 'RAFAGA'
        if (s.audio !== emitiendo) violaciones.push(`s${semilla}#${i}: audio=${s.audio} en ${s.estado}/${s.sub}`)
        if (r.efectos.some((x) => x.tipo === 'audio' && x.activo) && !emitiendo)
          violaciones.push(`s${semilla}#${i}: audio ON fuera de RAFAGA`)
        if (s.pan < C.PAN_MIN || s.pan > C.PAN_MAX || s.tilt < C.TILT_MIN || s.tilt > C.TILT_MAX)
          violaciones.push(`s${semilla}#${i}: torreta fuera de límites (${s.pan}, ${s.tilt})`)
      }
    }
    expect(violaciones).toEqual([])
  })

  it('fuzz sesgado sobre guiones reales: el audio solo suena en DETERRING/RAFAGA (y se alcanza RAFAGA)', () => {
    const violaciones: string[] = []
    let rafaga = 0
    let pausa = 0
    for (const id of ['ave_real', 'ave_persistente'] as EscenarioId[]) {
      for (let semilla = 1; semilla <= 40; semilla++) {
        const rng = crearRng(semilla * 31 + 5)
        const ctx = { rng: crearRng(semilla) }
        const guion = porId(id).crear()
        let s = estadoInicial()
        for (let i = 0; i < 4000; i++) {
          const parcial = guion(s, i)
          if (parcial === null) break
          const e: Entrada = { dtMs: [50, 100, 200][Math.floor(rng() * 3)], ...parcial }
          if (e.marco !== undefined && e.marco !== null) {
            e.marco = { ...e.marco, conf: 0.6 + rng() * 0.4, desplazamiento: rng() * 0.2 }
          }
          if (rng() < 0.05) e.marco = null
          if (rng() < 0.005) e.heartbeatOk = false
          if (rng() < 0.002) e.amperios = 1.5
          const r = step(s, e, ctx)
          s = r.estado
          const emitiendo = s.estado === 'DETERRING' && s.sub === 'RAFAGA'
          if (emitiendo) rafaga++
          if (s.estado === 'DETERRING' && s.sub === 'PAUSA') pausa++
          if (s.audio !== emitiendo) violaciones.push(`${id} s${semilla}#${i}: audio=${s.audio} en ${s.estado}/${s.sub}`)
          if (r.efectos.some((x) => x.tipo === 'audio' && x.activo) && !emitiendo)
            violaciones.push(`${id} s${semilla}#${i}: audio ON fuera de RAFAGA`)
          if (s.pan < C.PAN_MIN || s.pan > C.PAN_MAX || s.tilt < C.TILT_MIN || s.tilt > C.TILT_MAX)
            violaciones.push(`${id} s${semilla}#${i}: torreta fuera de límites (${s.pan}, ${s.tilt})`)
        }
      }
    }
    expect(violaciones).toEqual([])
    expect(rafaga, `RAFAGA=${rafaga} PAUSA=${pausa}`).toBeGreaterThan(0)
    expect(pausa, `RAFAGA=${rafaga} PAUSA=${pausa}`).toBeGreaterThan(0)
  })
})

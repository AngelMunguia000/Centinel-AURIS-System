"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, Lightbulb, Radar, X } from "lucide-react"
import { GlassPanel } from "@/components/glass-panel"
import type { NodoVivo } from "@/lib/edge/estado"
import { LIMITES_SERVO } from "@/lib/monitor/servo"
import { ESTADO_UI, NodoVisual, mandarComando, textoResultado } from "./MonitorCamaras"

// Spec: docs/diseno/2026-09-25-monitor-camara-servos-design.md §1, §3; desde 2026-10-16
// los comandos van al nodo real (spec 2026-10-16-enlace-edge-design.md §6.2).

interface Posicion {
  pan: number
  tilt: number
}

const PASO_CRUCETA = 5

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

interface CamaraAmpliadaProps {
  nodo: NodoVivo
  onClose: () => void
}

export function CamaraAmpliada({ nodo, onClose }: CamaraAmpliadaProps) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cerrarBtnRef = useRef<HTMLButtonElement>(null)

  const offline = nodo.estado !== "en_linea"
  const capPantilt = nodo.capacidades?.pantilt ?? "ausente"
  const capLed = nodo.capacidades?.led ?? "ausente"

  // El ángulo de partida es el último que reportó el nodo en su telemetría.
  const inicial: Posicion = {
    pan: Math.round(nodo.telemetria?.pan_deg ?? LIMITES_SERVO.pan.centro),
    tilt: Math.round(nodo.telemetria?.tilt_deg ?? LIMITES_SERVO.tilt.centro),
  }
  const [angulo, setAngulo] = useState<Posicion | null>(inicial)
  const [resultado, setResultado] = useState<string | null>(null)
  const [led, setLed] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Espejo síncrono de `angulo` (estado) — enviarPosicion es async y puede
  // encadenar varios PUT (ver `pendienteRef` más abajo) sin esperar a que
  // React vuelva a renderizar entre uno y otro, así que necesita leer/escribir
  // el último ángulo confirmado sin depender de un closure de render potencialmente
  // desactualizado.
  const anguloRef = useRef<Posicion | null>(inicial)

  // Valores en vivo mientras se arrastra un deslizador (se manda el PUT solo
  // al soltar, no en cada píxel — §1.2 de la spec). null = usar `angulo`.
  const [panBorrador, setPanBorrador] = useState<number | null>(null)
  const [tiltBorrador, setTiltBorrador] = useState<number | null>(null)

  // Fade de entrada simple; motion-reduce: lo desactiva por completo (no solo
  // lo acelera) — no hace falta el hook useReducedMotion para esto porque
  // Tailwind ya resuelve el media query en CSS puro.
  const [visible, setVisible] = useState(false)

  // Ciclo de vida del diálogo: foco al abrir, trampa de Tab, Esc, bloqueo de
  // scroll del body, y devolver el foco a quien lo abrió al desmontar.
  useEffect(() => {
    const previoEnfocado = document.activeElement as HTMLElement | null
    cerrarBtnRef.current?.focus()

    const previoOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focosables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
        if (focosables.length === 0) return
        const primero = focosables[0]
        const ultimo = focosables[focosables.length - 1]
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault()
          ultimo.focus()
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault()
          primero.focus()
        }
      }
    }
    document.addEventListener("keydown", onKeyDown)

    const raf = requestAnimationFrame(() => setVisible(true))

    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previoOverflow
      cancelAnimationFrame(raf)
      previoEnfocado?.focus()
    }
    // onClose no es estable por identidad (MonitorCamaras pasa una arrow function nueva en cada
    // render), pero sí lo es por comportamiento: siempre delega en el setSeleccionada(null) de
    // useState, que React sí garantiza estable, así que da igual qué closure de onClose haya
    // capturado este efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sigue si el componente sigue montado cuando una petición resuelve (mismo
  // criterio que `cancelado` en el efecto de carga inicial), para no llamar
  // setState después de que CamaraAmpliada se desmonte (cierre del diálogo).
  const montadoRef = useRef(true)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])

  // true mientras hay un PUT en vuelo para esta cámara. A propósito NO se usa
  // para deshabilitar los controles (ver `controlesDeshabilitados` abajo): los
  // navegadores quitan el foco de un elemento cuando pasa a disabled, así que
  // deshabilitar sliders/cruceta en cada envío le hacía perder el foco a un
  // usuario de teclado a media pulsación. En su lugar, mientras esto es true
  // los envíos nuevos se serializan (ver `pendienteRef`).
  const enviandoRef = useRef(false)
  // "Última posición gana": si enviarPosicion() se llama mientras ya hay una
  // petición en vuelo, la posición pedida se guarda aquí (pisando cualquier
  // valor pendiente anterior) en vez de encolar todas — cuando la petición
  // actual termina, se manda esta si sigue habiendo alguna pendiente. Esto es
  // lo que hace que pulsaciones repetidas de flecha (o keyup repetidos en un
  // slider) mientras hay un envío en curso terminen acumulando correctamente
  // en vez de perderse o pisarse fuera de orden.
  const pendienteRef = useRef<Posicion | null>(null)
  // La posición que se está mandando AHORA MISMO (el `actual` de la vuelta en
  // curso del while de abajo), mientras el fetch está en vuelo. Necesario
  // porque en una ráfaga en la que la primera llamada no encuentra nada en
  // vuelo (enviandoRef aún false), esa primera posición vive solo en la
  // variable local `actual` — sin este ref, `objetivoActual()` no la ve
  // mientras esa primera petición está pendiente, así que la siguiente
  // pulsación calculaba su delta sobre el último ángulo CONFIRMADO (todavía
  // desactualizado) y terminaba duplicando el objetivo en vuelo en vez de
  // sumarle otro paso — se perdía un paso por ráfaga.
  const enVueloRef = useRef<Posicion | null>(null)

  // El objetivo que hay que usar como base para el próximo movimiento: lo
  // pendiente de mandar si hay algo encolado; si no, lo que se está mandando
  // ahora mismo; si no, lo último confirmado por la API. Nunca el ángulo
  // confirmado cuando ya hay un envío en vuelo o encolado más nuevo.
  function objetivoActual(): Posicion {
    return (
      pendienteRef.current ??
      enVueloRef.current ??
      anguloRef.current ?? { pan: LIMITES_SERVO.pan.centro, tilt: LIMITES_SERVO.tilt.centro }
    )
  }

  async function enviarPosicion(pos: Posicion) {
    if (offline || anguloRef.current === null) return
    if (enviandoRef.current) {
      pendienteRef.current = pos
      return
    }

    enviandoRef.current = true
    let actual: Posicion | null = pos

    while (actual) {
      if (!montadoRef.current) break
      const anterior = anguloRef.current
      enVueloRef.current = actual
      setGuardando(true)
      setError(null)
      try {
        const r = await mandarComando(nodo.id, {
          tipo: "pantilt",
          payload: { mode: "absolute", pan_deg: actual.pan, tilt_deg: actual.tilt },
        })
        if (r.estado !== "ok") throw new Error(textoResultado(r))
        if (!montadoRef.current) break
        setResultado(textoResultado(r))
        const confirmado = { ...actual }
        anguloRef.current = confirmado
        setAngulo(confirmado)
      } catch (err) {
        // Un envío falló: se descarta cualquier posición que se haya
        // acumulado como pendiente o en vuelo mientras tanto (no tiene
        // sentido reintentar automáticamente con un valor que el usuario
        // pidió antes del error) y se revierte al último ángulo confirmado.
        pendienteRef.current = null
        enVueloRef.current = null
        if (!montadoRef.current) break
        setError(err instanceof Error ? err.message : "No se pudo mover la cámara")
        anguloRef.current = anterior
        setAngulo(anterior)
        break
      }

      enVueloRef.current = null
      actual = pendienteRef.current
      pendienteRef.current = null
    }

    enviandoRef.current = false
    enVueloRef.current = null
    pendienteRef.current = null
    if (montadoRef.current) {
      setGuardando(false)
      // El lote completo de envíos terminó (éxito o error): cualquier valor
      // de arrastre local deja de tener sentido, el slider vuelve a reflejar
      // `angulo` (el recién confirmado, o el revertido tras un error).
      setPanBorrador(null)
      setTiltBorrador(null)
    }
  }

  const panMostrado = panBorrador ?? angulo?.pan ?? LIMITES_SERVO.pan.centro
  const tiltMostrado = tiltBorrador ?? angulo?.tilt ?? LIMITES_SERVO.tilt.centro

  // Deshabilitados solo por OFFLINE o mientras se carga el ángulo inicial —
  // NUNCA por `guardando`: ver el comentario de `enviandoRef` más arriba.
  const controlesDeshabilitados = offline || capPantilt === "ausente" || angulo === null

  async function sistema(payload: { accion: "led"; encendido: boolean } | { accion: "ping" }) {
    setError(null)
    setResultado(null)
    const r = await mandarComando(nodo.id, { tipo: "system", payload })
    if (!montadoRef.current) return
    if (r.estado === "ok") {
      setResultado(textoResultado(r))
      if (payload.accion === "led") setLed(payload.encendido)
    } else {
      setError(textoResultado(r))
    }
  }

  function soltarPan(valor: number) {
    setPanBorrador(valor)
    void enviarPosicion({ pan: valor, tilt: objetivoActual().tilt })
  }

  function soltarTilt(valor: number) {
    setTiltBorrador(valor)
    void enviarPosicion({ pan: objetivoActual().pan, tilt: valor })
  }

  function moverCruceta(deltaPan: number, deltaTilt: number) {
    if (anguloRef.current === null) return
    const base = objetivoActual()
    void enviarPosicion({
      pan: clamp(base.pan + deltaPan, LIMITES_SERVO.pan.min, LIMITES_SERVO.pan.max),
      tilt: clamp(base.tilt + deltaTilt, LIMITES_SERVO.tilt.min, LIMITES_SERVO.tilt.max),
    })
  }

  function centrar() {
    void enviarPosicion({ pan: LIMITES_SERVO.pan.centro, tilt: LIMITES_SERVO.tilt.centro })
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm md:p-4 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full md:h-auto md:max-w-5xl overflow-y-auto"
      >
        <GlassPanel
          padding="md"
          radius="lg"
          className="bg-background/95 rounded-none md:rounded-[24px] min-h-full md:min-h-0 border border-foreground/10"
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id={tituloId} className="text-xl font-semibold tracking-[-0.005em] text-foreground">
                {nodo.nombre}
              </h2>
              <p className="text-foreground/50 text-xs font-mono mt-0.5">
                {nodo.gatewayNombre ? `vía ${nodo.gatewayNombre}` : nodo.uid}
              </p>
            </div>
            <button
              ref={cerrarBtnRef}
              type="button"
              onClick={onClose}
              className="shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-foreground/70 bg-foreground/[0.04] border border-foreground/10 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Cerrar
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:flex-1">
              <div className="relative aspect-video w-full rounded-[16px] overflow-hidden border border-white/10 bg-[#0a0d12]">
                <NodoVisual nodo={nodo}>
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded px-2 py-1 bg-black/60 text-white text-[10px] font-mono tracking-tight">
                    {`PAN ${panMostrado}° · TILT ${tiltMostrado}°`}
                  </div>
                </NodoVisual>
              </div>
              <p className="text-foreground/40 text-[10px] uppercase tracking-widest mt-3">
                {capPantilt === "real"
                  ? "Servo pan/tilt real"
                  : capPantilt === "simulado"
                    ? "Pan/tilt simulado en el nodo: sin servo conectado"
                    : "Este nodo no tiene pan/tilt"}
              </p>
            </div>

            <div className="lg:w-72 shrink-0 flex flex-col gap-5" aria-busy={guardando}>
              {offline && (
                <p className="text-xs font-semibold text-foreground/60 bg-foreground/[0.04] border border-foreground/10 rounded-md px-3 py-2">
                  {ESTADO_UI[nodo.estado].texto}: no se pueden enviar comandos
                </p>
              )}

              <div aria-live="polite" role="status">
                {resultado && !error && (
                  <p className="text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2">
                    {resultado}
                  </p>
                )}
                {error && (
                  <p className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {capLed !== "ausente" && (
                  <button
                    type="button"
                    onClick={() => sistema({ accion: "led", encendido: !led })}
                    disabled={offline}
                    aria-pressed={led}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold uppercase tracking-widest bg-foreground/[0.04] border border-foreground/10 text-foreground/80 hover:bg-foreground/10 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    {led ? "Apagar LED" : "Encender LED"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => sistema({ accion: "ping" })}
                  disabled={offline}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold uppercase tracking-widest bg-foreground/[0.04] border border-foreground/10 text-foreground/80 hover:bg-foreground/10 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                >
                  <Radar className="h-3.5 w-3.5" />
                  Ping
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="servo-pan" className="text-xs font-semibold uppercase tracking-widest text-foreground/70">
                    Pan
                  </label>
                  <span className="text-xs font-mono text-foreground/50">{panMostrado}°</span>
                </div>
                <input
                  id="servo-pan"
                  type="range"
                  min={LIMITES_SERVO.pan.min}
                  max={LIMITES_SERVO.pan.max}
                  step={1}
                  value={panMostrado}
                  disabled={controlesDeshabilitados}
                  onChange={(e) => setPanBorrador(Number(e.target.value))}
                  onPointerUp={(e) => soltarPan(Number(e.currentTarget.value))}
                  onKeyUp={(e) => soltarPan(Number(e.currentTarget.value))}
                  className="w-full accent-accent-foreground disabled:opacity-40"
                  aria-valuetext={`${panMostrado} grados`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="servo-tilt" className="text-xs font-semibold uppercase tracking-widest text-foreground/70">
                    Tilt
                  </label>
                  <span className="text-xs font-mono text-foreground/50">{tiltMostrado}°</span>
                </div>
                <input
                  id="servo-tilt"
                  type="range"
                  min={LIMITES_SERVO.tilt.min}
                  max={LIMITES_SERVO.tilt.max}
                  step={1}
                  value={tiltMostrado}
                  disabled={controlesDeshabilitados}
                  onChange={(e) => setTiltBorrador(Number(e.target.value))}
                  onPointerUp={(e) => soltarTilt(Number(e.currentTarget.value))}
                  onKeyUp={(e) => soltarTilt(Number(e.currentTarget.value))}
                  className="w-full accent-accent-foreground disabled:opacity-40"
                  aria-valuetext={`${tiltMostrado} grados`}
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 w-32 mx-auto">
                <span />
                <button
                  type="button"
                  onClick={() => moverCruceta(0, PASO_CRUCETA)}
                  disabled={controlesDeshabilitados}
                  aria-label="Inclinar hacia arriba"
                  className="flex items-center justify-center rounded-md p-2 bg-foreground/[0.04] border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <span />

                <button
                  type="button"
                  onClick={() => moverCruceta(-PASO_CRUCETA, 0)}
                  disabled={controlesDeshabilitados}
                  aria-label="Girar a la izquierda"
                  className="flex items-center justify-center rounded-md p-2 bg-foreground/[0.04] border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="flex items-center justify-center text-foreground/20">
                  <Crosshair className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  onClick={() => moverCruceta(PASO_CRUCETA, 0)}
                  disabled={controlesDeshabilitados}
                  aria-label="Girar a la derecha"
                  className="flex items-center justify-center rounded-md p-2 bg-foreground/[0.04] border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>

                <span />
                <button
                  type="button"
                  onClick={() => moverCruceta(0, -PASO_CRUCETA)}
                  disabled={controlesDeshabilitados}
                  aria-label="Inclinar hacia abajo"
                  className="flex items-center justify-center rounded-md p-2 bg-foreground/[0.04] border border-foreground/10 text-foreground/70 hover:bg-foreground/10 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <span />
              </div>

              <button
                type="button"
                onClick={centrar}
                disabled={controlesDeshabilitados}
                className="w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-semibold uppercase tracking-widest transition-shadow duration-300 bg-foreground text-background hover:bg-foreground shadow-[0_4px_14px_rgba(255,255,255,0.15)] hover:shadow-[0_6px_18px_rgba(255,255,255,0.25)] disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Centrar
              </button>
            </div>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}

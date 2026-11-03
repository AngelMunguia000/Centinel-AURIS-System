import type { Metadata } from "next"
import { Cpu, CircuitBoard, MonitorSmartphone, Radio, Move, Volume2, Shield, Thermometer, Wifi } from "lucide-react"
import { PaginaLanding, Hero, Seccion, Rejilla, Pasos, Estado, CtaFinal } from "@/components/landing/kit"
import { ESTADO_SOLUCIONES } from "@/lib/landings"
import { EscenaPalomas } from "@/components/landing/escena-palomas"

export const metadata: Metadata = {
  title: "Tecnología — Centinela AURIS",
  description: "ESP32 en el campo, Raspberry Pi como cerebro local y una web en tiempo real: cómo está hecho Centinela.",
}

const capas = [
  { icono: CircuitBoard, nombre: "ESP32", rol: "Nodo de campo", detalle: "Sensores, servos pan/tilt y bocina" },
  { icono: Cpu, nombre: "Raspberry Pi", rol: "Cerebro local", detalle: "Decide, guarda en cola y reporta" },
  { icono: MonitorSmartphone, nombre: "Web AURIS", rol: "Operación", detalle: "Monitor, Bitácora e incidencias" },
]
const enlaces = ["MQTT · red local", "HTTP · token por Pi"]

function Cadena() {
  return (
    <div className="rounded-2xl border border-white/10 bg-card/80 p-6 shadow-[0_30px_70px_rgba(0,0,0,0.55)]">
      <p className="mb-5 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">La cadena completa</p>
      <ol className="space-y-3">
        {capas.map(({ icono: Icono, nombre, rol, detalle }, i) => (
          <li key={nombre}>
            <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icono className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-white">
                  {nombre} <span className="font-normal text-white/45">· {rol}</span>
                </span>
                <span className="block text-sm text-white/55">{detalle}</span>
              </span>
            </div>
            {i < enlaces.length && (
              <div className="ml-[1.9rem] flex items-center gap-3 py-2 font-mono text-[11px] text-signal/90">
                <span className="h-6 w-px bg-signal/40" aria-hidden="true" />
                {enlaces[i]}
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-5 font-mono text-[11px] text-white/45">Web → navegador: eventos en vivo por SSE</p>
    </div>
  )
}

export default function TecnologiaPage() {
  return (
    <PaginaLanding actual="/tecnologia">
      <Hero
        etiqueta="Cómo está hecho"
        titulo="Decide en el borde, informa al centro."
        acento="Sin depender de la nube."
        bajada="El nodo actúa en el lugar, la Raspberry Pi coordina y guarda, y la web muestra todo en tiempo real. Si un eslabón se cae, los demás siguen funcionando."
        secundaria={{ texto: "Ver la plataforma", href: "/plataforma" }}
        visual={<Cadena />}
      />

      <Seccion marca="En acción" titulo="Así detecta, fija y disuade" intro="La simulación 3D del sistema: la bandada se acerca, el nodo la identifica y el pulso dirigido la dispersa.">
        <EscenaPalomas />
      </Seccion>

      <Seccion marca="01 — El recorrido de un evento" titulo="De la detección a la pantalla">
        <Pasos
          pasos={[
            { titulo: "El nodo detecta", texto: "El ESP32 publica el evento por MQTT en la red local, con su severidad." },
            { titulo: "La Pi lo recibe", texto: "El gateway lo valida y lo envía a la web con su token; si no hay enlace, lo guarda en una cola en disco." },
            { titulo: "La web lo registra", texto: "Queda en la Bitácora; si es grave abre una incidencia y avisa al Operador." },
            { titulo: "Lo ves en vivo", texto: "El Monitor lo recibe al instante por SSE, sin recargar la página." },
          ]}
        />
      </Seccion>

      <Seccion marca="02 — Especificaciones del nodo" titulo="Hecho para estar afuera">
        <Rejilla
          puntos={[
            { icono: Shield, titulo: "IP66", texto: "Carcasa sellada contra agua y polvo." },
            { icono: Move, titulo: "Pan/tilt", texto: "Horizontal -90° a +90°, vertical +45° a -45°." },
            { icono: Volume2, titulo: "Disuasión sonora", texto: "Bocina de alta potencia con tonos de baja frecuencia, en pulsos de 3 a 5 s." },
            { icono: Thermometer, titulo: "-10 °C a 60 °C", texto: "Rango de temperatura de operación." },
            { icono: Wifi, titulo: "WiFi 2.4 GHz", texto: "Alimentación de 12 V / 5 V con protección." },
            { icono: Radio, titulo: "Último aliento", texto: "Si un nodo se apaga sin avisar, el broker lo marca desconectado en segundos (Last Will de MQTT)." },
          ]}
        />
      </Seccion>

      <Seccion marca="03 — Estado del proyecto" titulo="Lo que ya funciona y lo que viene">
        <Estado hoy={ESTADO_SOLUCIONES.hoy} viene={ESTADO_SOLUCIONES.viene} />
      </Seccion>

      <CtaFinal titulo="¿Quieres ver la cadena completa?" texto="La mostramos corriendo en una laptop: nodos, Raspberry Pi y web, de punta a punta." />
    </PaginaLanding>
  )
}

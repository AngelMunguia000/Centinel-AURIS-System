import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { PaginaLanding, Hero, Consola, Seccion, Pasos, Estado, CtaFinal } from "@/components/landing/kit"
import { EscenaPalomas } from "@/components/landing/escena-palomas"
import { Aparece } from "@/components/landing/aparece"
import { SOLUCIONES, ESTADO_SOLUCIONES } from "@/lib/landings"

export const metadata: Metadata = {
  title: "Soluciones — Centinela AURIS",
  description: "Disuasión de aves para agricultura, hogar y operación marítima, con el mismo sistema.",
}

const pasos = [
  { titulo: "Detecta", texto: "El nodo vigila la zona y confirma que hay aves, no otra cosa." },
  { titulo: "Localiza", texto: "El brazo pan/tilt orienta la bocina hacia el punto exacto." },
  { titulo: "Disuade", texto: "Un pulso de audio dirigido de 3 a 5 segundos, sin ruido continuo." },
  { titulo: "Registra", texto: "Cada evento llega a la Bitácora y los graves abren una incidencia." },
]

export default function SolucionesPage() {
  return (
    <PaginaLanding actual="/soluciones">
      <Hero
        etiqueta="Un sistema · tres escenarios"
        titulo="Donde haya aves que no deberían estar,"
        acento="Centinela responde."
        bajada="El mismo nodo y la misma plataforma se adaptan a un cultivo, a una azotea o a la bodega de un buque. Cambia el entorno; la forma de disuadir y de registrar es la misma."
        secundaria={{ texto: "Cómo funciona", href: "/tecnologia" }}
        visual={
          <Consola
            titulo="Instalaciones · resumen"
            lineas={[
              { hora: "06:41", texto: "Parcela norte · bandada disuadida", nivel: "ok" },
              { hora: "14:02", texto: "Azotea · palomas en borde norte", nivel: "alta" },
              { hora: "14:02", texto: "Azotea · zona despejada", nivel: "ok" },
              { hora: "03:44", texto: "Bodega 2 · 3 eventos entregados al reconectar", nivel: "ok" },
            ]}
            pie="Ejemplo ilustrativo."
          />
        }
      />

      <Seccion marca="En acción" titulo="Así detecta, fija y disuade" intro="La simulación 3D del sistema: la bandada se acerca, el nodo la identifica y el pulso dirigido la dispersa.">
        <EscenaPalomas />
      </Seccion>

      <Seccion marca="01 — Escenarios" titulo="Elige tu caso">
        <div className="grid gap-4 md:grid-cols-3">
          {SOLUCIONES.map(({ slug, nombre, descripcion, etiqueta, icono: Icono }, i) => (
            <Aparece key={slug} retraso={i * 0.06}>
              <Link
                href={`/soluciones/${slug}`}
                className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-colors hover:border-signal/35 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                  <Icono className="h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-white/45">{etiqueta}</span>
                <span className="mt-1 text-2xl font-semibold tracking-[-0.005em] text-white">{nombre}</span>
                <span className="mt-2 flex-1 text-white/55 leading-relaxed">{descripcion}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-signal">
                  Ver solución
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </Aparece>
          ))}
        </div>
      </Seccion>

      <Seccion marca="02 — En todos los casos" titulo="Cuatro pasos, siempre los mismos">
        <Pasos pasos={pasos} />
      </Seccion>

      <Seccion marca="03 — Estado del proyecto" titulo="Lo que ya funciona y lo que viene">
        <Estado hoy={ESTADO_SOLUCIONES.hoy} viene={ESTADO_SOLUCIONES.viene} />
      </Seccion>

      <CtaFinal titulo="¿No ves tu caso?" texto="Si el problema son aves en un lugar donde no deben estar, cuéntanos y vemos cómo adaptar Centinela." />
    </PaginaLanding>
  )
}

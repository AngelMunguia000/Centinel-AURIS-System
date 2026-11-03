import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PaginaLanding, Hero, Consola, Cifras, Seccion, Rejilla, Estado, CtaFinal } from "@/components/landing/kit"
import { EscenaPalomas } from "@/components/landing/escena-palomas"
import { SOLUCIONES, ESTADO_SOLUCIONES } from "@/lib/landings"

export function generateStaticParams() {
  return SOLUCIONES.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const s = SOLUCIONES.find((x) => x.slug === slug)
  return s ? { title: `${s.nombre} — Centinela AURIS`, description: s.bajada } : {}
}

export default async function SolucionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const s = SOLUCIONES.find((x) => x.slug === slug)
  if (!s) notFound()

  return (
    <PaginaLanding actual={`/soluciones/${s.slug}`}>
      <Hero
        etiqueta={s.etiqueta}
        titulo={s.titulo}
        acento={s.acento}
        bajada={s.bajada}
        secundaria={{ texto: "Ver la plataforma", href: "/plataforma" }}
        visual={<Consola titulo={s.consola.titulo} lineas={s.consola.lineas} pie="Ejemplo ilustrativo de la Bitácora de un nodo." />}
      />
      <Cifras items={s.cifras} />
      <Seccion marca="En acción" titulo="Así detecta, fija y disuade" intro="La simulación 3D del sistema: la bandada se acerca, el nodo la identifica y el pulso dirigido la dispersa.">
        <EscenaPalomas />
      </Seccion>
      <Seccion marca="01 — El problema" titulo="Por qué lo de siempre no alcanza" intro={s.problemaIntro}>
        <Rejilla puntos={s.problema} />
      </Seccion>
      <Seccion marca="02 — Con Centinela" titulo={`Lo que cambia en ${s.nombre.toLowerCase()}`}>
        <Rejilla puntos={s.ventajas} />
      </Seccion>
      <Seccion
        marca="03 — Estado del proyecto"
        titulo="Lo que ya funciona y lo que viene"
        intro="Centinela es un prototipo en desarrollo. Esto es exactamente lo que existe hoy."
      >
        <Estado hoy={ESTADO_SOLUCIONES.hoy} viene={ESTADO_SOLUCIONES.viene} />
      </Seccion>
      <CtaFinal titulo={s.ctaTitulo} texto="Cuéntanos tu caso y armamos una demostración con la cadena completa funcionando." />
    </PaginaLanding>
  )
}

import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Sobre Nosotros — Centinela AURIS",
}

const pageBlobs: GlassBlob[] = [
  { color: "#1f2836", size: "55% 40%", position: "90% 5%" },
  { color: "#4a1a22", shape: "circle", size: "9vw", position: "5% 90%" },
]

export default function SobreNosotrosPage() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 lg:px-8 pt-40 pb-24">
        <div className="max-w-2xl mx-auto text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.005em] text-balance text-white">Sobre Centinela</h1>
        </div>

        <div className="max-w-2xl mx-auto">
          <GlassPanel padding="lg" radius="lg">
            <div className="space-y-5 text-white/70 leading-relaxed">
              <p>
                Centinela nació como la exploración de un sistema inteligente de seguridad: cámaras, inteligencia
                artificial, disuasión autónoma. A partir de esa base, el proyecto se enfocó en construir lo que
                realmente se podía construir: una plataforma donde una organización registra sus incidentes de
                seguridad, los asigna a un responsable, y da seguimiento hasta resolverlos.
              </p>
              <p>
                Ese núcleo es Centinela AURIS tal como existe hoy: gestión y trazabilidad de incidentes, con
                responsabilidad clara entre quien reporta, quien resuelve y quien administra.
              </p>
              <p>
                La visión de cámaras e inteligencia artificial no se descartó — es el horizonte hacia el que este
                núcleo puede crecer, sin comprometer lo que ya funciona hoy.
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>

      <Footer />
    </main>
  )
}

import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Términos y Condiciones — Centinela AURIS",
}

const pageBlobs: GlassBlob[] = [
  { color: "#1f2836", size: "50% 30%", position: "90% 3%" },
  { color: "#4a1a22", shape: "circle", size: "8vw", position: "5% 92%" },
]

export default function TerminosPage() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 pt-40 pb-24 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-white mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-white/50 mb-8">
          Última actualización: agosto de 2026. Este documento es una versión preliminar, propia de un proyecto
          académico — no ha sido revisado por un profesional legal ni constituye un contrato vinculante.
        </p>

        <GlassPanel padding="lg" radius="lg">
          <div className="space-y-6 text-sm leading-relaxed text-white/70">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Qué es Centinela AURIS</h2>
              <p>
                Centinela AURIS es una plataforma para que una organización reporte, dé seguimiento y resuelva sus
                incidentes de seguridad. Al crear una cuenta, aceptas usarla conforme a su propósito: reportar
                incidentes reales y dar seguimiento honesto a su resolución.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Tu cuenta</h2>
              <p>
                Eres responsable de mantener la confidencialidad de tu contraseña y de toda la actividad que ocurra
                bajo tu cuenta. Notifica cualquier uso no autorizado tan pronto lo detectes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. Uso aceptable</h2>
              <p>
                No debes usar la plataforma para registrar reportes falsos, acosar a otras cuentas, ni intentar
                acceder a información que tu Rol no autoriza a ver.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Cambios a estos términos</h2>
              <p>
                Estos términos pueden actualizarse conforme el proyecto evolucione. El uso continuo de la plataforma
                después de un cambio implica su aceptación.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Contacto</h2>
              <p>Para dudas sobre estos términos: andmunz0287@gmail.com</p>
            </section>
          </div>
        </GlassPanel>
      </div>

      <Footer />
    </main>
  )
}

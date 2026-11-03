import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Política de Privacidad — Centinela AURIS",
}

const pageBlobs: GlassBlob[] = [
  { color: "#3a2614", size: "50% 30%", position: "90% 3%" },
  { color: "#4a1a22", shape: "circle", size: "8vw", position: "5% 92%" },
]

export default function PrivacidadPage() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 pt-40 pb-24 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-white mb-2">Política de Privacidad</h1>
        <p className="text-sm text-white/50 mb-8">
          Última actualización: agosto de 2026. Este documento es una versión preliminar, propia de un proyecto
          académico — no ha sido revisado por un profesional legal.
        </p>

        <GlassPanel padding="lg" radius="lg">
          <div className="space-y-6 text-sm leading-relaxed text-white/70">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Qué datos recopilamos</h2>
              <p>Al crear una cuenta, guardamos: nombre de usuario, nombre, apellido, correo electrónico y teléfono. Tu contraseña nunca se guarda en texto plano — se almacena con un hash (bcrypt), imposible de revertir a la contraseña original.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Los reportes que creas</h2>
              <p>
                Cada incidente que reportas queda asociado a tu cuenta, junto con su estado, prioridad y categoría.
                Solo tú puedes ver tus propios reportes; las cuentas con Rol Operador o Admin pueden ver el conjunto
                completo para poder resolverlos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. Recuperación de contraseña</h2>
              <p>
                Si solicitas recuperar tu contraseña, generamos un token de un solo uso con expiración de 1 hora,
                enviado a tu correo. Nunca guardamos el token en texto plano, solo su huella (hash).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Con quién compartimos tus datos</h2>
              <p>
                No vendemos ni compartimos tus datos con terceros. El asistente AURIS Chat (impulsado por Gemini,
                de Google) recibe el texto de tu conversación con él si decides usarlo, pero no tus datos de cuenta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Tus derechos</h2>
              <p>
                Puedes solicitar la corrección o eliminación de tu cuenta escribiendo a andmunz0287@gmail.com.
              </p>
            </section>
          </div>
        </GlassPanel>
      </div>

      <Footer />
    </main>
  )
}

import { Mail, MapPin, Phone } from "lucide-react"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Contacto — Centinela AURIS",
}

const pageBlobs: GlassBlob[] = [
  { color: "#3a2614", size: "60% 45%", position: "10% 5%" },
  { color: "#4a1a22", shape: "circle", size: "10vw", position: "90% 85%" },
]

const address = "Av. República 10, San Juan de Dios, 44360 Guadalajara, Jal."
const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`

export default function ContactoPage() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 lg:px-8 pt-40 pb-24">
        <div className="max-w-2xl mx-auto text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.005em] text-balance text-white">Hablemos</h1>
          <p className="text-lg text-white/60 text-balance">¿Preguntas sobre Centinela? Escríbenos directamente.</p>
        </div>

        <div className="max-w-md mx-auto">
          <GlassPanel padding="lg" radius="lg">
            <div className="space-y-6">
              <a href="mailto:andmunz0287@gmail.com" className="flex items-center gap-4 group">
                <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 bg-white/[0.06]">
                  <Mail className="h-5 w-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm text-white/50">Correo</div>
                  <div className="text-white group-hover:text-white/80 transition-colors">andmunz0287@gmail.com</div>
                </div>
              </a>

              <a href="tel:+523339694657" className="flex items-center gap-4 group">
                <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 bg-white/[0.06]">
                  <Phone className="h-5 w-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm text-white/50">Teléfono</div>
                  <div className="text-white group-hover:text-white/80 transition-colors">333 969 4657</div>
                </div>
              </a>

              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 group"
              >
                <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 bg-white/[0.06]">
                  <MapPin className="h-5 w-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-sm text-white/50">Encuéntranos</div>
                  <div className="text-white group-hover:text-white/80 transition-colors">{address}</div>
                </div>
              </a>
            </div>
          </GlassPanel>
        </div>

        <div className="max-w-3xl mx-auto mt-6">
          <GlassPanel padding="sm" radius="lg" className="overflow-hidden">
            <iframe
              src={mapSrc}
              title="Ubicación de Centinela AURIS"
              className="w-full h-80 rounded-2xl"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </GlassPanel>
        </div>
      </div>

      <Footer />
    </main>
  )
}

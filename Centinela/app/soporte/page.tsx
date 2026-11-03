import { HelpCircle, KeyRound, Mail } from "lucide-react"
import Link from "next/link"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, type GlassBlob } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"

export const metadata = {
  title: "Soporte — Centinela AURIS",
}

const paths = [
  {
    icon: HelpCircle,
    title: "Dudas frecuentes",
    description: "Respuestas directas sobre qué hace Centinela hoy y qué no.",
    href: "/#faq",
  },
  {
    icon: KeyRound,
    title: "Problemas para iniciar sesión",
    description: "Recupera el acceso a tu cuenta en un par de pasos.",
    href: "/recuperar-contrasena",
  },
  {
    icon: Mail,
    title: "Contáctanos directamente",
    description: "¿Nada de lo anterior resolvió tu duda? Escríbenos.",
    href: "/contacto",
  },
]

const pageBlobs: GlassBlob[] = [
  { color: "#4a1520", size: "55% 40%", position: "8% 8%" },
  { color: "#1f2836", shape: "circle", size: "9vw", position: "92% 88%" },
]

export default function SoportePage() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={pageBlobs} />
      <LandingNavigation />

      <div className="container mx-auto px-4 lg:px-8 pt-40 pb-24">
        <div className="max-w-2xl mx-auto text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.005em] text-balance text-white">¿Necesitas ayuda?</h1>
        </div>

        <div className="max-w-2xl mx-auto space-y-4">
          {paths.map((path) => (
            <Link key={path.title} href={path.href}>
              <GlassPanel padding="md" radius="md" className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0 bg-white/[0.06]">
                  <path.icon className="h-5 w-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">{path.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{path.description}</p>
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  )
}

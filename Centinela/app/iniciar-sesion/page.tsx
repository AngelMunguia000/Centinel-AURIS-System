import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Space_Grotesk } from "next/font/google"
import { ArrowLeft } from "lucide-react"
import Logo from "@/components/Logo"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { LoginForm } from "./LoginForm"

export const metadata: Metadata = {
  title: "Iniciar Sesión - Centinela AURIS",
  description: "Accede a tu cuenta de Centinela AURIS",
}

// Solo esta pantalla usa Space Grotesk (etiquetas técnicas del rediseño de
// acceso, prototipo inicio_de_sesi_n_modo_oscuro) — por eso se carga aquí y
// no en el layout global.
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-label" })

export default function LoginPage() {
  return (
    <main className={`${spaceGrotesk.variable} relative isolate min-h-screen bg-background`}>
      <GlassBackground blobs={consolaBlobs} />

      <Link
        href="/"
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[0.15em] text-white/50 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver al inicio
      </Link>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <div className="mb-10 text-center">
          <Logo size={72} isAnimated={true} className="mx-auto mb-6" />
          <h1 className="font-sans text-3xl font-extrabold tracking-[0.12em] text-white">CENTINELA</h1>
          <p className="mt-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[0.2em] text-white/50">
            Acceso al sistema
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-10 text-center font-[family-name:var(--font-label)] text-[9px] uppercase leading-loose tracking-[0.2em] text-white/30">
          © {new Date().getFullYear()} Centinela AURIS<br />
          Acceso restringido a personal autorizado
        </p>
      </div>
    </main>
  )
}

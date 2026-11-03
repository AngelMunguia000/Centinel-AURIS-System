import Link from "next/link"
import { Download } from "lucide-react"
import Logo from "./Logo"
import { PAGINAS_LANDING } from "@/lib/landings"

export function Footer() {
  return (
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 lg:px-8 py-12">
        {/* Lo que el PO busca al bajar hasta el final: la descarga de la app (la consola ya no abre en la web de PC). */}
        <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Centinela para Windows</p>
            <p className="mt-1 text-lg font-semibold text-foreground">Tu consola de seguridad, en el escritorio.</p>
            <p className="mt-1 text-sm text-muted-foreground">El acceso a la plataforma es desde la app de escritorio o desde tu teléfono.</p>
          </div>
          <Link
            href="/descargar"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar para Windows
          </Link>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <Logo size={28} isAnimated={true} />
            <span className="text-lg font-semibold text-foreground">
              Centinela <span className="text-brand">AURIS</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Sistema autónomo de disuasión no letal basado en visión por computadora y audio direccional de baja
            frecuencia. Prototipo en fase de investigación y desarrollo.
          </p>
        </div>

        <nav aria-label="Explorar Centinela" className="mb-8 flex flex-wrap gap-x-6 gap-y-3">
          {PAGINAS_LANDING.map((p) => (
            <Link key={p.href} href={p.href} className="text-sm text-foreground/75 hover:text-signal transition-colors">
              {p.titulo}
            </Link>
          ))}
        </nav>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© 2026 Centinela AURIS. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a href="/sobre-nosotros" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sobre nosotros
            </a>
            <a href="/soporte" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Soporte
            </a>
            <a href="/contacto" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contacto
            </a>
            <a href="/privacidad" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacidad
            </a>
            <a href="/terminos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Términos
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

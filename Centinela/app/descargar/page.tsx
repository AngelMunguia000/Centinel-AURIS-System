import type { Metadata } from "next"
import { stat } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import { AppWindow, Bell, Download, MonitorSmartphone, RefreshCw, ShieldAlert } from "lucide-react"
import { PaginaLanding, Seccion, Rejilla, Pasos, Consola } from "@/components/landing/kit"
import { Etiqueta } from "@/components/marca"
import { Aparece } from "@/components/landing/aparece"

export const metadata: Metadata = {
  title: "Descargar — Centinela AURIS",
  description: "Centinela para Windows: tu consola de seguridad en su propia ventana, con avisos aunque esté cerrada.",
}

// El ZIP lo genera Projects/Centinela-Desktop/build.ps1 y no va al repositorio (public/descargas/ ignorado).
export const dynamic = "force-dynamic"

const VERSION = "0.5.0"
const ARCHIVO = "Centinela-Desktop-Windows.zip"

async function tamanoDescarga(): Promise<string | null> {
  try {
    const { size } = await stat(path.join(process.cwd(), "public", "descargas", ARCHIVO))
    return `${(size / 1024 / 1024).toFixed(0)} MB`
  } catch {
    return null
  }
}

export default async function DescargarPage() {
  const tamano = await tamanoDescarga()

  return (
    <PaginaLanding actual="/descargar">
      <section className="pt-36 pb-16 md:pt-44 md:pb-24">
        <div className="container mx-auto px-4 lg:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          <Aparece className="space-y-6">
            <Etiqueta>Centinela para Windows · v{VERSION}</Etiqueta>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.01em] leading-[1.05] text-balance text-white">
              Tu consola de seguridad, <span className="text-brand">en el escritorio.</span>
            </h1>
            <p className="text-lg text-white/65 leading-relaxed max-w-xl text-pretty">
              Inicio, Monitor en vivo, Bitácora y Reportes en una app nativa, y un aviso de Windows en cuanto un nodo detecta algo grave o
              alguien pide ayuda, aunque la tengas cerrada.
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              {tamano ? (
                <a
                  href={`/descargas/${ARCHIVO}`}
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-7 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Descargar para Windows
                </a>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-7 py-3 text-base font-semibold text-white/50">
                  <Download className="h-5 w-5" aria-hidden="true" />
                  Descargar para Windows · pronto
                </span>
              )}
              <span className="font-mono text-xs text-white/45">
                {tamano ? `ZIP · ${tamano} · Windows 10/11 de 64 bits` : "La descarga se está preparando."}
              </span>
            </div>
          </Aparece>
          <Aparece retraso={0.15}>
            <Consola
              titulo="Avisos de Windows · Centinela"
              lineas={[
                { hora: "06:41:08", texto: "Alerta alta · Parcela norte · bandada", nivel: "alta" },
                { hora: "06:41:14", texto: "Sector 3 despejado", nivel: "ok" },
                { hora: "09:15:02", texto: "PÁNICO · Ana pidió ayuda", nivel: "alta" },
                { hora: "09:15:40", texto: "Incidencia asignada a Operador", nivel: "ok" },
              ]}
              pie="Ejemplo de los avisos que llegan a la bandeja de Windows."
            />
          </Aparece>
        </div>
      </section>

      <Seccion marca="01 — Qué te da" titulo="Lo mismo que la web, más lo que solo una app puede hacer">
        <Rejilla
          puntos={[
            { icono: AppWindow, titulo: "App nativa", texto: "Inicio, Monitor en vivo con comandos a los nodos, Bitácora y Reportes, sin navegador de por medio." },
            { icono: Bell, titulo: "Avisos aunque esté cerrada", texto: "Al cerrar la ventana sigue en la bandeja y te avisa de alertas altas y pánicos." },
            { icono: ShieldAlert, titulo: "Pánico a un clic", texto: "Desde el icono de la bandeja, con confirmación, sin abrir nada." },
            { icono: RefreshCw, titulo: "Hecha para Windows", texto: "Programada como app nativa: rápida, ligera (≈45 MB) y en vivo con tus nodos." },
          ]}
          columnas={2}
        />
      </Seccion>

      <Seccion marca="02 — Instalación" titulo="En cuatro pasos">
        <Pasos
          pasos={[
            { titulo: "Descarga", texto: "Baja el ZIP desde esta página." },
            { titulo: "Descomprime", texto: "Extrae la carpeta donde quieras, por ejemplo en Documentos." },
            { titulo: "Abre Centinela", texto: "Ejecuta Centinela.exe. Windows puede advertir porque la app aún no está firmada: elige «Más información» y «Ejecutar de todas formas»." },
            { titulo: "Inicia sesión", texto: "Escribe la dirección de tu servidor la primera vez y entra con tu cuenta." },
          ]}
        />
      </Seccion>

      <Seccion marca="03 — En el teléfono" titulo="¿Vas a usarlo desde el celular?">
        <Aparece className="flex flex-col sm:flex-row sm:items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <MonitorSmartphone className="h-8 w-8 shrink-0 text-signal" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-white/70 leading-relaxed">
            Abre la dirección de tu servidor en el navegador del teléfono: la consola se adapta a la pantalla, con su
            barra de navegación y el botón de pánico. La app móvil propia está en camino.
          </p>
          <Link href="/" className="shrink-0 text-sm font-medium text-signal hover:underline underline-offset-4">
            Volver al inicio
          </Link>
        </Aparece>
      </Seccion>
    </PaginaLanding>
  )
}

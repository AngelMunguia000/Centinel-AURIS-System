import Link from "next/link"
import { PaginaEstado } from "@/components/pagina-estado"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Página no encontrada — Centinela AURIS" }

export default function NotFound() {
  return (
    <PaginaEstado codigo="404" titulo="Esta página no existe">
      <p className="text-muted-foreground">Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button asChild>
          <Link href="/dashboard">Ir al panel</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </PaginaEstado>
  )
}

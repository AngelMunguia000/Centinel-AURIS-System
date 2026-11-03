"use client"

import { useEffect } from "react"
import Link from "next/link"
import { PaginaEstado } from "@/components/pagina-estado"
import { Button } from "@/components/ui/button"

// Cualquier error no controlado en una página cae aquí en vez de la pantalla genérica de Next.
export default function ErrorPagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PaginaEstado codigo="Error" titulo="Algo salió mal al cargar esta página">
      <p className="text-muted-foreground">
        Tus datos están a salvo. Intenta de nuevo; si se repite, avisa a soporte
        {error.digest ? <> con el código <code className="font-mono">{error.digest}</code></> : null}.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/soporte">Soporte</Link>
        </Button>
      </div>
    </PaginaEstado>
  )
}

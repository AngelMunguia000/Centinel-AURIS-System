"use client"

import type React from "react"
import { GlassBackground } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"

// Marco común de las páginas 404 y de error: mismo vidrio que el resto del sitio.
export function PaginaEstado({ codigo, titulo, children }: { codigo: string; titulo: string; children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center bg-background px-4">
      <GlassBackground />
      <GlassPanel className="w-full max-w-md text-center space-y-4" padding="lg">
        <p className="font-mono text-sm text-muted-foreground">{codigo}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.005em] text-balance text-foreground">{titulo}</h1>
        {children}
      </GlassPanel>
    </main>
  )
}

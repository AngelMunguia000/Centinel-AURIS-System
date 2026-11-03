"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Identidad negro + carmesí (docs/diseno/2026-10-23-identidad-carmesi-design.md):
// toda la web es solo oscura. Se fuerza "dark" para que las clases `dark:` sigan aplicando
// e ignorar un "light" guardado por el antiguo botón de tema.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props} forcedTheme="dark">
      {children}
    </NextThemesProvider>
  )
}

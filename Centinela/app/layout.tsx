import type React from "react"
import type { Metadata } from "next"
import { Inter_Tight, IBM_Plex_Mono } from "next/font/google"
import { MotionConfig } from "motion/react"
import "./globals.css"
import { ChatProvider } from "@/components/chat-provider"
import { ThemeProvider } from "@/components/theme-provider"
import ClientLoaderWrapper from "@/components/ClientLoaderWrapper"

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight" })
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "500", "600"] })

export const metadata: Metadata = {
  title: "Centinela AURIS — Seguridad Inteligente",
  description: "Protección Inteligente en Tiempo Real con tecnología de visión artificial",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${interTight.variable} ${plexMono.variable} font-sans antialiased`}>
        <ClientLoaderWrapper>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <MotionConfig reducedMotion="user">
              {children}
              <ChatProvider />
            </MotionConfig>
          </ThemeProvider>
        </ClientLoaderWrapper>
      </body>
    </html>
  )
}

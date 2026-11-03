"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Github } from "lucide-react"
import { Button } from "@/components/ui/button"

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.26a12 12 0 0 0 0 10.78l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  )
}

interface OAuthButtonsProps {
  /** Texto del separador — cambia según el contexto (login vs. registro). */
  label?: string
}

// Mismo botón/lógica para /iniciar-sesion y /registrarse: el flujo de Auth.js
// (auth.ts, resolveOAuthSignIn) ya decide por sí mismo si es una Cuenta nueva
// o una que inicia sesión — no hay una acción "solo registrar" distinta.
export function OAuthButtons({ label = "O continúa con" }: OAuthButtonsProps) {
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null)

  const handleOAuthSignIn = (provider: "google" | "github") => {
    setOauthLoading(provider)
    signIn(provider, { callbackUrl: "/api/auth/complete" })
  }

  return (
    <>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-popover px-2 text-white/50">{label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
          disabled={oauthLoading !== null}
          onClick={() => handleOAuthSignIn("google")}
        >
          <GoogleIcon />
          {oauthLoading === "google" ? "Conectando…" : "Google"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
          disabled={oauthLoading !== null}
          onClick={() => handleOAuthSignIn("github")}
        >
          <Github className="size-4" />
          {oauthLoading === "github" ? "Conectando…" : "GitHub"}
        </Button>
      </div>
    </>
  )
}

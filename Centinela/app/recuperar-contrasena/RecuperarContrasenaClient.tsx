"use client"

import type React from "react"
import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Mail, Lock, CheckCircle2, Loader2, ArrowRight, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatePresence, motion } from "motion/react"
import { alertBanner } from "@/lib/motion-variants"

function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setStatus("submitting")

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error al procesar la solicitud")
        setStatus("idle")
        return
      }

      setStatus("sent")
    } catch (err) {
      console.error(err)
      setError("Error del servidor")
      setStatus("idle")
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.005em] text-white mb-4">Revisa tu correo</h1>
        <p className="text-white/50 mb-6">
          Si <span className="font-medium" style={{ color: "var(--accent-foreground)" }}>{email}</span> está registrado, te enviamos un enlace
          para restablecer tu contraseña. Revisa también tu carpeta de spam.
        </p>
        <Link href="/iniciar-sesion" className="hover:text-white transition-colors text-sm" style={{ color: "var(--accent-foreground)" }}>
          Volver a iniciar sesión
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.005em] text-white text-center">Recuperar contraseña</h1>
        <p className="text-white/50 text-center mt-2">
          Ingresa tu correo y te enviaremos un enlace para restablecerla
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/70">
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tu@email.com"
              className="pl-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={status === "submitting"}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
        >
          {status === "submitting" ? "Enviando…" : "Enviar enlace de recuperación"}
        </Button>
      </form>

      <p className="text-center text-sm text-white/50 mt-6">
        <Link href="/iniciar-sesion" className="hover:text-white transition-colors font-medium" style={{ color: "var(--accent-foreground)" }}>
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  )
}

function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "invalid">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    setStatus("submitting")

    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("invalid")
        setError(data.error || "El enlace de recuperación no es válido o ha expirado.")
        return
      }

      setStatus("success")
    } catch (err) {
      console.error(err)
      setStatus("idle")
      setError("Error del servidor")
    }
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.005em] text-white mb-4">Contraseña actualizada</h1>
        <p className="text-white/50 mb-6">Ya puedes iniciar sesión con tu nueva contraseña.</p>
        <Button
          asChild
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
        >
          <Link href="/iniciar-sesion">
            Iniciar sesión
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>
    )
  }

  if (status === "invalid") {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.005em] text-white mb-4">Enlace inválido</h1>
        <p className="text-white/50 mb-6">
          {error || "El enlace de recuperación no es válido o ha expirado."}
        </p>
        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
          >
            <Link href="/recuperar-contrasena">Solicitar un nuevo enlace</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
            <Link href="/iniciar-sesion">Ir a Iniciar Sesión</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-[-0.005em] text-white text-center">Nueva contraseña</h1>
        <p className="text-white/50 text-center mt-2">Elige una nueva contraseña para tu cuenta</p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/70">
            Nueva contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="pl-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white/70">
            Confirmar contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              className="pl-10 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={status === "submitting"}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
        >
          {status === "submitting" ? "Guardando…" : "Restablecer contraseña"}
        </Button>
      </form>
    </>
  )
}

function RecuperarContrasenaContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  return (
    <div className="relative z-10 w-full max-w-md mx-4">
      <GlassPanel padding="lg" radius="lg">
        {token ? <ResetPasswordForm token={token} /> : <ForgotPasswordForm />}
      </GlassPanel>
    </div>
  )
}

export function RecuperarContrasenaClient() {
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <LandingNavigation />

      <div className="flex items-center justify-center min-h-screen pt-16">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-foreground)" }} />
            </div>
          }
        >
          <RecuperarContrasenaContent />
        </Suspense>
      </div>
    </main>
  )
}

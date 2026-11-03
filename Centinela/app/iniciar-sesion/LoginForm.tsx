"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { User, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { OAuthButtons } from "@/components/oauth-buttons"
import { GlassPanel } from "@/components/glass-panel"
import { AnimatePresence, motion } from "motion/react"
import { alertBanner } from "@/lib/motion-variants"

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  correo_ya_registrado: "Ya existe una cuenta con ese correo. Inicia sesión con tu contraseña.",
  oauth_fallido: "No se pudo completar el inicio de sesión. Intenta de nuevo.",
}

// Rediseño de acceso (prototipo inicio_de_sesi_n_modo_oscuro): campos de solo
// línea inferior, etiquetas técnicas en mayúsculas y acento rojo. Sin los
// elementos decorativos del prototipo que afirmaban cosas falsas (ISO 27001,
// GDPR, IP/coordenadas, "Secure Node") — decisión del PO, 2026-09-21.
const LABEL_FONT = "font-[family-name:var(--font-label)]"
const LABEL_CLASS = `${LABEL_FONT} text-[10px] font-bold uppercase tracking-[0.15em] text-white/60`
const FIELD_CLASS =
  "rounded-none border-0 border-b-2 border-white/15 bg-transparent px-0 pr-9 py-3 text-white shadow-none " +
  "placeholder:text-white/30 focus-visible:border-ring focus-visible:ring-0"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [recordarme, setRecordarme] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const oauthError = searchParams.get("error")
  const [error, setError] = useState(
    oauthError ? OAUTH_ERROR_MESSAGES[oauthError] ?? OAUTH_ERROR_MESSAGES.oauth_fallido : ""
  )

  // Verificación en dos pasos (lib/dos-pasos.ts): tras la contraseña o el OAuth llega un desafío
  // y aquí se pide el código de la app o uno de respaldo.
  const [desafio, setDesafio] = useState(searchParams.get("desafio") ?? "")
  const [codigo, setCodigo] = useState("")

  const handleCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ desafio, codigo }),
      })
      const data = await res.json()
      if (!res.ok) {
        // 400 = el desafío venció: se vuelve a pedir la contraseña.
        if (res.status === 400) {
          setDesafio("")
          setCodigo("")
        }
        setError(data.error || "No se pudo verificar el código")
        return
      }
      window.location.assign(new URL("/dashboard", window.location.origin))
    } catch {
      setError("Error del servidor")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ IMPORTANTE: para guardar cookies
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          recordarme,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión")
        return
      }
      if (data.requiere2fa) {
        setDesafio(data.desafio)
        return
      }

      // Todos los roles entran al Inicio (/dashboard): saludo, estado del día y accesos
      // según permisos, incluida la Cola de trabajo del Operador (2026-10-23, pedido del PO).
      // Usar window.location en lugar de router.push para evitar problemas de timing
      window.location.assign(new URL('/dashboard', window.location.origin))
    } catch (error) {
      console.error(error)
      setError("Error del servidor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative z-10 w-full max-w-[440px]">
      <GlassPanel padding="lg" radius="sm">
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {desafio ? (
          <form className="space-y-8" onSubmit={handleCodigo}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-white/60" aria-hidden="true" />
              <p className="text-sm text-white/70">
                Escribe el código de 6 dígitos de tu app de autenticación. Si no tienes el teléfono, usa uno de tus códigos de respaldo.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo" className={LABEL_CLASS}>
                Código de verificación
              </Label>
              <Input
                id="codigo"
                name="codigo"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                placeholder="123 456"
                className={`${FIELD_CLASS} font-mono tracking-[0.3em]`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                maxLength={20}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || codigo.trim().length < 6}
              className="w-full rounded-none bg-primary py-6 font-semibold tracking-[0.08em] text-white hover:bg-primary/85 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verificando…" : "VERIFICAR"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setDesafio("")
                setCodigo("")
                setError("")
              }}
              className="w-full text-center text-sm text-white/50 hover:text-white transition-colors"
            >
              Volver
            </button>
          </form>
        ) : (
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email" className={LABEL_CLASS}>
              Correo electrónico
            </Label>
            <div className="relative">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                className={FIELD_CLASS}
                value={formData.email}
                onChange={handleChange}
                required
              />
              <User className="pointer-events-none absolute right-0 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className={LABEL_CLASS}>
              Contraseña
            </Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className={FIELD_CLASS}
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {showPassword ? (
                    <motion.span
                      key="eye-off"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="block"
                    >
                      <EyeOff className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="eye"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="block"
                    >
                      <Eye className="h-5 w-5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={recordarme}
                onCheckedChange={(checked) => setRecordarme(checked as boolean)}
                className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#0a0a0c] data-[state=checked]:border-white"
              />
              <Label htmlFor="remember" className="text-sm text-white/50 cursor-pointer">
                Recordarme
              </Label>
            </div>
            <Link
              href="/recuperar-contrasena"
              className={`${LABEL_FONT} text-[10px] uppercase tracking-wider text-white/50 hover:text-white transition-colors`}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="group w-full rounded-none bg-primary py-6 font-semibold tracking-[0.08em] text-white hover:bg-primary/85 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              "Verificando…"
            ) : (
              <>
                ACCEDER AL SISTEMA
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
        )}

        {!desafio && <OAuthButtons />}

        {!desafio && (
        <p className="text-center text-sm text-white/50 mt-6">
          ¿No tienes una cuenta?{" "}
          <Link href="/registrarse" className="hover:text-white transition-colors font-medium" style={{ color: "var(--accent-foreground)" }}>
            Regístrate aquí
          </Link>
        </p>
        )}
      </GlassPanel>
    </div>
  )
}

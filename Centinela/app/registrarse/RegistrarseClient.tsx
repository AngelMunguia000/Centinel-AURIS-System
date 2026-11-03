"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { OAuthButtons } from "@/components/oauth-buttons"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { isValidEmail } from "@/lib/validation"
import { AnimatePresence, motion } from "motion/react"
import { alertBanner } from "@/lib/motion-variants"

interface FormErrors {
  [key: string]: string
}

export function RegistrarseClient() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [registeredUser, setRegisteredUser] = useState<{ email: string } | null>(null)

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    acceptPrivacy: false,
  })

  // Derivado de formData.password en cada render — no necesita su propio
  // estado/efecto (react-hooks/set-state-in-effect, auditoría 26 ago).
  const passwordStrength = (() => {
    const password = formData.password
    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^a-zA-Z0-9]/.test(password)) strength++
    return strength
  })()

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return "bg-red-500"
    if (passwordStrength <= 3) return "bg-yellow-500"
    if (passwordStrength <= 4) return "bg-primary"
    return "bg-green-500"
  }

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return ""
    if (passwordStrength <= 2) return "Muy débil"
    if (passwordStrength <= 3) return "Débil"
    if (passwordStrength <= 4) return "Buena"
    return "Excelente"
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.email || !isValidEmail(formData.email)) {
      newErrors.email = "Ingresa un correo válido"
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = "Mínimo 8 caracteres"
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden"
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "Debes aceptar los términos"
    }
    if (!formData.acceptPrivacy) {
      newErrors.acceptPrivacy = "Debes aceptar la política de privacidad"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setRegisteredUser({ email: formData.email })
        setIsSuccess(true)
      } else {
        setErrors({ submit: data.error || "Error al procesar el registro" })
      }
    } catch (error) {
      console.error("Error al registrar:", error)
      setErrors({ submit: "Error de conexión. Intenta nuevamente." })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── REGISTRO ────────────────────────────────────────────────────────────────
  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <LandingNavigation />

      <div className="flex items-center justify-center min-h-screen pt-20 px-4">
        <AnimatePresence mode="wait">
          {isSuccess && registeredUser ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-lg"
            >
              <GlassPanel padding="lg" radius="lg">

                {/* Ícono de éxito */}
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-20 h-20 bg-green-500/20 border border-green-500/30 rounded-full flex items-center justify-center mb-5 motion-safe:animate-pulse">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <h1 className="text-3xl font-semibold tracking-[-0.005em] text-white mb-1">¡Cuenta creada!</h1>
                  <p className="text-white/50">
                    Bienvenido a Centinela AURIS,{" "}
                    <span className="font-semibold" style={{ color: "var(--accent-foreground)" }}>{registeredUser.email}</span>
                  </p>
                </div>

                {/* CTA — ir a iniciar sesión */}
                <Button
                  onClick={() => router.push("/iniciar-sesion")}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300 text-sm flex items-center justify-center gap-2 mb-6"
                >
                  Iniciar sesión
                  <ArrowRight className="w-4 h-4" />
                </Button>

                {/* Qué incluye tu cuenta */}
                <div className="bg-white/[0.04] rounded-xl p-4">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                    Tu cuenta incluye
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Reportar incidentes en segundos",
                      "Seguimiento de tus reportes: pendiente o resuelto",
                      "Historial completo de tus incidencias",
                      "Soporte técnico",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-white/60">
                        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </GlassPanel>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md"
            >

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-white/[0.06]">
              <ShieldCheck className="w-8 h-8" style={{ color: "var(--accent-foreground)" }} />
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.005em] text-white mb-2">Crear cuenta</h1>
            <p className="text-white/50 text-sm">
              Solo necesitamos lo esencial para empezar
            </p>
          </div>

          {/* Card */}
          <GlassPanel padding="md" radius="lg">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Error global */}
              <AnimatePresence>
                {errors.submit && (
                  <motion.div
                    role="alert"
                    aria-live="polite"
                    variants={alertBanner}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center"
                  >
                    {errors.submit}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-white/70">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={`pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10 ${
                      errors.email ? "border-red-500/60" : ""
                    }`}
                    autoComplete="email"
                  />
                </div>
                <AnimatePresence>
                  {errors.email && (
                    <motion.p
                      variants={alertBanner}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="text-xs text-red-300"
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-white/70">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className={`pl-9 pr-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10 ${
                      errors.password ? "border-red-500/60" : ""
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
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
                          <EyeOff className="w-4 h-4" />
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
                          <Eye className="w-4 h-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
                {/* Barra de fortaleza */}
                {formData.password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= Math.ceil((passwordStrength / 6) * 5)
                              ? getPasswordStrengthColor()
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                    {getPasswordStrengthText() && (
                      <p className="text-xs text-white/50">{getPasswordStrengthText()}</p>
                    )}
                  </div>
                )}
                <AnimatePresence>
                  {errors.password && (
                    <motion.p
                      variants={alertBanner}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="text-xs text-red-300"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Confirmar contraseña */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-white/70">
                  Confirmar contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    className={`pl-9 pr-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10 ${
                      errors.confirmPassword ? "border-red-500/60" : ""
                    }`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {showConfirmPassword ? (
                        <motion.span
                          key="eye-off"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                          className="block"
                        >
                          <EyeOff className="w-4 h-4" />
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
                          <Eye className="w-4 h-4" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
                <AnimatePresence>
                  {errors.confirmPassword && (
                    <motion.p
                      variants={alertBanner}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="text-xs text-red-300"
                    >
                      {errors.confirmPassword}
                    </motion.p>
                  )}
                </AnimatePresence>
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                  </p>
                )}
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-1">
                <div className={`flex items-start gap-3 ${errors.acceptTerms ? "p-2 rounded-lg bg-red-500/5 border border-red-500/20" : ""}`}>
                  <Checkbox
                    id="acceptTerms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => handleInputChange("acceptTerms", checked as boolean)}
                    className="mt-0.5 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#0a0a0c] data-[state=checked]:border-white"
                  />
                  <Label htmlFor="acceptTerms" className="text-xs text-white/50 cursor-pointer leading-relaxed">
                    Acepto los{" "}
                    <Link href="/terminos" className="hover:underline" style={{ color: "var(--accent-foreground)" }}>
                      Términos y Condiciones
                    </Link>{" "}
                    del servicio
                  </Label>
                </div>

                <div className={`flex items-start gap-3 ${errors.acceptPrivacy ? "p-2 rounded-lg bg-red-500/5 border border-red-500/20" : ""}`}>
                  <Checkbox
                    id="acceptPrivacy"
                    checked={formData.acceptPrivacy}
                    onCheckedChange={(checked) => handleInputChange("acceptPrivacy", checked as boolean)}
                    className="mt-0.5 border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#0a0a0c] data-[state=checked]:border-white"
                  />
                  <Label htmlFor="acceptPrivacy" className="text-xs text-white/50 cursor-pointer leading-relaxed">
                    He leído y acepto la{" "}
                    <Link href="/privacidad" className="hover:underline" style={{ color: "var(--accent-foreground)" }}>
                      Política de Privacidad
                    </Link>
                  </Label>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300 h-11 text-sm font-semibold mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <OAuthButtons label="O regístrate con" />
          </GlassPanel>

          {/* Login link */}
          <p className="text-center text-sm text-white/50 mt-6">
            ¿Ya tienes una cuenta?{" "}
            <Link
              href="/iniciar-sesion"
              className="hover:text-white transition-colors font-medium"
              style={{ color: "var(--accent-foreground)" }}
            >
              Inicia sesión aquí
            </Link>
          </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

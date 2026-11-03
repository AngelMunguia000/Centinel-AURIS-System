"use client"

import { useState } from "react"
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, User as UserIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GlassPanel } from "@/components/glass-panel"
import { AnimatePresence, motion } from "motion/react"
import { alertBanner } from "@/lib/motion-variants"
import { EncabezadoVista } from "@/components/marca"
import { SesionesActivas } from "./SesionesActivas"
import { DosPasos } from "./DosPasos"
import { ResumenSemanal } from "./ResumenSemanal"

interface UsuarioAjustes {
  nombre: string
  apellido: string
  username: string | null
  email: string
  telefono: string
  rol: string
  ultimoLoginAnterior: string | null
  tieneContrasena: boolean
}

function formatearFecha(iso: string | null): string {
  if (!iso) return "Esta es tu primera sesión"
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
  })
}

export function AjustesClient({ usuario }: { usuario: UsuarioAjustes }) {
  return (
    <div className="relative z-10 container mx-auto px-4 lg:px-8 py-12 max-w-2xl">
      <EncabezadoVista
        titulo="Ajustes"
        bajada={`Última conexión: ${formatearFecha(usuario.ultimoLoginAnterior)}`}
      />

      <div className="space-y-6">
        <PerfilForm usuario={usuario} />
        {usuario.tieneContrasena ? (
          <PasswordForm />
        ) : (
          <GlassPanel padding="md" radius="lg">
            <p className="text-sm text-foreground/50">
              Esta cuenta inició sesión con Google o GitHub y no tiene contraseña propia.
            </p>
          </GlassPanel>
        )}
        <DosPasos />
        <SesionesActivas />
        <ResumenSemanal />
      </div>
    </div>
  )
}

function PerfilForm({ usuario }: { usuario: UsuarioAjustes }) {
  const [formData, setFormData] = useState({
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    username: usuario.username ?? "",
    telefono: usuario.telefono,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess(false)

    try {
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellido,
          username: formData.username.trim() === "" ? null : formData.username,
          telefono: formData.telefono,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al actualizar el perfil")
        return
      }
      setSuccess(true)
    } catch {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassPanel padding="md" radius="lg">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <UserIcon className="h-5 w-5 text-accent-foreground" />
        Perfil
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre" className="text-sm font-medium text-foreground/70">Nombre</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              className="bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apellido" className="text-sm font-medium text-foreground/70">Apellido</Label>
            <Input
              id="apellido"
              value={formData.apellido}
              onChange={(e) => handleChange("apellido", e.target.value)}
              className="bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-sm font-medium text-foreground/70">Nombre de usuario</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => handleChange("username", e.target.value)}
            placeholder="Opcional"
            className="bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telefono" className="text-sm font-medium text-foreground/70">Teléfono</Label>
          <Input
            id="telefono"
            value={formData.telefono}
            onChange={(e) => handleChange("telefono", e.target.value)}
            className="bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground/40">Correo electrónico</Label>
          <p className="text-sm text-foreground/50">{usuario.email}</p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
          <AnimatePresence>
            {success && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-green-400 flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" /> Guardado
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </form>
    </GlassPanel>
  )
}

function PasswordForm() {
  const [formData, setFormData] = useState({ actual: "", nueva: "", confirmar: "" })
  const [showActual, setShowActual] = useState(false)
  const [showNueva, setShowNueva] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)

    if (formData.nueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres")
      return
    }
    if (formData.nueva !== formData.confirmar) {
      setError("Las contraseñas nuevas no coinciden")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/perfil/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          passwordActual: formData.actual,
          passwordNueva: formData.nueva,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al actualizar la contraseña")
        return
      }
      setSuccess(true)
      setFormData({ actual: "", nueva: "", confirmar: "" })
    } catch {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassPanel padding="md" radius="lg">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Lock className="h-5 w-5 text-accent-foreground" />
        Contraseña
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="space-y-1.5">
          <Label htmlFor="actual" className="text-sm font-medium text-foreground/70">Contraseña actual</Label>
          <div className="relative">
            <Input
              id="actual"
              type={showActual ? "text" : "password"}
              value={formData.actual}
              onChange={(e) => handleChange("actual", e.target.value)}
              autoComplete="current-password"
              className="pr-9 bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
            />
            <button
              type="button"
              onClick={() => setShowActual((v) => !v)}
              aria-label={showActual ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
            >
              {showActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nueva" className="text-sm font-medium text-foreground/70">Nueva contraseña</Label>
            <div className="relative">
              <Input
                id="nueva"
                type={showNueva ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={formData.nueva}
                onChange={(e) => handleChange("nueva", e.target.value)}
                autoComplete="new-password"
                className="pr-9 bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShowNueva((v) => !v)}
                aria-label={showNueva ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground transition-colors"
              >
                {showNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar" className="text-sm font-medium text-foreground/70">Confirmar</Label>
            <Input
              id="confirmar"
              type={showNueva ? "text" : "password"}
              value={formData.confirmar}
              onChange={(e) => handleChange("confirmar", e.target.value)}
              autoComplete="new-password"
              className="bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Cambiar contraseña"
            )}
          </Button>
          <AnimatePresence>
            {success && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm text-green-400 flex items-center gap-1"
              >
                <CheckCircle2 className="w-4 h-4" /> Actualizada
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </form>
    </GlassPanel>
  )
}

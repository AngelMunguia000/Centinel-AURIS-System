"use client"

import { useState } from "react"
import Link from "next/link"
import { LandingNavigation } from "@/components/landing-navigation"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle2, Mail, Loader2 } from "lucide-react"
import { isValidEmail } from "@/lib/validation"
import { AnimatePresence, motion } from "motion/react"

type Answer = {
  manejoActual?: string
  ubicacion?: string
  preocupacion?: string
  tipo?: string
  eticaNoAgresion?: string
  zonas?: string
  velocidad?: string
  canal?: string
  urgencia?: string
  correo?: string
}

const steps = [
  {
    id: "manejoActual" as const,
    type: "choice" as const,
    title: "¿Cómo manejan hoy sus incidentes de seguridad?",
    options: [
      { value: "informal", label: "Por correo o WhatsApp, de forma informal" },
      { value: "hoja", label: "En una hoja de cálculo" },
      { value: "otro-sistema", label: "Ya usamos otro sistema" },
      { value: "nada", label: "No tenemos un proceso definido" },
    ],
  },
  {
    id: "ubicacion" as const,
    type: "choice" as const,
    title: "¿Dónde se usaría Centinela?",
    options: [
      { value: "urbano", label: "Zona urbana" },
      { value: "rural", label: "Zona rural o agrícola" },
      { value: "industrial", label: "Planta o zona industrial" },
      { value: "institucional", label: "Campus o institución" },
    ],
  },
  {
    id: "preocupacion" as const,
    type: "choice" as const,
    title: "¿Qué te preocupa más?",
    options: [
      { value: "personas", label: "Personas no autorizadas" },
      { value: "fauna", label: "Fauna o animales" },
      { value: "ambos", label: "Ambos por igual" },
      { value: "vehiculos", label: "Vehículos o accesos" },
    ],
  },
  {
    id: "tipo" as const,
    type: "choice" as const,
    title: "¿Qué tipo de Centinela buscas?",
    options: [
      { value: "vigilancia", label: "Vigilancia — detectar y dar seguimiento a incidentes" },
      { value: "vigilancia-disuasion", label: "Vigilancia con disuasión activa" },
      { value: "disuasion", label: "Solo disuasión, sin vigilancia constante" },
      { value: "disuasion-agricola", label: "Disuasión especializada para fauna en zonas agrícolas" },
    ],
  },
  {
    id: "eticaNoAgresion" as const,
    type: "choice" as const,
    title: "¿Qué tan importante es que el sistema no actúe de forma agresiva con personas inocentes?",
    options: [
      { value: "muy", label: "Muy importante, es una prioridad" },
      { value: "algo", label: "Algo importante" },
      { value: "no-prioridad", label: "No es una prioridad para nosotros" },
    ],
  },
  {
    id: "zonas" as const,
    type: "choice" as const,
    title: "¿Cuántas zonas o ubicaciones necesitas cubrir?",
    options: [
      { value: "una", label: "Una sola ubicación" },
      { value: "varias-cercanas", label: "Varias, cercanas entre sí" },
      { value: "dispersas", label: "Dispersas en distintas ciudades" },
    ],
  },
  {
    id: "velocidad" as const,
    type: "choice" as const,
    title: "¿Qué tan rápido necesitas que se detecte y reporte un incidente?",
    options: [
      { value: "tiempo-real", label: "En tiempo real" },
      { value: "minutos", label: "En minutos está bien" },
      { value: "no-critico", label: "No es crítico, con revisiones periódicas basta" },
    ],
  },
  {
    id: "canal" as const,
    type: "choice" as const,
    title: "¿Desde dónde prefieres reportar incidentes?",
    options: [
      { value: "web", label: "Desde la web" },
      { value: "app", label: "Desde una app móvil" },
      { value: "da-igual", label: "Me da igual, lo que sea más simple" },
    ],
  },
  {
    id: "urgencia" as const,
    type: "choice" as const,
    title: "¿Qué tan urgente es esto para tu organización?",
    options: [
      { value: "ya", label: "Lo necesitamos ya" },
      { value: "meses", label: "En los próximos meses" },
      { value: "explorando", label: "Solo estamos explorando opciones" },
    ],
  },
  {
    id: "correo" as const,
    type: "email" as const,
    title: "¿A qué correo te contactamos?",
  },
]

export function CuestionarioClient() {
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Answer>({})
  const [showResult, setShowResult] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [emailSent, setEmailSent] = useState(false)

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleAnswer = (stepId: keyof Answer, value: string) => {
    setAnswers((prev) => ({ ...prev, [stepId]: value }))
  }

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
      return
    }

    setSubmitting(true)
    setSubmitError("")

    try {
      const res = await fetch("/api/cuestionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: answers.correo, answers }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setSubmitError(data.error || "No se pudo enviar tu información. Intenta de nuevo.")
        return
      }

      setEmailSent(!!data.emailSent)
      setShowResult(true)
    } catch (error) {
      console.error("Error al enviar el cuestionario:", error)
      setSubmitError("Error de conexión. Intenta de nuevo.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleRestart = () => {
    setCurrentStep(0)
    setAnswers({})
    setShowResult(false)
    setSubmitError("")
    setEmailSent(false)
  }

  const currentStepData = steps[currentStep]
  const currentAnswer = answers[currentStepData?.id]
  const emailValid = currentStepData?.type === "email" && !!currentAnswer && isValidEmail(currentAnswer)

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <LandingNavigation />

      <AnimatePresence mode="wait">
        {showResult ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="container mx-auto px-4 py-24 lg:py-32 pt-40"
          >
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h1 className="text-4xl lg:text-5xl font-semibold tracking-[-0.005em] text-white mb-4">¡Gracias!</h1>

              <GlassPanel padding="lg" radius="lg" className="text-left mt-8">
                <p className="text-lg text-white/60 leading-relaxed">
                  {emailSent ? (
                    <>
                      Recibimos tu información y te enviamos un correo a{" "}
                      <span className="font-medium" style={{ color: "var(--accent-foreground)" }}>{answers.correo}</span> con los
                      siguientes pasos.
                    </>
                  ) : (
                    <>
                      Recibimos tu información. Nuestro equipo se pondrá en contacto contigo
                      {answers.correo ? (
                        <>
                          {" "}
                          a <span className="font-medium" style={{ color: "var(--accent-foreground)" }}>{answers.correo}</span>
                        </>
                      ) : null}{" "}
                      pronto para platicar sobre cómo Centinela puede ayudar a tu organización.
                    </>
                  )}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <Button asChild size="lg" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300">
                    <Link href="/">Volver al inicio</Link>
                  </Button>
                  <Button size="lg" variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent" onClick={handleRestart}>
                    Reintentar
                  </Button>
                </div>
              </GlassPanel>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="wizard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="container mx-auto px-4 py-24 lg:py-32 pt-40"
          >
            <div className="max-w-2xl mx-auto">
              {/* Header */}
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 mb-4">
                  <Sparkles className="h-8 w-8" style={{ color: "var(--accent-foreground)" }} />
                </div>
                <h1 className="text-3xl lg:text-4xl font-semibold tracking-[-0.005em] text-white mb-3">Encuentra tu Centinela</h1>
                <p className="text-lg text-white/60 max-w-xl mx-auto">
                  Diez preguntas rápidas, y te contactamos.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white/50">
                    Pregunta {currentStep + 1} de {steps.length}
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--accent-foreground)" }}>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Step Card */}
              <GlassPanel padding="lg" radius="lg">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <h2 className="text-2xl lg:text-3xl font-semibold tracking-[-0.005em] text-white mb-8 text-balance">
                      {currentStepData.title}
                    </h2>

                    {currentStepData.type === "choice" ? (
                      <div className="space-y-3 mb-8">
                        {currentStepData.options.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleAnswer(currentStepData.id, option.value)}
                            className={`w-full p-4 lg:p-5 rounded-lg border text-left transition-[border-color,background-color,box-shadow,transform] duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02] ${
                              currentAnswer === option.value
                                ? "border-white/40 bg-white/10 shadow-lg shadow-black/20"
                                : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="text-base lg:text-lg font-medium text-white">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mb-8">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            value={currentAnswer ?? ""}
                            onChange={(e) => handleAnswer(currentStepData.id, e.target.value)}
                            className="pl-10 h-14 text-lg bg-white/[0.04] border-white/10 text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:ring-white/10"
                          />
                        </div>
                        {submitError && <p className="text-sm text-red-300 mt-3">{submitError}</p>}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className="flex-1 border-white/20 text-white hover:bg-white/10 bg-transparent"
                  >
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    Atrás
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleNext}
                    disabled={(currentStepData.type === "email" ? !emailValid : !currentAnswer) || submitting}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-shadow duration-300"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        {currentStep === steps.length - 1 ? "Enviar" : "Siguiente"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </div>
              </GlassPanel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  )
}

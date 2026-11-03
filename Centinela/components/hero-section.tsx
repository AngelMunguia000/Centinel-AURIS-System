"use client"

import { Button } from "@/components/ui/button"
import { AnimatedHeadline } from "@/components/animated-headline"
import { LensIllustration } from "@/components/illustrations/lens-illustration"
import { GlassPanel } from "@/components/glass-panel"
import { fadeInUp, staggerContainer, viewportOnce } from "@/lib/motion-variants"
import { motion } from "motion/react"
import { Sparkles } from "lucide-react"
import Link from "next/link"

const stats = [
  { value: "3–5s", label: "Duración del pulso de disuasión por evento confirmado" },
  { value: "180°", label: "De cobertura horizontal por unidad" },
  { value: "IP66", label: "Carcasa sellada para intemperie" },
]

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center overflow-hidden pt-16">

      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <GlassPanel padding="lg" radius="lg" className="max-w-2xl">
            <div
              className="w-9 h-9 rounded-[11px] mb-5"
              style={{ background: "linear-gradient(135deg, #e0a83a, #7a5418)", boxShadow: "0 4px 16px rgba(224,168,58,0.3)" }}
            />

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-[-0.01em] text-balance leading-[1.05] text-white">
              <AnimatedHeadline text="Detecta. Localiza. Disuade." acento="Disuade." />
            </h1>

            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
              className="text-base md:text-lg text-white/60 text-balance leading-relaxed mt-4"
            >
              Centinela combina visión por computadora en tiempo real con la emisión focalizada de audio de baja
              frecuencia para alejar aves de cultivos y buques cargueros — sin químicos, sin pirotecnia y sin
              ruido constante.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.55 }}
              className="flex flex-col sm:flex-row items-start gap-4 pt-6"
            >
              <Link href="/cuestionario">
                <Button
                  size="lg"
                  className="text-base px-8 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Solicitar una demostración
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 border-white/20 text-white hover:bg-white/10"
                asChild
              >
                <a href="#especificaciones">Ver especificaciones</a>
              </Button>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              variants={staggerContainer(0.1)}
              className="grid grid-cols-3 gap-6 pt-8 max-w-md"
            >
              {stats.map((stat) => (
                <motion.div key={stat.label} variants={fadeInUp} className="space-y-1">
                  <div className="text-2xl md:text-3xl font-mono font-medium tracking-tight text-white">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </GlassPanel>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:flex justify-end text-white/40"
          >
            <LensIllustration className="w-64 h-64" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

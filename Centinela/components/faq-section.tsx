"use client"

import { GlassPanel } from "@/components/glass-panel"
import { motion } from "motion/react"
import { fadeInUp, staggerContainer, viewportOnce } from "@/lib/motion-variants"

const faqs = [
  {
    question: "¿Centinela usa cámaras o inteligencia artificial?",
    answer:
      "Hoy no. Centinela ordena cómo se reportan, asignan y resuelven incidentes. La detección automática es el horizonte hacia el que puede crecer, no una función actual.",
  },
  {
    question: "¿Necesito capacitar a mi equipo para usarlo?",
    answer: "No. Reportar un incidente toma segundos y no requiere entrenamiento previo.",
  },
  {
    question: "¿Qué pasa con los reportes que ya tenemos por correo o WhatsApp?",
    answer: "Se quedan donde están. Centinela no migra tu historial: ordena todo lo que llega de aquí en adelante.",
  },
  {
    question: "¿Quién puede ver qué reporta cada persona?",
    answer: "Solo quien resuelve incidentes y quien administra la cuenta ven todos los reportes. Quien reporta ve únicamente los suyos.",
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-16 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">Preguntas frecuentes</h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer(0.08)}
          className="max-w-3xl space-y-4"
        >
          {faqs.map((faq) => (
            <motion.div key={faq.question} variants={fadeInUp}>
              <GlassPanel padding="md" radius="md">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-white/50 leading-relaxed">{faq.answer}</p>
              </GlassPanel>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

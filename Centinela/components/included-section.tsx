"use client"

import { motion } from "motion/react"
import { Check } from "lucide-react"
import { fadeInUp, viewportOnce } from "@/lib/motion-variants"
import { GlassPanel } from "@/components/glass-panel"

const items = [
  "Protección: IP66 — agua y polvo",
  "Movimiento: pan -90°/+90° · tilt +45°/-45°",
  "Visión nocturna: LED IR",
  "Disuasión sonora: bocina de alta potencia, tonos de baja frecuencia",
  "Alimentación: 12V / 5V con protección",
  "Conectividad: WiFi 2.4GHz",
  "Temp. de operación: -10°C a 60°C",
  "Raspberry Pi 5 (8GB): visión por computadora, detección de aves y lógica de disuasión, en el propio dispositivo",
  "ESP32: transmisión de video, control de servomotores y comunicación WiFi",
]

export function IncludedSection() {
  return (
    <section id="especificaciones" className="py-24 md:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={fadeInUp}
          className="max-w-2xl mb-12 space-y-4"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-[-0.005em] text-balance text-white">
            Ficha técnica del prototipo
          </h2>
          <p className="text-lg text-white/60 text-balance">
            Hardware pensado para operar a la intemperie, con procesamiento de IA íntegramente local. Todo el
            análisis ocurre en el propio dispositivo: no depende de conexión a internet para detectar ni disuadir.
          </p>
        </motion.div>

        <motion.div initial="hidden" whileInView="visible" viewport={viewportOnce} variants={fadeInUp} className="max-w-3xl">
          <GlassPanel padding="lg" radius="lg">
            <ul className="grid sm:grid-cols-2 gap-4">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "var(--accent-foreground)" }} strokeWidth={1.5} />
                  <span className="text-white/70 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </GlassPanel>
        </motion.div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardList, X } from 'lucide-react'
import { GlassPanel } from '@/components/glass-panel'
import { AnimatePresence, motion } from 'motion/react'

interface Reporte {
  estado: string
  prioridad: string
  createdAt: string
}

interface Props {
  // Usuario.ultimoLogin capturado ANTES de esta sesión (Fase 46) — null si es la
  // primera vez que esta cuenta inicia sesión (nunca hubo un valor anterior).
  ultimoLoginAnterior: string | null
}

// Fase 45.6 (aviso al entrar) + Fase 46 (completa lo que había quedado pendiente):
// con ultimoLoginAnterior ya disponible, se avisa sobre lo NUEVO desde la sesión
// anterior. En la primera sesión de una cuenta (sin valor anterior) se mantiene el
// comportamiento original: avisar sobre todo lo pendiente ahora mismo.
export default function OperadorAlertaModal({ ultimoLoginAnterior }: Props) {
  const [visible, setVisible] = useState(false)
  const [nuevos, setNuevos] = useState(0)
  const [criticas, setCriticas] = useState(0)
  const esPrimeraSesion = ultimoLoginAnterior === null
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/reportes', { credentials: 'include' })
        if (!res.ok) return

        const data: Reporte[] = await res.json()

        const relevantes = esPrimeraSesion
          ? data.filter((r) => r.estado === 'pendiente')
          : data.filter((r) => new Date(r.createdAt) > new Date(ultimoLoginAnterior!))

        if (relevantes.length > 0) {
          setNuevos(relevantes.length)
          setCriticas(relevantes.filter((r) => r.prioridad === 'critica' && r.estado === 'pendiente').length)
          setVisible(true)
        }
      } catch (error) {
        console.error('Error verificando pendientes:', error)
      }
    }

    check()
  }, [esPrimeraSesion, ultimoLoginAnterior])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false)
    }
    window.addEventListener('keydown', onKey)
    closeButtonRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const esUrgente = criticas > 0

  const cerrarYVer = () => {
    setVisible(false)
    document.getElementById('cola-trabajo')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setVisible(false)}
          role="alertdialog"
          aria-modal="true"
          aria-label="Reportes pendientes"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm"
          >
            <GlassPanel
              padding="lg"
              radius="lg"
              className={`relative border ${esUrgente ? 'border-red-500/40' : 'border-signal/40'}`}
            >
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setVisible(false)}
                className="absolute top-3 right-3 text-foreground/40 hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>

              {esUrgente ? (
                <AlertTriangle className="h-10 w-10 text-red-400 mb-4" />
              ) : (
                <ClipboardList className="h-10 w-10 text-accent-foreground" />
              )}

              <h2 className="text-lg font-semibold text-foreground mb-1 mt-4">
                {esUrgente
                  ? 'Hay incidencias críticas pendientes'
                  : esPrimeraSesion
                    ? 'Tienes reportes pendientes'
                    : 'Hay novedades desde tu última sesión'}
              </h2>
              <p className="text-sm text-foreground/50">
                {esPrimeraSesion ? (
                  <>
                    {nuevos} reporte{nuevos === 1 ? '' : 's'} pendiente{nuevos === 1 ? '' : 's'}
                    {esUrgente ? `, ${criticas} de prioridad crítica` : ''}.
                  </>
                ) : (
                  <>
                    {nuevos} reporte{nuevos === 1 ? '' : 's'} nuevo{nuevos === 1 ? '' : 's'} desde tu última sesión
                    {esUrgente ? `, ${criticas} de prioridad crítica` : ''}.
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={cerrarYVer}
                className="mt-5 w-full rounded-md py-2 text-sm font-medium transition-shadow duration-300 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Ir a la cola de trabajo
              </button>
            </GlassPanel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

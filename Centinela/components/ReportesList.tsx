'use client'

import { useState, useEffect } from 'react'
import { PRIORIDAD_LABELS } from '@/lib/reportes-catalogos'
import { GlassPanel } from '@/components/glass-panel'
import { PrioridadCategoriaSelect } from '@/components/PrioridadCategoriaSelect'
import { ComentariosReporte } from '@/components/ComentariosReporte'
import { HistorialReporte } from '@/components/HistorialReporte'
import { AccionesRespuesta, EstadoRespuesta, LineaRespuesta, type ReporteConRespuesta } from '@/components/RespuestaReporte'
import { EvidenciaFoto } from '@/components/EvidenciaFoto'
import { useReclasificarReporte } from '@/hooks/use-reclasificar-reporte'
import { usePermisos } from '@/hooks/use-permisos'
import { AnimatePresence, motion } from 'motion/react'
import { staggerContainer, fadeInUp, alertBanner } from '@/lib/motion-variants'

// Borde izquierdo por prioridad: la lista se escanea por color antes de leer.
const BORDE_PRIORIDAD: Record<string, string> = {
  baja: 'border-l-foreground/20',
  media: 'border-l-amber-400/70',
  alta: 'border-l-orange-500/80',
  critica: 'border-l-red-500',
}

const PRIORIDAD_COLORS: Record<string, string> = {
  baja: 'text-foreground/50',
  media: 'text-amber-300',
  alta: 'text-orange-300',
  critica: 'text-red-300',
}

interface Reporte extends ReporteConRespuesta {
  id: string
  eventoId?: string | null
  evento?: { evidencia: string | null } | null
  titulo: string
  descripcion: string
  categoria: string | null
  usuario: {
    nombre: string
    email: string
  }
}

export default function ReportesList() {
  const { permisos } = usePermisos()
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loading, setLoading] = useState(true)
  const [resolviendoIds, setResolviendoIds] = useState<string[]>([])
  const { reclasificar: handleReclasificar, message, messageType, setMessage, setMessageType } =
    useReclasificarReporte(setReportes)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/reportes', {
          method: 'GET',
          credentials: 'include',
        })

        if (response.ok) {
          const data = await response.json()
          setReportes(data)
        } else {
          console.error('Error fetching reportes')
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Atender (acuse) o cerrar con motivo: el mismo PATCH, y la fila toma lo que devuelve el servidor.
  const responder = async (id: string, body: Record<string, unknown>, exito: string) => {
    setResolviendoIds((prev) => [...prev, id])
    setMessage('')
    setMessageType('')

    try {
      const response = await fetch(`/api/reportes/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const updatedReporte = await response.json()
        setReportes((prev) =>
          prev.map((reporte) =>
            reporte.id === id ? { ...reporte, ...updatedReporte, id: reporte.id } : reporte
          )
        )
        setMessage(exito)
        setMessageType('success')
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || 'Error al actualizar reporte'
        console.error('Error al actualizar reporte', response.status, errorData)
        setMessage(errorMessage)
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error de conexión')
      setMessageType('error')
    } finally {
      setResolviendoIds((prev) => prev.filter((resolviendoId) => resolviendoId !== id))
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <GlassPanel padding="md" radius="md">
          <h2 className="text-xl font-bold text-foreground mb-4">{permisos.includes('reportes.ver_todos') ? 'Todas las incidencias' : 'Mis Reportes'}</h2>
          <p className="text-foreground/50">Cargando reportes...</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <GlassPanel padding="md" radius="md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold text-foreground">{permisos.includes('reportes.ver_todos') ? 'Todas las incidencias' : 'Mis Reportes'}</h2>
          <a
            href="/api/reportes/export"
            className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
          >
            Exportar CSV
          </a>
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              role="alert"
              aria-live="polite"
              variants={alertBanner}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={`mb-4 text-sm ${messageType === 'success' ? 'text-green-400' : 'text-red-300'}`}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>

        {reportes.length === 0 ? (
          <p className="text-foreground/50">No tienes reportes aún</p>
        ) : (
          <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="space-y-4">
            {reportes.map((reporte) => {
              const isResolviendo = resolviendoIds.includes(reporte.id)
              const canResolve = reporte.estado === 'pendiente' && permisos.includes('reportes.resolver')
              const canReclasificar = permisos.includes('reportes.reclasificar')

              return (
                <motion.div
                  key={reporte.id}
                  variants={fadeInUp}
                  className={`rounded-lg border border-foreground/10 border-l-2 bg-foreground/[0.02] p-4 ${BORDE_PRIORIDAD[reporte.prioridad] ?? 'border-l-foreground/20'}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <EstadoRespuesta reporte={reporte} />
                    {canReclasificar ? (
                      <PrioridadCategoriaSelect
                        prioridad={reporte.prioridad}
                        categoria={reporte.categoria}
                        onChange={(campo, valor) => handleReclasificar(reporte.id, campo, valor)}
                        prioridadClassName={`rounded-md px-2 py-0.5 font-medium bg-foreground/[0.04] border border-foreground/10 ${PRIORIDAD_COLORS[reporte.prioridad] ?? 'text-foreground/50'}`}
                        categoriaClassName="rounded-md px-2 py-0.5 bg-foreground/[0.04] border border-foreground/10 text-foreground/60"
                      />
                    ) : (
                      <>
                        <span className={`font-medium ${PRIORIDAD_COLORS[reporte.prioridad] ?? 'text-foreground/50'}`}>
                          {PRIORIDAD_LABELS[reporte.prioridad] ?? reporte.prioridad}
                        </span>
                        {reporte.categoria && <span className="text-foreground/50">· {reporte.categoria}</span>}
                      </>
                    )}
                    <span className="ml-auto font-mono text-foreground/40">
                      {new Date(reporte.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })} · #{reporte.id}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{reporte.titulo}</h3>
                      <p className="mt-1 text-sm text-foreground/60 leading-relaxed">{reporte.descripcion}</p>
                      <LineaRespuesta reporte={reporte} />
{reporte.eventoId && reporte.evento?.evidencia && <EvidenciaFoto eventoId={reporte.eventoId} />}
                    </div>
                    {canResolve && (
                      <div className="shrink-0">
                        <AccionesRespuesta
                          reporte={reporte}
                          ocupado={isResolviendo}
                          onAtender={() => responder(reporte.id, { atender: true }, 'Reporte en atención')}
                          onCerrar={(motivoCierre) => responder(reporte.id, { resolver: true, motivoCierre }, 'Reporte cerrado')}
                        />
                      </div>
                    )}
                  </div>

                  <ComentariosReporte reporteId={reporte.id} />
                  <HistorialReporte reporteId={reporte.id} />
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </GlassPanel>
    </div>
  )
}
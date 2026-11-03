'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { GlassPanel } from '@/components/glass-panel'
import { PrioridadCategoriaSelect } from '@/components/PrioridadCategoriaSelect'
import { ComentariosReporte } from '@/components/ComentariosReporte'
import { HistorialReporte } from '@/components/HistorialReporte'
import { AccionesRespuesta, EstadoRespuesta, LineaRespuesta, type ReporteConRespuesta } from '@/components/RespuestaReporte'
import { EvidenciaFoto } from '@/components/EvidenciaFoto'
import type { MotivoCierre } from '@/lib/respuesta'
import { PRIORIDADES, CATEGORIAS, PRIORIDAD_LABELS, type Prioridad, type Categoria } from '@/lib/reportes-catalogos'
import { useReclasificarReporte } from '@/hooks/use-reclasificar-reporte'
import { usePermisos } from '@/hooks/use-permisos'
import { AnimatePresence, motion } from 'motion/react'
import { staggerContainer, fadeInUp, alertBanner } from '@/lib/motion-variants'

type EstadoFiltro = 'todos' | 'pendiente' | 'resuelto'
type PrioridadFiltro = 'todas' | Prioridad
type CategoriaFiltro = 'todas' | Categoria
type OrdenPor = 'recomendado' | 'recientes' | 'antiguos' | 'prioridad-desc' | 'prioridad-asc'
type AsignadoFiltro = 'todos' | 'mi' | 'sin-asignar'

const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-500/15 text-red-300 border-red-500/30',
  alta: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  media: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  baja: 'bg-foreground/10 text-foreground/50 border-foreground/10',
}

const PRIORIDAD_RANK: Record<string, number> = {
  critica: 3,
  alta: 2,
  media: 1,
  baja: 0,
}

const selectClass =
  'h-9 rounded-md border border-foreground/10 bg-foreground/[0.04] px-3 text-sm text-foreground outline-none focus-visible:border-foreground/30 focus-visible:ring-foreground/10 focus-visible:ring-[3px] transition-colors'

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
  operadorAsignado: {
    id: number
    nombre: string
    email: string
  } | null
}

// Cola de trabajo del Operador (Fase 45): a diferencia de ReportesList.tsx (usado en
// /dashboard por los 3 roles), esta vista prioriza pendientes por Prioridad y resuelve
// combinando resolución + reclasificación en una sola llamada (endpoint de Fase 39,
// `resolver: true`), en vez de dos acciones separadas.
export default function OperadorReportesQueue() {
  const { permisos } = usePermisos()
  const puedeReclasificar = permisos.includes('reportes.reclasificar')
  const puedeResolver = permisos.includes('reportes.resolver')
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loading, setLoading] = useState(true)
  const [huboCargaInicial, setHuboCargaInicial] = useState(false)
  const [resolviendoIds, setResolviendoIds] = useState<string[]>([])
  const { reclasificar: handleReclasificar, message, messageType, setMessage, setMessageType } =
    useReclasificarReporte(setReportes)

  // 06_UI_UX.md §D: filtrar/buscar/ordenar la cola. Los 3 primeros van al
  // servidor (app/api/reportes/route.ts ya acepta estado/prioridad/categoria/q);
  // "ordenar" se queda en cliente porque el rango de Prioridad (baja<media<alta
  // <critica) no es alfabético — Prisma/SQLite no puede expresar ese orden sin
  // SQL crudo, y ya existía un mapa de rango en JS para esto.
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [prioridadFiltro, setPrioridadFiltro] = useState<PrioridadFiltro>('todas')
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaFiltro>('todas')
  const [asignadoFiltro, setAsignadoFiltro] = useState<AsignadoFiltro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [ordenPor, setOrdenPor] = useState<OrdenPor>('recomendado')

  // Compartido por el fetch y el link de exportar CSV — así el CSV siempre
  // coincide exactamente con lo que la cola está mostrando en ese momento.
  const construirParams = () => {
    const params = new URLSearchParams()
    if (estadoFiltro !== 'todos') params.set('estado', estadoFiltro)
    if (prioridadFiltro !== 'todas') params.set('prioridad', prioridadFiltro)
    if (categoriaFiltro !== 'todas') params.set('categoria', categoriaFiltro)
    if (asignadoFiltro !== 'todos') params.set('asignado', asignadoFiltro)
    if (busqueda.trim()) params.set('q', busqueda.trim())
    return params
  }

  useEffect(() => {
    const controller = new AbortController()

    // Debounce solo para la búsqueda de texto — los selects disparan de inmediato.
    const delay = busqueda ? 300 : 0
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const params = construirParams()

        const response = await fetch(`/api/reportes?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        })

        if (response.ok) {
          const data = await response.json()
          setReportes(data)
        } else {
          console.error('Error fetching reportes')
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error:', error)
        }
      } finally {
        setLoading(false)
        setHuboCargaInicial(true)
      }
    }, delay)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [estadoFiltro, prioridadFiltro, categoriaFiltro, asignadoFiltro, busqueda])

  // Sin motivo: acuse de recibo. Con motivo: resuelve y reclasifica en la misma llamada.
  const handleResponder = async (reporte: Reporte, motivoCierre?: MotivoCierre) => {
    setResolviendoIds((prev) => [...prev, reporte.id])
    setMessage('')
    setMessageType('')

    try {
      const response = await fetch(`/api/reportes/${reporte.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          motivoCierre
            ? {
                ...(puedeReclasificar ? { prioridad: reporte.prioridad, categoria: reporte.categoria } : {}),
                resolver: true,
                motivoCierre,
              }
            : { atender: true }
        ),
      })

      if (response.ok) {
        const updatedReporte = await response.json()
        setReportes((prev) =>
          prev.map((r) => (r.id === reporte.id ? { ...r, ...updatedReporte, id: r.id } : r))
        )
        setMessage(motivoCierre ? 'Reporte cerrado' : 'Reporte en atención')
        setMessageType('success')
      } else {
        const errorData = await response.json().catch(() => null)
        setMessage(errorData?.error || 'Error al resolver el reporte')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('Error de conexión')
      setMessageType('error')
    } finally {
      setResolviendoIds((prev) => prev.filter((id) => id !== reporte.id))
    }
  }

  const hayFiltrosActivos =
    estadoFiltro !== 'todos' ||
    prioridadFiltro !== 'todas' ||
    categoriaFiltro !== 'todas' ||
    asignadoFiltro !== 'todos' ||
    busqueda.trim() !== ''

  const ordenados = [...reportes].sort((a, b) => {
    switch (ordenPor) {
      case 'recientes':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'antiguos':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      case 'prioridad-desc': {
        const diff = (PRIORIDAD_RANK[b.prioridad] ?? 0) - (PRIORIDAD_RANK[a.prioridad] ?? 0)
        return diff !== 0 ? diff : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      case 'prioridad-asc': {
        const diff = (PRIORIDAD_RANK[a.prioridad] ?? 0) - (PRIORIDAD_RANK[b.prioridad] ?? 0)
        return diff !== 0 ? diff : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      case 'recomendado':
      default: {
        // Comportamiento original: pendientes primero, por prioridad, luego fecha.
        if (a.estado !== b.estado) {
          return a.estado === 'pendiente' ? -1 : 1
        }
        if (a.estado === 'pendiente') {
          const diff = (PRIORIDAD_RANK[b.prioridad] ?? 0) - (PRIORIDAD_RANK[a.prioridad] ?? 0)
          if (diff !== 0) return diff
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    }
  })

  if (loading && !huboCargaInicial) {
    return (
      <GlassPanel padding="lg" radius="lg">
        <h2 className="text-lg font-semibold text-foreground mb-2">Cola de Trabajo</h2>
        <p className="text-foreground/50 text-sm">Cargando reportes...</p>
      </GlassPanel>
    )
  }

  return (
    <GlassPanel padding="lg" radius="lg">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-foreground">Cola de Trabajo</h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-foreground/40" />}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <Input
            type="search"
            placeholder="Buscar por título o descripción"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-9 bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40"
          />
        </div>

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          className={selectClass}
          aria-label="Filtrar por estado"
        >
          <option value="todos" className="bg-popover text-popover-foreground">Todos los estados</option>
          <option value="pendiente" className="bg-popover text-popover-foreground">Pendientes</option>
          <option value="resuelto" className="bg-popover text-popover-foreground">Resueltos</option>
        </select>

        <select
          value={prioridadFiltro}
          onChange={(e) => setPrioridadFiltro(e.target.value as PrioridadFiltro)}
          className={selectClass}
          aria-label="Filtrar por prioridad"
        >
          <option value="todas" className="bg-popover text-popover-foreground">Toda prioridad</option>
          {PRIORIDADES.map((valor) => (
            <option key={valor} value={valor} className="bg-popover text-popover-foreground">
              {PRIORIDAD_LABELS[valor]}
            </option>
          ))}
        </select>

        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value as CategoriaFiltro)}
          className={selectClass}
          aria-label="Filtrar por categoría"
        >
          <option value="todas" className="bg-popover text-popover-foreground">Toda categoría</option>
          {CATEGORIAS.map((valor) => (
            <option key={valor} value={valor} className="bg-popover text-popover-foreground">
              {valor}
            </option>
          ))}
        </select>

        <select
          value={asignadoFiltro}
          onChange={(e) => setAsignadoFiltro(e.target.value as AsignadoFiltro)}
          className={selectClass}
          aria-label="Filtrar por asignación"
        >
          <option value="todos" className="bg-popover text-popover-foreground">Toda asignación</option>
          <option value="mi" className="bg-popover text-popover-foreground">Asignados a mí</option>
          <option value="sin-asignar" className="bg-popover text-popover-foreground">Sin asignar</option>
        </select>

        <select
          value={ordenPor}
          onChange={(e) => setOrdenPor(e.target.value as OrdenPor)}
          className={selectClass}
          aria-label="Ordenar por"
        >
          <option value="recomendado" className="bg-popover text-popover-foreground">Recomendado</option>
          <option value="recientes" className="bg-popover text-popover-foreground">Más recientes</option>
          <option value="antiguos" className="bg-popover text-popover-foreground">Más antiguos</option>
          <option value="prioridad-desc" className="bg-popover text-popover-foreground">Prioridad: alta a baja</option>
          <option value="prioridad-asc" className="bg-popover text-popover-foreground">Prioridad: baja a alta</option>
        </select>

        <a
          href={`/api/reportes/export?${construirParams().toString()}`}
          className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
        >
          Exportar CSV
        </a>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              setEstadoFiltro('todos')
              setPrioridadFiltro('todas')
              setCategoriaFiltro('todas')
              setAsignadoFiltro('todos')
              setBusqueda('')
            }}
            className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
          >
            Limpiar filtros
          </button>
        )}
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

      {ordenados.length === 0 ? (
        <p className="text-foreground/50 text-sm">
          {hayFiltrosActivos ? 'Ningún reporte coincide con esos filtros' : 'No hay reportes registrados'}
        </p>
      ) : (
        <motion.div variants={staggerContainer(0.08)} initial="hidden" animate="visible" className="space-y-4">
          {ordenados.map((reporte) => {
            const isResolviendo = resolviendoIds.includes(reporte.id)
            const isPendiente = reporte.estado === 'pendiente'

            return (
              <motion.div
                key={reporte.id}
                layout
                variants={fadeInUp}
                className={`rounded-xl border p-5 transition-opacity ${
                  isPendiente ? 'border-foreground/15 bg-foreground/[0.03]' : 'border-foreground/5 bg-foreground/[0.01] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {isPendiente && reporte.prioridad === 'critica' && (
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    {reporte.titulo}
                  </h3>
                  <span className="shrink-0">
                    <EstadoRespuesta reporte={reporte} />
                  </span>
                </div>
                <p className="text-foreground/60 text-sm mt-2">{reporte.descripcion}</p>
                <LineaRespuesta reporte={reporte} />
{reporte.eventoId && reporte.evento?.evidencia && <EvidenciaFoto eventoId={reporte.eventoId} />}

                <div className="mt-3 text-xs text-foreground/50 space-y-0.5">
                  <p>Reportado por: {reporte.usuario.nombre} ({reporte.usuario.email})</p>
                  <p>Fecha: {new Date(reporte.createdAt).toLocaleDateString()}</p>
                  <p>
                    {reporte.operadorAsignado
                      ? `Asignado a: ${reporte.operadorAsignado.nombre}`
                      : 'Sin asignar'}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {isPendiente && puedeReclasificar ? (
                    <PrioridadCategoriaSelect
                      prioridad={reporte.prioridad}
                      categoria={reporte.categoria}
                      onChange={(campo, valor) => handleReclasificar(reporte.id, campo, valor)}
                      prioridadClassName={selectClass}
                      categoriaClassName={selectClass}
                    />
                  ) : (
                    <>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORIDAD_BADGE[reporte.prioridad] ?? PRIORIDAD_BADGE.baja}`}>
                        {PRIORIDAD_LABELS[reporte.prioridad] ?? reporte.prioridad}
                      </span>
                      {reporte.categoria && (
                        <span className="text-xs text-foreground/50">Categoría: {reporte.categoria}</span>
                      )}
                    </>
                  )}
                </div>

                {isPendiente && puedeResolver && (
                  <div className="mt-4 flex justify-end">
                    <AccionesRespuesta
                      reporte={reporte}
                      ocupado={isResolviendo}
                      onAtender={() => handleResponder(reporte)}
                      onCerrar={(motivo) => handleResponder(reporte, motivo)}
                      textoCerrar={puedeReclasificar ? 'Cerrar y reclasificar' : 'Cerrar'}
                    />
                  </div>
                )}

                <ComentariosReporte reporteId={reporte.id} />
                <HistorialReporte reporteId={reporte.id} />
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </GlassPanel>
  )
}

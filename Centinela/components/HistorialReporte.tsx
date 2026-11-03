'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import { PRIORIDAD_LABELS } from '@/lib/reportes-catalogos'
import { MOTIVO_LABELS } from '@/lib/respuesta'

interface EntradaHistorial {
  id: number
  campo: string
  valorAnterior: string | null
  valorNuevo: string | null
  createdAt: string
  autor: {
    id: number
    nombre: string
    email: string
  }
}

const CAMPO_LABELS: Record<string, string> = {
  estado: 'Estado',
  prioridad: 'Prioridad',
  categoria: 'Categoría',
  operadorAsignado: 'Asignación',
}

function formatearValor(campo: string, valor: string | null): string {
  if (campo === 'operadorAsignado') return valor ?? 'Sin asignar'
  if (campo === 'motivoCierre') return valor ? (MOTIVO_LABELS[valor] ?? valor) : '—'
  if (campo === 'atencion') return valor ?? '—'
  if (campo === 'categoria') return valor ?? 'Sin categoría'
  if (campo === 'prioridad') return valor ? (PRIORIDAD_LABELS[valor] ?? valor) : '—'
  return valor ?? '—'
}

// Compartido por ReportesList.tsx y OperadorReportesQueue.tsx (06_UI_UX.md §B),
// mismo patrón de carga bajo demanda que ComentariosReporte.tsx.
export function HistorialReporte({ reporteId }: { reporteId: string | number }) {
  const [abierto, setAbierto] = useState(false)
  const [entradas, setEntradas] = useState<EntradaHistorial[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState('')

  const alternarAbierto = async () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (!siguiente || cargado) return

    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/reportes/${reporteId}/historial`, { credentials: 'include' })
      if (res.ok) {
        setEntradas(await res.json())
        setCargado(true)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Error al cargar el historial')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mt-3 border-t border-foreground/5 pt-3">
      <button
        type="button"
        onClick={alternarAbierto}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        {abierto ? 'Ocultar historial' : cargado ? `Historial (${entradas.length})` : 'Historial'}
      </button>

      {abierto && (
        <div className="mt-3">
          {cargando ? (
            <p className="text-xs text-foreground/40">Cargando historial...</p>
          ) : error ? (
            <p className="text-xs text-red-300">{error}</p>
          ) : entradas.length === 0 ? (
            <p className="text-xs text-foreground/40">Sin cambios registrados todavía</p>
          ) : (
            <ul className="space-y-2">
              {entradas.map((e) => (
                <li key={e.id} className="text-xs text-foreground/60">
                  <span className="font-medium text-foreground/80">{e.autor.nombre}</span>{' '}
                  {e.campo === 'atencion' ? (
                    'acusó recibo'
                  ) : e.campo === 'motivoCierre' ? (
                    <>cerró como <span className="text-foreground/80">{formatearValor(e.campo, e.valorNuevo)}</span></>
                  ) : (
                    <>
                      cambió <span className="text-foreground/80">{CAMPO_LABELS[e.campo] ?? e.campo}</span>{' '}
                      de <span className="text-foreground/50">&ldquo;{formatearValor(e.campo, e.valorAnterior)}&rdquo;</span>{' '}
                      a <span className="text-foreground/80">&ldquo;{formatearValor(e.campo, e.valorNuevo)}&rdquo;</span>
                    </>
                  )}
                  <span className="text-foreground/30"> · {new Date(e.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

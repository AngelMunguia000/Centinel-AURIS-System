'use client'

import { useState } from 'react'
import { PRIORIDADES, CATEGORIAS, DEFAULT_PRIORIDAD } from '@/lib/reportes-catalogos'
import { GlassPanel } from '@/components/glass-panel'

const PRIORIDAD_LABELS: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

export default function ReporteForm() {
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState<string>(DEFAULT_PRIORIDAD)
  const [categoria, setCategoria] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageType('')

    try {
      const response = await fetch('/api/reportes', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo,
          descripcion,
          prioridad,
          categoria: categoria || null,
        }),
      })

      if (response.ok) {
        setMessage('Reporte creado correctamente')
        setMessageType('success')
        setTitulo('')
        setDescripcion('')
        setPrioridad(DEFAULT_PRIORIDAD)
        setCategoria('')
      } else {
        const errorData = await response.json()
        setMessage(errorData.error || 'Error al crear el reporte')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('Error de conexión')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8">
      <GlassPanel padding="md" radius="md">
        <h2 className="text-xl font-bold text-foreground mb-4">Crear Reporte</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="titulo" className="block text-sm font-medium text-foreground/70">
              Título
            </label>
            <input
              type="text"
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 rounded-md bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
            />
          </div>

          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-foreground/70">
              Descripción
            </label>
            <textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              required
              rows={4}
              className="mt-1 block w-full px-3 py-2 rounded-md bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prioridad" className="block text-sm font-medium text-foreground/70">
                Prioridad
              </label>
              <select
                id="prioridad"
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 rounded-md bg-foreground/[0.04] border border-foreground/10 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
              >
                {PRIORIDADES.map((valor) => (
                  <option key={valor} value={valor} className="bg-popover text-popover-foreground">
                    {PRIORIDAD_LABELS[valor]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="categoria" className="block text-sm font-medium text-foreground/70">
                Categoría (opcional)
              </label>
              <select
                id="categoria"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="mt-1 block w-full px-3 py-2 rounded-md bg-foreground/[0.04] border border-foreground/10 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:border-foreground/30"
              >
                <option value="" className="bg-popover text-popover-foreground">Sin categoría</option>
                {CATEGORIAS.map((valor) => (
                  <option key={valor} value={valor} className="bg-popover text-popover-foreground">
                    {valor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-md font-medium transition-shadow duration-300 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando...' : 'Crear Reporte'}
          </button>

          {message && (
            <p role="alert" aria-live="polite" className={`text-sm ${messageType === 'success' ? 'text-green-400' : 'text-red-300'}`}>
              {message}
            </p>
          )}
        </form>
      </GlassPanel>
    </div>
  )
}
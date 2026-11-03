'use client'

import { useState } from 'react'
import { Loader2, MessageSquare, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Comentario {
  id: number
  contenido: string
  createdAt: string
  autor: {
    id: number
    nombre: string
    email: string
  }
}

// Compartido por ReportesList.tsx y OperadorReportesQueue.tsx (06_UI_UX.md §C):
// intercambio de información entre quien reporta y quien atiende. Colapsado por
// defecto y carga bajo demanda — no dispara un fetch por reporte con solo
// renderizar la lista.
export function ComentariosReporte({ reporteId }: { reporteId: string | number }) {
  const [abierto, setAbierto] = useState(false)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargados, setCargados] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const cargarComentarios = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/reportes/${reporteId}/comentarios`, { credentials: 'include' })
      if (res.ok) {
        setComentarios(await res.json())
        setCargados(true)
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Error al cargar comentarios')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  const alternarAbierto = () => {
    const siguiente = !abierto
    setAbierto(siguiente)
    if (siguiente && !cargados) {
      cargarComentarios()
    }
  }

  const enviarComentario = async (e: React.FormEvent) => {
    e.preventDefault()
    const contenido = nuevo.trim()
    if (!contenido) return

    setEnviando(true)
    setError('')
    try {
      const res = await fetch(`/api/reportes/${reporteId}/comentarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contenido }),
      })

      if (res.ok) {
        const comentario = await res.json()
        setComentarios((prev) => [...prev, comentario])
        setNuevo('')
      } else {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Error al enviar el comentario')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-3 border-t border-foreground/5 pt-3">
      <button
        type="button"
        onClick={alternarAbierto}
        className="flex items-center gap-1.5 text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {abierto ? 'Ocultar comentarios' : cargados ? `Comentarios (${comentarios.length})` : 'Comentarios'}
      </button>

      {abierto && (
        <div className="mt-3 space-y-3">
          {cargando ? (
            <p className="text-xs text-foreground/40">Cargando comentarios...</p>
          ) : (
            <>
              {comentarios.length === 0 ? (
                <p className="text-xs text-foreground/40">Sin comentarios todavía</p>
              ) : (
                <div className="space-y-2">
                  {comentarios.map((c) => (
                    <div key={c.id} className="rounded-lg bg-foreground/[0.03] border border-foreground/5 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-foreground/80">{c.autor.nombre}</span>
                        <span className="text-[10px] text-foreground/30">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-foreground/70 mt-1 whitespace-pre-wrap">{c.contenido}</p>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-300">{error}</p>}

              <form onSubmit={enviarComentario} className="flex gap-2">
                <Input
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="h-9 bg-foreground/[0.04] border-foreground/10 text-foreground placeholder:text-foreground/40 text-sm"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={enviando || !nuevo.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  aria-label="Enviar comentario"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}

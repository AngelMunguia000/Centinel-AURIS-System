'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'motion/react'

interface Notificacion {
  id: number
  mensaje: string
  reporteId: number | null
  leida: boolean
  createdAt: string
}

// 06_UI_UX.md §G: alcance decidido por el PO (2026-09-18) — solo in-app, sin
// WebSockets. Se consulta al montar, al recuperar el foco y cada 15 s con la
// pestaña visible (esa consulta también dispara el aviso de Pi caída, lib/edge/vigilancia.ts).
const CONSULTA_MS = 15_000
// Universal en AppHeader: hoy solo el Operador recibe notificaciones reales,
// pero cualquier cuenta puede abrir la campanita — simplemente estará vacía.
export function NotificacionesBell() {
  const [abierto, setAbierto] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  // Solo la primera carga muestra "cargando"; al recuperar el foco se refresca sin vaciar la lista.
  const [cargando, setCargando] = useState(true)
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cargar = () =>
      fetch('/api/notificaciones', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return
          setNotificaciones(data.notificaciones)
          setNoLeidas(data.noLeidas)
        })
        .catch((error) => console.error('Error cargando notificaciones:', error))
        .finally(() => setCargando(false))

    cargar()
    const alEnfocar = () => cargar()
    window.addEventListener('focus', alEnfocar)
    // Una alerta de intrusión o de Pi caída no puede esperar a que alguien recargue.
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar()
    }, CONSULTA_MS)
    return () => {
      window.removeEventListener('focus', alEnfocar)
      clearInterval(intervalo)
    }
  }, [])

  useEffect(() => {
    if (!abierto) return
    const alClicFuera = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alClicFuera)
    return () => document.removeEventListener('mousedown', alClicFuera)
  }, [abierto])

  const marcarLeida = async (id: number) => {
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    setNoLeidas((prev) => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notificaciones/${id}`, { method: 'PATCH', credentials: 'include' })
    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }

  const marcarTodasLeidas = async () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
    setNoLeidas(0)
    try {
      await fetch('/api/notificaciones/leer-todas', { method: 'POST', credentials: 'include' })
    } catch (error) {
      console.error('Error marcando notificaciones como leídas:', error)
    }
  }

  return (
    <div className="relative" ref={contenedorRef}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => setAbierto((v) => !v)}
        aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'}
        className="relative rounded-full border-foreground/20 text-foreground hover:bg-foreground/10 bg-transparent"
      >
        <Bell className="h-4 w-4" />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-[16px] z-50 bg-popover/95 backdrop-blur-[20px] border border-foreground/10 shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10">
              <span className="text-sm font-semibold text-foreground">Notificaciones</span>
              {noLeidas > 0 && (
                <button
                  type="button"
                  onClick={marcarTodasLeidas}
                  className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            {cargando ? (
              <p className="px-4 py-6 text-sm text-foreground/40 text-center">Cargando...</p>
            ) : notificaciones.length === 0 ? (
              <p className="px-4 py-6 text-sm text-foreground/40 text-center">Sin notificaciones</p>
            ) : (
              <ul className="py-1">
                {notificaciones.map((n) => {
                  // Un pánico se distingue del resto de los avisos de un vistazo.
                  const panico = n.mensaje.startsWith('PÁNICO')
                  return (
                  <li key={n.id}>
                    <Link
                      // /reportes existe para los 3 roles; /operador solo para Operador (a un Admin lo mandaba al Inicio).
                      href={n.reporteId ? '/reportes' : '#'}
                      onClick={() => {
                        if (!n.leida) marcarLeida(n.id)
                        setAbierto(false)
                      }}
                      className={`block px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.06] ${
                        panico && !n.leida ? 'bg-red-500/10 text-red-200 font-medium' : n.leida ? 'text-foreground/50' : 'text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.leida && <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${panico ? 'bg-red-500' : 'bg-signal'}`} />}
                        <div className={n.leida ? '' : 'flex-1'}>
                          <p>{n.mensaje}</p>
                          <p className="text-[10px] text-foreground/30 mt-1">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                  )
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

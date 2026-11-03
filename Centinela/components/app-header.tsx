"use client"

import { useState } from "react"
import Link from "next/link"
import { LogOut, Menu, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatePresence, motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { NotificacionesBell } from "@/components/NotificacionesBell"
import Logo from "./Logo"

interface AppHeaderProps {
  links?: { label: string; href: string }[]
}

export function AppHeader({ links }: AppHeaderProps) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion()
  const hasLinks = !!links && links.length > 0

  return (
    <header className="relative z-10 p-3 sm:p-4">
      {/* Píldora flotante, igual que la navegación de la landing (Brain/21 §64) */}
      <div className="mx-auto max-w-7xl rounded-full border border-foreground/10 bg-foreground/[0.04] backdrop-blur-md px-4 sm:px-5">
        <div className="flex h-14 items-center justify-between">
          <Link href="/dashboard" aria-label="Ir al Inicio" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo size={28} isAnimated={true} />
            <span className="whitespace-nowrap text-lg font-semibold text-foreground">
              Centinela <span className="hidden sm:inline text-brand">AURIS</span>
            </span>
          </Link>

          {hasLinks && (
            <nav className="hidden sm:flex items-center gap-6 text-sm">
              {links!.map((link) => (
                <a key={link.href} href={link.href} className="text-foreground/55 hover:text-foreground transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2">
            <NotificacionesBell />

            <Button asChild variant="outline" size="icon-sm" className="rounded-full border-foreground/20 text-foreground hover:bg-foreground/10 bg-transparent">
              <Link href="/ajustes" aria-label="Ajustes">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>

            <form action="/api/logout" method="POST">
              <Button type="submit" variant="outline" size="sm" aria-label="Cerrar sesión" className="rounded-full border-foreground/20 text-foreground hover:bg-foreground/10 bg-transparent">
                <LogOut className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </form>

            {hasLinks && (
              <button
                type="button"
                aria-label={open ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="sm:hidden flex items-center justify-center w-10 h-10 rounded-[10px] text-foreground/70 hover:text-foreground hover:bg-foreground/10 transition-colors"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {open ? (
                    <motion.span
                      key="x"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="block"
                    >
                      <X className="h-5 w-5" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="menu"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="block"
                    >
                      <Menu className="h-5 w-5" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
          </div>
        </div>
      </div>

      {hasLinks && (
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 top-16 sm:hidden"
                style={{ background: "rgba(0, 0, 0, 0.4)" }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full right-4 mt-2 w-56 rounded-[16px] overflow-hidden sm:hidden bg-popover/95 backdrop-blur-[20px] border border-foreground/10 shadow-[0_30px_70px_rgba(0,0,0,0.5)]"
              >
                <div className="py-2">
                  {links!.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block px-5 py-3 text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </header>
  )
}

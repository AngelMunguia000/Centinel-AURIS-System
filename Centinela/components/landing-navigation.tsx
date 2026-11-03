"use client"

import { useState, useEffect, useSyncExternalStore } from "react"
import { Download, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import Logo from "./Logo"
import { esClienteDeApp } from "@/lib/cliente-app"

const sinSuscripcion = () => () => {}

// Las secciones de la landing (problema, especificaciones…) siguen accesibles desde ella; el menú
// apunta a las landings complementarias (lib/landings.ts).
const links = [
  { label: "Cómo funciona", href: "/#como-funciona" },
  { label: "Soluciones", href: "/soluciones" },
  { label: "Plataforma", href: "/plataforma" },
  { label: "Tecnología", href: "/tecnologia" },
  { label: "Seguridad", href: "/seguridad" },
]

export function LandingNavigation() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const reduced = useReducedMotion()
  // El User-Agent solo existe en el navegador: en SSR se asume PC (sin enlace de login).
  const esApp = useSyncExternalStore(sinSuscripcion, () => esClienteDeApp(navigator.userAgent), () => false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const close = () => setOpen(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center p-3 sm:p-4 transition-all duration-300">
      <motion.nav
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`flex items-center justify-between rounded-full border transition-all duration-300 backdrop-blur-md ${
          scrolled
            ? "bg-[#0a0a0c]/85 border-white/15 px-4 py-2 shadow-2xl shadow-black/60"
            : "w-full container mx-auto px-6 py-3 bg-white/[0.04] border-white/10"
        }`}
      >
        {/* Logo & Marca */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
          <Logo size={28} isAnimated={true} />
          <span className="text-base font-semibold text-white tracking-wide">
            Centinela
          </span>
        </Link>

        {/* Enlaces de Navegación (Se ocultan al hacer scroll) */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="hidden md:flex items-center gap-8 text-sm font-medium"
            >
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-white/70 hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botones de Acción Uniformes (Se ocultan al hacer scroll en escritorio) */}
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="hidden md:flex items-center gap-3 shrink-0"
            >
              <Button asChild size="sm" className="h-9 px-4 text-sm font-medium rounded-full">
                <Link href="/descargar">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Descargar
                </Link>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menú Toggle (Móvil o cuando la barra se contrae) */}
        <div className={`flex items-center gap-2 ${scrolled ? "" : "md:hidden"}`}>
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
                  <X className="h-4 w-4" />
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
                  <Menu className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.nav>

      {/* Menú Desplegable Desplegado */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm z-40"
              onClick={close}
            />
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-20 left-4 right-4 max-w-sm mx-auto rounded-2xl p-4 bg-[#0a0a0c]/95 border border-white/10 backdrop-blur-xl shadow-2xl z-50"
            >
              <div className="flex flex-col gap-1">
                {links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
                <Link
                  href="/descargar"
                  onClick={close}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Descargar para Windows
                </Link>
                {/* En el teléfono la consola sí se abre en el navegador (lib/cliente-app.ts). */}
                {esApp && (
                  <Link
                    href="/iniciar-sesion"
                    onClick={close}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    Iniciar sesión
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}

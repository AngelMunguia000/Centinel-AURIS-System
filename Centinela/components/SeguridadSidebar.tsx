"use client"

import Link from "next/link"
import { Cpu, Eye, FileText, HelpCircle, LayoutDashboard, Router, ScanEye, Settings, Terminal } from "lucide-react"
import type { Permiso } from "@/lib/permisos"
import { BotonPanico } from "@/components/BotonPanico"

const NAV_ITEMS = [
  { key: "inicio", label: "Inicio", icon: LayoutDashboard, href: "/dashboard", grupo: "Operación" },
  { key: "monitor", label: "Monitor", icon: Eye, href: "/monitor", grupo: "Operación" },
  { key: "bitacora", label: "Bitácora", icon: Terminal, href: "/bitacora", grupo: "Operación" },
  { key: "reportes", label: "Reportes", icon: FileText, href: "/reportes", grupo: "Gestión" },
  { key: "dispositivos", label: "Dispositivos", icon: Router, href: "/dispositivos", grupo: "Gestión" },
  { key: "prototipo", label: "Prototipo", icon: Cpu, href: "/prototipo", grupo: "Laboratorio" },
  { key: "vision", label: "Visión", icon: ScanEye, href: "/vision", grupo: "Laboratorio" },
] as const

const GRUPOS = ["Operación", "Gestión", "Laboratorio"] as const

interface SeguridadSidebarProps {
  active: (typeof NAV_ITEMS)[number]["key"]
  permisos?: Permiso[]
}

// 06_UI_UX.md §F: Monitor, Bitácora y Dispositivos dependen de
// dispositivos.propios o dispositivos.otros (antes: se ocultaban al Operador).
const ITEMS_DE_DISPOSITIVOS = new Set<string>(["monitor", "bitacora", "dispositivos"])

// Sidebar compartida entre las páginas del "modo operaciones" de seguridad
// (Resumen, Reportes, Monitor en Vivo, Bitácora de Incidentes, Centro de
// Dispositivos) — ver docs/diseno/2026-09-02-bitacora-incidentes-design.md.
// En pantallas chicas se convierte en una barra inferior (antes no había navegación en móvil).
export function SeguridadSidebar({ active, permisos }: SeguridadSidebarProps) {
  const veDispositivos =
    !permisos || permisos.includes("dispositivos.propios") || permisos.includes("dispositivos.otros")
  const navItems = NAV_ITEMS.filter(
    (item) =>
      (veDispositivos || !ITEMS_DE_DISPOSITIVOS.has(item.key)) &&
      // Visión solo con el permiso explícito: sin la lista de permisos no se muestra.
      (item.key !== "vision" || !!permisos?.includes("vision.revisar")),
  )

  const enlace = (item: (typeof NAV_ITEMS)[number]) => (
    <Link
      key={item.key}
      href={item.href}
      aria-current={item.key === active ? "page" : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        item.key === active
          ? "text-foreground bg-foreground/10 shadow-[inset_2px_0_0_0_var(--signal)]"
          : "text-foreground/55 hover:text-foreground hover:bg-foreground/[0.04]"
      }`}
    >
      <item.icon className={`h-[18px] w-[18px] ${item.key === active ? "text-signal" : ""}`} />
      {item.label}
    </Link>
  )

  return (
    <>
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 self-start h-screen overflow-y-auto pt-8 pb-6 px-4">
        <nav aria-label="Secciones" className="flex-1 flex flex-col gap-6">
          {GRUPOS.map((grupo) => {
            const items = navItems.filter((i) => i.grupo === grupo)
            if (items.length === 0) return null
            return (
              <div key={grupo}>
                <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/35">{grupo}</p>
                <div className="flex flex-col gap-0.5">{items.map(enlace)}</div>
              </div>
            )
          })}
        </nav>

        <div className="mt-4">
          <BotonPanico />
        </div>

        <div className="mt-6 flex flex-col gap-0.5 border-t border-foreground/5 pt-4">
          <Link
            href="/ajustes"
            className="flex items-center gap-3 px-3 py-2 text-sm text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] rounded-lg transition-colors"
          >
            <Settings className="h-4 w-4" />
            Ajustes
          </Link>
          <Link
            href="/ayuda"
            className="flex items-center gap-3 px-3 py-2 text-sm text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] rounded-lg transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            Soporte
          </Link>
        </div>
      </aside>

      <nav
        aria-label="Secciones"
        className="nav-movil lg:hidden fixed bottom-0 inset-x-0 z-40 flex justify-around border-t border-foreground/10 bg-background/90 backdrop-blur-xl px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      >
        {navItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === active ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-1 text-[10px] font-medium ${
              item.key === active ? "text-signal" : "text-foreground/55"
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
        <BotonPanico compacto />
      </nav>
    </>
  )
}

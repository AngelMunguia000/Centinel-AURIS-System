"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Fingerprint, Plus, Radio, Router as RouterIcon, Search, Shield, Video, X } from "lucide-react"
import { AppHeader } from "@/components/app-header"
import { GlassBackground, consolaBlobs } from "@/components/glass-background"
import { GlassPanel } from "@/components/glass-panel"
import { SeguridadSidebar } from "@/components/SeguridadSidebar"
import type { Permiso } from "@/lib/permisos"
import { GatewaysPanel } from "./GatewaysPanel"
import { EncabezadoVista } from "@/components/marca"
import {
  TIPO_LABEL,
  TIPOS_VALIDOS,
  VARIABLE_POR_TIPO,
  type ConexionDispositivo,
  type Dispositivo,
  type TipoDispositivo,
} from "@/lib/dispositivos-ejemplos"

const TIPO_ICON: Record<TipoDispositivo, typeof RouterIcon> = {
  gateway: RouterIcon,
  biometrico: Fingerprint,
  firewall: Shield,
  camara: Video,
  sensor: Radio,
}

const CONEXION_CLASS: Record<ConexionDispositivo, string> = {
  ESTABLE: "text-green-400",
  ACTIVA: "text-green-400",
  LATENCIA: "text-amber-400",
  DESCONECTADO: "text-red-300",
}

interface UsuarioAdmin {
  id: number
  nombre: string
  email: string
  rol: { nombre: string }
}

interface DispositivosClientProps {
  permisos: Permiso[]
  nombreUsuario: string
}

function EquipoGrid({ dispositivos, onAgregar }: { dispositivos: Dispositivo[]; onAgregar: () => void }) {
  const total = dispositivos.length
  const operativos = dispositivos.filter((d) => d.conexion !== "DESCONECTADO").length

  return (
    <>
      <div className="flex gap-3 mb-8">
        <GlassPanel padding="sm" radius="sm" className="p-4">
          <p className="text-xs text-foreground/50">Nodos totales</p>
          <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
        </GlassPanel>
        <GlassPanel padding="sm" radius="sm" className="p-4">
          <p className="text-xs text-foreground/50">Operativos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{operativos}</p>
        </GlassPanel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dispositivos.map((d) => {
          const Icon = TIPO_ICON[d.tipo]
          const critico = d.conexion === "DESCONECTADO"
          return (
            <GlassPanel
              key={d.id}
              padding="sm"
              radius="md"
              className={`p-5 ${critico ? "border border-red-500/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-md bg-foreground/[0.06] flex items-center justify-center">
                  <Icon className="h-4 w-4 text-foreground/60" />
                </div>
                <span className="text-[10px] font-mono text-foreground/40 uppercase tracking-wide">{d.uid}</span>
              </div>
              <h3 className="text-foreground font-semibold mb-3">{d.nombre}</h3>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground/40">Conexión</span>
                <span className={`font-medium ${CONEXION_CLASS[d.conexion]}`}>{d.conexion}</span>
              </div>
              {d.bateria !== null && (
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-foreground/40">Batería</span>
                  <span className="text-foreground font-medium">{d.bateria}%</span>
                </div>
              )}
              {d.variableLabel && d.variableValor && (
                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-foreground/40">{d.variableLabel}</span>
                  <span className="text-foreground font-medium">{d.variableValor}</span>
                </div>
              )}
            </GlassPanel>
          )
        })}

        <button
          type="button"
          onClick={onAgregar}
          className="rounded-[22px] border border-dashed border-foreground/15 flex flex-col items-center justify-center gap-2 py-8 text-foreground/40 hover:text-foreground/70 hover:border-foreground/30 transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs font-medium">Aprovisionar nuevo nodo</span>
        </button>
      </div>
    </>
  )
}

export function DispositivosClient({ permisos, nombreUsuario }: DispositivosClientProps) {
  const puedeVerOtros = permisos.includes("dispositivos.otros")
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true)
  const [errorUsuarios, setErrorUsuarios] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<UsuarioAdmin | null>(null)

  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([])
  const [cargandoDispositivos, setCargandoDispositivos] = useState(!puedeVerOtros)
  const [errorDispositivos, setErrorDispositivos] = useState(false)

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoTipo, setNuevoTipo] = useState<TipoDispositivo>("sensor")
  const [enviandoNuevo, setEnviandoNuevo] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState("")

  // Carga la lista real de usuarios (Admin) para el buscador.
  useEffect(() => {
    if (!puedeVerOtros) return
    fetch("/api/admin/usuarios", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar usuarios")
        return res.json()
      })
      .then((data) => setUsuarios(data.usuarios ?? []))
      .catch(() => setErrorUsuarios(true))
      .finally(() => setCargandoUsuarios(false))
  }, [puedeVerOtros])

  // Carga el equipo real: el propio (sin dispositivos.otros) o el del usuario seleccionado (con dispositivos.otros).
  useEffect(() => {
    if (puedeVerOtros && !seleccionado) return

    const url = puedeVerOtros ? `/api/dispositivos?usuarioId=${seleccionado!.id}` : "/api/dispositivos"

    fetch(url, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al cargar dispositivos")
        return res.json()
      })
      .then((data) => setDispositivos(data.dispositivos ?? []))
      .catch(() => setErrorDispositivos(true))
      .finally(() => setCargandoDispositivos(false))
  }, [puedeVerOtros, seleccionado])

  const usuariosFiltrados = useMemo(() => {
    if (busqueda.trim() === "") return usuarios
    const q = busqueda.trim().toLowerCase()
    return usuarios.filter((u) => u.nombre.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [usuarios, busqueda])

  const agregarDispositivo = async (e: FormEvent) => {
    e.preventDefault()
    if (nuevoNombre.trim() === "") return

    setEnviandoNuevo(true)
    setErrorNuevo("")

    try {
      const res = await fetch("/api/dispositivos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevoNombre.trim(),
          tipo: nuevoTipo,
          ...(puedeVerOtros ? { usuarioId: seleccionado!.id } : {}),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setErrorNuevo(data?.error || "No se pudo agregar el dispositivo")
        return
      }

      const nuevo: Dispositivo = await res.json()
      setDispositivos((prev) => [...prev, nuevo])
      setNuevoNombre("")
      setNuevoTipo("sensor")
      setMostrarFormulario(false)
    } catch (error) {
      console.error("Error al agregar dispositivo:", error)
      setErrorNuevo("Error de conexión")
    } finally {
      setEnviandoNuevo(false)
    }
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="relative z-10 flex">
        <SeguridadSidebar active="dispositivos" permisos={permisos} />

        <div className="flex-1 container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <EncabezadoVista
              titulo="Centro de dispositivos"
              bajada={
                puedeVerOtros
                  ? "Tus Raspberry Pi y sus nodos en tiempo real. Más abajo puedes consultar el equipo de cualquier cuenta."
                  : `Estado del equipo asociado a tu cuenta, ${nombreUsuario}.`
              }
            />

            {!(puedeVerOtros && !seleccionado) && (
              <button
                type="button"
                onClick={() => setMostrarFormulario((v) => !v)}
                className="inline-flex items-center gap-2 rounded-md bg-foreground/10 hover:bg-foreground/15 text-foreground px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="h-4 w-4" />
                Agregar dispositivo
              </button>
            )}
          </div>

          <GatewaysPanel />

          {mostrarFormulario && (
            <GlassPanel padding="md" radius="lg" className="mb-8">
              <form onSubmit={agregarDispositivo} className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="nuevo-nombre" className="text-xs text-foreground/50 block mb-1.5">
                    Nombre
                  </label>
                  <input
                    id="nuevo-nombre"
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Ej. Cámara del patio"
                    autoFocus
                    className="w-full px-3 py-2 rounded-md text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"
                  />
                </div>
                <div>
                  <label htmlFor="nuevo-tipo" className="text-xs text-foreground/50 block mb-1.5">
                    Tipo
                  </label>
                  <select
                    id="nuevo-tipo"
                    value={nuevoTipo}
                    onChange={(e) => setNuevoTipo(e.target.value as TipoDispositivo)}
                    className="px-3 py-2 rounded-md text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"
                  >
                    {TIPOS_VALIDOS.map((tipo) => (
                      <option key={tipo} value={tipo} className="bg-popover">
                        {TIPO_LABEL[tipo]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={enviandoNuevo}
                  className="rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enviandoNuevo ? "Agregando..." : "Agregar"}
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  aria-label="Cancelar"
                  className="p-2 text-foreground/40 hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                {errorNuevo && <p className="w-full text-xs text-red-300">{errorNuevo}</p>}
              </form>
            </GlassPanel>
          )}

          {puedeVerOtros && (
            <GlassPanel padding="md" radius="lg" className="mb-8">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar usuario por nombre o correo..."
                  className="w-full pl-9 pr-4 py-2 rounded-md text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/10"
                />
              </div>

              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {usuariosFiltrados.length === 0 ? (
                  <p className="text-sm text-foreground/40 px-1">
                    {cargandoUsuarios
                      ? "Cargando usuarios..."
                      : errorUsuarios
                        ? "No se pudieron cargar los usuarios. Intenta recargar la página."
                        : "Ningún usuario coincide con la búsqueda."}
                  </p>
                ) : (
                  usuariosFiltrados.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        // El reinicio de la carga va aquí, no en el efecto (react-hooks/set-state-in-effect).
                        setSeleccionado(u)
                        setDispositivos([])
                        setCargandoDispositivos(true)
                        setErrorDispositivos(false)
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                        seleccionado?.id === u.id
                          ? "bg-foreground/10 text-foreground border-foreground/30"
                          : "text-foreground/60 border-foreground/10 hover:text-foreground hover:border-foreground/20"
                      }`}
                    >
                      {u.nombre} <span className="text-foreground/40">· {u.rol.nombre}</span>
                    </button>
                  ))
                )}
              </div>
            </GlassPanel>
          )}

          {puedeVerOtros && !seleccionado ? (
            <GlassPanel padding="lg" radius="lg">
              <p className="text-foreground/50 text-sm text-center py-8">
                Selecciona un usuario arriba para ver su equipo.
              </p>
            </GlassPanel>
          ) : (
            <>
              {puedeVerOtros && seleccionado && (
                <p className="text-sm text-foreground/50 mb-4">
                  Mostrando el equipo de <span className="text-foreground font-medium">{seleccionado.nombre}</span> (
                  {seleccionado.email})
                </p>
              )}

              {cargandoDispositivos ? (
                <GlassPanel padding="lg" radius="lg">
                  <p className="text-foreground/50 text-sm text-center py-8">Cargando equipo...</p>
                </GlassPanel>
              ) : errorDispositivos ? (
                <GlassPanel padding="lg" radius="lg">
                  <p className="text-red-300 text-sm text-center py-8">
                    No se pudo cargar el equipo. Intenta recargar la página.
                  </p>
                </GlassPanel>
              ) : (
                <EquipoGrid dispositivos={dispositivos} onAgregar={() => setMostrarFormulario(true)} />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/app-header'
import { GlassBackground, consolaBlobs } from '@/components/glass-background'
import { GlassPanel } from '@/components/glass-panel'
import { permisosEfectivos, type Permiso } from '@/lib/permisos'
import { PermisosPanel } from './PermisosPanel'
import { EncabezadoVista } from "@/components/marca"

interface Usuario {
  id: number
  nombre: string
  email: string
  // Verificación en dos pasos (roadmap de funciones #8): null = sin activar.
  totpActivadoEn?: string | null
  rol: {
    nombre: string
  }
}

interface Rol {
  id: number
  nombre: string
}

interface Reporte {
  id: number
  titulo: string
  descripcion: string
  estado: string
  createdAt: string
  usuario: {
    nombre: string
    email: string
  }
  operadorAsignadoId: number | null
  operadorAsignado: {
    id: number
    nombre: string
    email: string
  } | null
}

interface RegistroAuditoria {
  id: number
  accion: string
  adminEmail: string
  objetivoEmail: string
  valorAnterior: string | null
  valorNuevo: string | null
  createdAt: string
}

function describirAuditoria(r: RegistroAuditoria) {
  if (r.accion === 'cuenta_eliminada') return `Eliminó la cuenta (era ${r.valorAnterior ?? 'sin rol'})`
  if (r.accion === 'cambio_rol') return `Cambió el rol: ${r.valorAnterior} → ${r.valorNuevo}`
  if (r.accion === 'permiso_cambiado') return `Cambió un permiso: ${r.valorAnterior} → ${r.valorNuevo}`
  if (r.accion === 'dos_pasos_quitado') return 'Quitó la verificación en dos pasos'
  return r.accion
}

// I-1 (revisión de cierre 2026-09-25): el servidor (PATCH /api/admin/usuarios/[id])
// rechaza con 403 un cambio de rol que le otorgaría a la cuenta un permiso que el
// actor no-Admin no tiene, o que toque usuarios.gestionar en cualquier dirección.
// `GET /api/admin/usuarios` no devuelve las excepciones (PermisoCuenta) de cada
// fila, así que aquí solo se puede aproximar comparando los defaults de rol —
// nunca las excepciones reales de esa cuenta. Eso puede dejar habilitada una
// opción que el servidor terminará rechazando (si la cuenta objetivo tiene una
// excepción que el resumen por defaults no ve) — el PATCH sigue siendo la
// autoridad; esto solo evita el caso común (una cuenta sin excepciones).
function opcionDeRolPermitida(rolActual: string, rolDestino: string, permisosActor: Permiso[]): boolean {
  if (rolActual === rolDestino) return true
  const antes = permisosEfectivos(rolActual, [])
  const despues = permisosEfectivos(rolDestino, [])
  const cambiados = new Set<Permiso>([...antes, ...despues].filter((p) => antes.has(p) !== despues.has(p)))
  if (cambiados.has('usuarios.gestionar')) return false
  for (const p of despues) {
    if (!antes.has(p) && !permisosActor.includes(p)) return false
  }
  return true
}

const getRoleBadgeClass =(role: string) => {
  if (role === 'Admin') return 'bg-red-500/15 text-red-300 border border-red-500/30'
  if (role === 'Operador') return 'border bg-signal/15 text-accent-foreground border-signal/30'
  return 'bg-foreground/10 text-foreground/60 border border-foreground/10'
}

interface AdminClientProps {
  usuarioId: number
  esAdmin: boolean
  permisos: Permiso[]
}

export function AdminClient({ usuarioId, esAdmin, permisos }: AdminClientProps) {
  const puedeGestionar = permisos.includes('usuarios.gestionar')
  const puedeVerReportes = permisos.includes('reportes.ver_todos')
  const puedeAsignar = permisos.includes('reportes.asignar')
  const puedeVerAuditoria = permisos.includes('auditoria.ver')
  const [editandoPermisos, setEditandoPermisos] = useState<Usuario | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [roles, setRoles] = useState<Rol[]>([])
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [processingIds, setProcessingIds] = useState<number[]>([])
  // Separado de processingIds: usuario.id y reporte.id son secuencias distintas
  // que pueden coincidir en valor (ej. ambos "3") — compartir el arreglo
  // deshabilitaría por error una fila de usuario al asignar un reporte con el
  // mismo id numérico, o viceversa.
  const [processingReporteIds, setProcessingReporteIds] = useState<number[]>([])
  const [message, setMessage] = useState('')

  const cargarAuditoria = async () => {
    try {
      const res = await fetch('/api/admin/auditoria', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAuditoria(data.registros || [])
      } else {
        console.error('Error loading auditoria:', res.status)
      }
    } catch (error) {
      console.error('Error loading auditoria:', error)
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        // El acceso ya se verificó en app/admin/page.tsx; cada sección se
        // carga solo si hay permiso (06_UI_UX.md §F).

        if (puedeGestionar) {
          // Cargar usuarios
          const usuariosRes = await fetch('/api/admin/usuarios', { credentials: 'include' })
          if (usuariosRes.ok) {
            const usuariosData = await usuariosRes.json()
            setUsuarios(usuariosData.usuarios || [])
          } else {
            console.error('Error loading usuarios:', usuariosRes.status)
          }

          // Cargar roles
          const rolesRes = await fetch('/api/admin/roles', { credentials: 'include' })
          if (rolesRes.ok) {
            const rolesData = await rolesRes.json()
            setRoles(rolesData || [])
          } else {
            console.error('Error loading roles:', rolesRes.status)
          }
        }

        if (puedeVerReportes) {
          // Cargar reportes
          const reportesRes = await fetch('/api/admin/reportes', { credentials: 'include' })
          if (reportesRes.ok) {
            const reportesData = await reportesRes.json()
            setReportes(reportesData.reportes || [])
          } else {
            console.error('Error loading reportes:', reportesRes.status)
          }
        }

        if (puedeVerAuditoria) {
          // Cargar auditoría de cuentas (06_UI_UX.md §J)
          const auditoriaRes = await fetch('/api/admin/auditoria', { credentials: 'include' })
          if (auditoriaRes.ok) {
            const auditoriaData = await auditoriaRes.json()
            setAuditoria(auditoriaData.registros || [])
          } else {
            console.error('Error loading auditoria:', auditoriaRes.status)
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [puedeGestionar, puedeVerReportes, puedeVerAuditoria])

  const handleRoleChange = async (usuarioId: number, newRolId: number) => {
    setProcessingIds(prev => [...prev, usuarioId])
    setMessage('')
    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ rolId: newRolId })
      })

      if (res.ok) {
        const data = await res.json()
        // Actualizar la lista localmente
        setUsuarios(prev => prev.map(u => u.id === usuarioId ? data.usuario : u))
        // El parámetro usuarioId de este handler oculta la prop del mismo
        // nombre — aquí se refiere a la cuenta editada, que es lo que se
        // quiere: sus excepciones de permisos se borraron al cambiar de rol.
        if (editandoPermisos?.id === usuarioId) setEditandoPermisos(null)
        if (puedeVerAuditoria) cargarAuditoria()
      } else {
        const error = await res.json()
        setMessage(error.error || 'Error al actualizar el rol')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      setMessage('Error al actualizar el rol')
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== usuarioId))
    }
  }

  const handleAsignarOperador = async (reporteId: number, operadorAsignadoId: number | null) => {
    setProcessingReporteIds(prev => [...prev, reporteId])
    setMessage('')
    try {
      const res = await fetch(`/api/reportes/${reporteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ operadorAsignadoId })
      })

      if (res.ok) {
        const reporteActualizado = await res.json()
        setReportes(prev => prev.map(r => r.id === reporteId
          ? { ...r, operadorAsignadoId: reporteActualizado.operadorAsignadoId, operadorAsignado: reporteActualizado.operadorAsignado }
          : r
        ))
      } else {
        const error = await res.json()
        setMessage(error.error || 'Error al asignar el reporte')
      }
    } catch (error) {
      console.error('Error assigning reporte:', error)
      setMessage('Error al asignar el reporte')
    } finally {
      setProcessingReporteIds(prev => prev.filter(id => id !== reporteId))
    }
  }

  // Para quien perdió el teléfono y sus códigos de respaldo: queda en la auditoría y cierra sus sesiones.
  const handleQuitar2fa = async (usuarioId: number, nombre: string) => {
    if (!confirm('¿Quitar la verificación en dos pasos de "' + nombre + '"? Se cerrarán todas sus sesiones y podrá volver a activarla desde Ajustes.')) {
      return
    }
    setProcessingIds(prev => [...prev, usuarioId])
    setMessage('')
    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}/2fa`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setUsuarios(prev => prev.map(u => (u.id === usuarioId ? { ...u, totpActivadoEn: null } : u)))
        if (puedeVerAuditoria) cargarAuditoria()
      } else {
        const error = await res.json().catch(() => null)
        setMessage(error?.error || 'No se pudo quitar la verificación en dos pasos')
      }
    } catch {
      setMessage('No se pudo quitar la verificación en dos pasos')
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== usuarioId))
    }
  }

  const handleDeleteUser = async (usuarioId: number, nombre: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar al usuario "' + nombre + '"? Esta acción no se puede deshacer.')) {
      return
    }

    setProcessingIds(prev => [...prev, usuarioId])
    setMessage('')
    try {
      const res = await fetch(`/api/admin/usuarios/${usuarioId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        // Remover de la lista localmente
        setUsuarios(prev => prev.filter(u => u.id !== usuarioId))
        if (puedeVerAuditoria) cargarAuditoria()
      } else {
        const error = await res.json()
        setMessage(error.error || 'Error al eliminar el usuario')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      setMessage('Error al eliminar el usuario')
    } finally {
      setProcessingIds(prev => prev.filter(id => id !== usuarioId))
    }
  }

  if (loading) {
    return (
      <main className="relative isolate min-h-screen bg-background">
        <GlassBackground blobs={consolaBlobs} />
        <AppHeader />
        <div className="container mx-auto px-4 lg:px-8 py-12">
          <p className="text-foreground/50">Cargando...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="relative isolate min-h-screen bg-background">
      <GlassBackground blobs={consolaBlobs} />
      <AppHeader />

      <div className="container mx-auto px-4 lg:px-8 py-12 max-w-6xl">
        <EncabezadoVista
          titulo="Panel de administración"
          bajada="Cuentas, roles, permisos y el registro de todo lo que cambia."
        />

        {message && (
          <p role="alert" aria-live="polite" className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {message}
          </p>
        )}

        <div className="space-y-6">
          {puedeGestionar && (
          <GlassPanel padding="md" radius="lg">
            <h2 className="text-lg font-semibold text-foreground mb-4">Usuarios del Sistema</h2>

            {usuarios.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-foreground/50">No hay usuarios registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Nombre</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Email</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Rol Actual</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Cambiar Rol</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => {
                      // Cubre por rol (Admin siempre tiene usuarios.gestionar por default) el caso que
                      // I-1 también protege en el servidor. No cubre una cuenta no-Admin con
                      // usuarios.gestionar otorgado por excepción — /api/admin/usuarios no expone las
                      // excepciones de cada fila, así que el botón Eliminar no puede deshabilitarse por
                      // adelantado ahí; el DELETE del servidor sigue rechazándolo con 403 igual.
                      const filaAdminBloqueada = usuario.rol.nombre === 'Admin' && !esAdmin
                      const esPropia = usuario.id === usuarioId
                      return (
                      <tr key={usuario.id} className="hover:bg-foreground/[0.03] border-b border-foreground/5">
                        <td className="px-4 py-3 text-foreground">{usuario.nombre}</td>
                        <td className="px-4 py-3 text-foreground/70">{usuario.email}</td>
                        <td className="px-4 py-3">
                          <span className={"px-2 py-1 rounded-full text-xs font-medium " + getRoleBadgeClass(usuario.rol.nombre)}>
                            {usuario.rol.nombre}
                          </span>
                          {usuario.totpActivadoEn && (
                            <span className="ml-2 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-300" title="Verificación en dos pasos activa">
                              2 pasos
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={roles.find(r => r.nombre === usuario.rol.nombre)?.id || ''}
                            onChange={(e) => handleRoleChange(usuario.id, parseInt(e.target.value))}
                            disabled={filaAdminBloqueada || processingIds.includes(usuario.id)}
                            className="rounded px-3 py-1 text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {roles.filter((rol) => esAdmin || rol.nombre !== 'Admin' || rol.nombre === usuario.rol.nombre).map((rol) => {
                              const opcionBloqueada =
                                !esAdmin && !opcionDeRolPermitida(usuario.rol.nombre, rol.nombre, permisos)
                              return (
                                <option
                                  key={rol.id}
                                  value={rol.id}
                                  disabled={opcionBloqueada}
                                  className="bg-popover text-popover-foreground"
                                >
                                  {rol.nombre}
                                </option>
                              )
                            })}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {usuario.rol.nombre !== 'Admin' && !esPropia && (
                            <button
                              type="button"
                              onClick={() => setEditandoPermisos(usuario)}
                              className="mr-2 bg-foreground/[0.06] hover:bg-foreground/10 text-foreground border border-foreground/10 px-3 py-1 rounded text-sm font-medium transition-colors"
                            >
                              Permisos
                            </button>
                          )}
                          {usuario.totpActivadoEn && !esPropia && !filaAdminBloqueada && (
                            <button
                              type="button"
                              onClick={() => handleQuitar2fa(usuario.id, usuario.nombre)}
                              disabled={processingIds.includes(usuario.id)}
                              className="mr-2 bg-foreground/[0.06] hover:bg-foreground/10 text-foreground border border-foreground/10 px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              Quitar 2 pasos
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(usuario.id, usuario.nombre)}
                            className="bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={esPropia || filaAdminBloqueada || processingIds.includes(usuario.id)}
                          >
                            {processingIds.includes(usuario.id) ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
          )}

          {editandoPermisos && (
            <PermisosPanel
              key={editandoPermisos.id}
              usuario={editandoPermisos}
              esAdmin={esAdmin}
              permisos={permisos}
              onCerrar={() => setEditandoPermisos(null)}
              onGuardado={() => { if (puedeVerAuditoria) cargarAuditoria() }}
            />
          )}

          {puedeVerReportes && (
          <GlassPanel padding="md" radius="lg">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Reportes del Sistema</h2>
              <a
                href="/api/reportes/export"
                className="text-xs font-medium text-foreground/50 hover:text-foreground transition-colors"
              >
                Exportar CSV
              </a>
            </div>

            {reportes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-foreground/50">No hay reportes registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Título</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Descripción</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Estado</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Usuario</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Asignado a</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportes.map((reporte) => (
                      <tr key={reporte.id} className="hover:bg-foreground/[0.03] border-b border-foreground/5">
                        <td className="px-4 py-3 font-medium text-foreground">{reporte.titulo}</td>
                        <td className="px-4 py-3 text-foreground/60 max-w-xs truncate">{reporte.descripcion}</td>
                        <td className="px-4 py-3">
                          <span className={'px-2 py-1 rounded-full text-xs font-medium border ' + (reporte.estado === 'resuelto' ? 'bg-green-500/15 text-green-300 border-green-500/30' : 'bg-foreground/10 text-foreground/60 border-foreground/10')}>
                            {reporte.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-foreground font-medium">{reporte.usuario.nombre}</p>
                            <p className="text-foreground/50 text-xs">{reporte.usuario.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={reporte.operadorAsignadoId ?? ''}
                            onChange={(e) => handleAsignarOperador(reporte.id, e.target.value === '' ? null : parseInt(e.target.value))}
                            disabled={!puedeAsignar || processingReporteIds.includes(reporte.id)}
                            className="rounded px-3 py-1 text-sm bg-foreground/[0.04] border border-foreground/10 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="" className="bg-popover text-popover-foreground">Sin asignar</option>
                            {(puedeGestionar
                              ? usuarios.filter((u) => u.rol.nombre === 'Operador')
                              : reporte.operadorAsignado ? [reporte.operadorAsignado] : []
                            ).map((operador) => (
                              <option key={operador.id} value={operador.id} className="bg-popover text-popover-foreground">
                                {operador.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/50">{new Date(reporte.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
          )}

          {puedeVerAuditoria && (
          <GlassPanel padding="md" radius="lg">
            <h2 className="text-lg font-semibold text-foreground mb-1">Auditoría de Cuentas</h2>
            <p className="text-xs text-foreground/50 mb-4">Cambios de rol, cambios de permisos y cuentas eliminadas. Los registros se conservan aunque la cuenta ya no exista.</p>

            {auditoria.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-foreground/50">Aún no hay cambios de cuentas registrados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Fecha</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Admin</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Cuenta afectada</th>
                      <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-foreground/70">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((registro) => (
                      <tr key={registro.id} className="hover:bg-foreground/[0.03] border-b border-foreground/5">
                        <td className="px-4 py-3 text-sm text-foreground/50 whitespace-nowrap">{new Date(registro.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-foreground/70">{registro.adminEmail}</td>
                        <td className="px-4 py-3 text-foreground">{registro.objetivoEmail}</td>
                        <td className="px-4 py-3 text-foreground/70">{describirAuditoria(registro)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassPanel>
          )}
        </div>
      </div>
    </main>
  )
}

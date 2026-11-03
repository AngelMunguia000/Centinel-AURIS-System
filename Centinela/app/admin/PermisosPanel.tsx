'use client'

import { useEffect, useState } from 'react'
import { GlassPanel } from '@/components/glass-panel'
import { PERMISOS, type EstadoPermiso, type Permiso } from '@/lib/permisos'

// 06_UI_UX.md §F: excepciones de una cuenta Usuario/Operador sobre los
// defaults de su rol. El servidor normaliza y audita; aquí solo se edita.
//
// Ruling posterior a la spec (la API ya lo exige): un actor no-Admin solo
// puede cambiar permisos que él mismo tiene, y nunca usuarios.gestionar. El
// panel refleja esto deshabilitando el control 3-estados correspondiente en
// vez de dejar que el PUT lo rechace en silencio.

interface Props {
  usuario: { id: number; nombre: string; email: string }
  esAdmin: boolean
  permisos: Permiso[]
  onCerrar: () => void
  onGuardado: () => void
}

interface Datos {
  rol: string
  estados: Record<Permiso, EstadoPermiso>
  porDefecto: Permiso[]
}

const OPCIONES: { valor: EstadoPermiso; etiqueta: string }[] = [
  { valor: 'defecto', etiqueta: 'Por defecto' },
  { valor: 'otorgado', etiqueta: 'Otorgado' },
  { valor: 'quitado', etiqueta: 'Quitado' },
]

export function PermisosPanel({ usuario, esAdmin, permisos, onCerrar, onGuardado }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [estados, setEstados] = useState<Record<Permiso, EstadoPermiso> | null>(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/usuarios/${usuario.id}/permisos`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'No se pudieron cargar los permisos')
        setDatos(body)
        setEstados(body.estados)
      })
      .catch((e: Error) => setError(e.message))
  }, [usuario.id])

  const guardar = async () => {
    if (!estados) return
    setGuardando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}/permisos`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permisos: estados }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'No se pudieron guardar los permisos')
      setDatos(body)
      setEstados(body.estados)
      onGuardado()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <GlassPanel padding="md" radius="lg">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Permisos de {usuario.nombre}</h2>
          <p className="text-xs text-foreground/50">
            {usuario.email}{datos ? ` · Rol ${datos.rol}` : ''} — los cambios quedan en la auditoría de cuentas.
          </p>
        </div>
        <button type="button" onClick={onCerrar} className="text-sm text-foreground/50 hover:text-foreground">
          Cerrar
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {!datos || !estados ? (
        !error && <p className="text-foreground/50 text-sm">Cargando permisos…</p>
      ) : (
        <>
          <ul className="divide-y divide-foreground/5">
            {PERMISOS.map((p) => {
              const porDefecto = datos.porDefecto.includes(p.clave)
              const esGestionUsuarios = p.clave === 'usuarios.gestionar'
              const bloqueado = !esAdmin && (esGestionUsuarios || !permisos.includes(p.clave))
              const pista = esGestionUsuarios ? 'Solo un Admin puede cambiarlo' : 'No tienes este permiso'
              return (
                <li key={p.clave} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-medium text-foreground">{p.etiqueta}</p>
                    <p className="text-xs text-foreground/50">{p.descripcion}</p>
                    <p className="text-xs text-foreground/40 mt-0.5">
                      Por defecto del rol: {porDefecto ? 'sí' : 'no'}
                      {bloqueado ? ` — ${pista}` : ''}
                    </p>
                  </div>
                  <div role="radiogroup" aria-label={p.etiqueta} className="flex rounded-md border border-foreground/10 overflow-hidden">
                    {OPCIONES.map((o) => (
                      <button
                        key={o.valor}
                        type="button"
                        role="radio"
                        aria-checked={estados[p.clave] === o.valor}
                        aria-disabled={bloqueado}
                        disabled={bloqueado}
                        onClick={() => setEstados({ ...estados, [p.clave]: o.valor })}
                        className={`px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          estados[p.clave] === o.valor
                            ? 'bg-foreground/15 text-foreground'
                            : 'text-foreground/50 hover:bg-foreground/[0.04]'
                        }`}
                      >
                        {o.etiqueta}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Guardar permisos'}
            </button>
          </div>
        </>
      )}
    </GlassPanel>
  )
}

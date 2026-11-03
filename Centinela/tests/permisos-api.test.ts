import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso, getAuthenticatedUsuario } from '@/lib/auth'
import { GET as getMe } from '@/app/api/me/route'
import { GET as getReportes } from '@/app/api/reportes/route'
import { GET as getStats } from '@/app/api/reportes/stats/route'
import { PATCH as patchReporte } from '@/app/api/reportes/[id]/route'
import { GET as getUsuarios } from '@/app/api/admin/usuarios/route'
import { PATCH as patchUsuario, DELETE as deleteUsuarioApi } from '@/app/api/admin/usuarios/[id]/route'
import { GET as getPermisos, PUT as putPermisos } from '@/app/api/admin/usuarios/[id]/permisos/route'
import { GET as getDispositivos } from '@/app/api/dispositivos/route'
import { DELETE as deleteDatosPrototipo } from '@/app/api/prototipo/datos/route'
import { PREFIJO_SIMULADO } from '@/lib/prototipo/eventos'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario, deleteReporte, setExcepcion } from './helpers'

// 06_UI_UX.md §F — spec 2026-09-24-permisos-granulares-design.md.
const creados: number[] = []
const reportesCreados: number[] = []
const emailsAuditados: string[] = []

afterEach(async () => {
  for (const id of reportesCreados.splice(0)) await deleteReporte(id)
  for (const id of creados.splice(0)) await deleteUsuario(id)
  await prisma.auditoriaCuenta.deleteMany({ where: { objetivoEmail: { in: emailsAuditados.splice(0) } } })
})

function jar(token: string) {
  return { get: (name: string) => (name === 'token' ? { value: token } : undefined) }
}

function req(method: string, url: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {}
  if (token) headers.cookie = cookieHeader(token)
  if (body !== undefined) headers['content-type'] = 'application/json'
  return new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function crear(rol: 'Usuario' | 'Operador' | 'Admin') {
  const { usuario } = await createUsuario(rol)
  creados.push(usuario.id)
  emailsAuditados.push(usuario.email)
  return usuario
}

describe('identidad con permisos', () => {
  it('getAuthenticatedUsuario calcula permisos efectivos con excepciones', async () => {
    const op = await crear('Operador')
    await setExcepcion(op.id, 'reportes.resolver', false)
    await setExcepcion(op.id, 'reportes.asignar', true)

    const usuario = await getAuthenticatedUsuario(jar(await tokenFor(op)))
    expect(usuario?.permisos.has('reportes.resolver')).toBe(false)
    expect(usuario?.permisos.has('reportes.asignar')).toBe(true)
    expect(usuario?.permisos.has('reportes.ver_todos')).toBe(true)
  })

  it('requirePermiso: 401 sin sesión, 403 sin permiso, ok con cualquiera de un array', async () => {
    const u = await crear('Usuario')
    expect((await requirePermiso({ get: () => undefined }, 'reportes.ver_todos')).reason).toBe('no_autenticado')
    expect((await requirePermiso(jar(await tokenFor(u)), 'reportes.ver_todos')).reason).toBe('no_autorizado')
    expect((await requirePermiso(jar(await tokenFor(u)), ['reportes.ver_todos', 'dispositivos.propios'])).authorized).toBe(true)
  })

  it('GET /api/me incluye permisos', async () => {
    const u = await crear('Usuario')
    const res = await getMe(req('GET', '/api/me', await tokenFor(u)))
    const body = await res.json()
    expect(body.user.permisos).toEqual(['dispositivos.propios'])
  })
})

async function crearReporte(usuarioId: number) {
  const r = await prisma.reporte.create({
    data: { titulo: 'vitest permisos', descripcion: 'x', usuarioId },
  })
  reportesCreados.push(r.id)
  return r
}

describe('reportes por permiso', () => {
  it('Usuario con reportes.ver_todos otorgado ve reportes ajenos en lista y stats', async () => {
    const autor = await crear('Usuario')
    const lector = await crear('Usuario')
    const r = await crearReporte(autor.id)
    await setExcepcion(lector.id, 'reportes.ver_todos', true)

    const lista = await (await getReportes(req('GET', '/api/reportes', await tokenFor(lector)))).json()
    const ids = (Array.isArray(lista) ? lista : lista.reportes).map((x: { id: number }) => x.id)
    expect(ids).toContain(r.id)

    const stats = await (await getStats(req('GET', '/api/reportes/stats', await tokenFor(lector)))).json()
    expect(stats.totalReportes).toBeGreaterThanOrEqual(1)
  })

  it('Operador sin reportes.resolver: 403 al resolver, pero sí reclasifica', async () => {
    const autor = await crear('Usuario')
    const op = await crear('Operador')
    const r = await crearReporte(autor.id)
    await setExcepcion(op.id, 'reportes.resolver', false)

    const resolver = await patchReporte(req('PATCH', `/api/reportes/${r.id}`, await tokenFor(op)), ctx(r.id))
    expect(resolver.status).toBe(403)

    const reclasificar = await patchReporte(
      req('PATCH', `/api/reportes/${r.id}`, await tokenFor(op), { prioridad: 'alta' }),
      ctx(r.id)
    )
    expect(reclasificar.status).toBe(200)
  })

  it('Operador con reportes.asignar otorgado puede asignar', async () => {
    const autor = await crear('Usuario')
    const op = await crear('Operador')
    const r = await crearReporte(autor.id)
    await setExcepcion(op.id, 'reportes.asignar', true)

    const res = await patchReporte(
      req('PATCH', `/api/reportes/${r.id}`, await tokenFor(op), { operadorAsignadoId: op.id }),
      ctx(r.id)
    )
    expect(res.status).toBe(200)
  })

  it('acción ≠ visibilidad: Usuario con resolver pero sin ver_todos no toca reportes ajenos', async () => {
    const autor = await crear('Usuario')
    const u = await crear('Usuario')
    const ajeno = await crearReporte(autor.id)
    const propio = await crearReporte(u.id)
    await setExcepcion(u.id, 'reportes.resolver', true)

    expect((await patchReporte(req('PATCH', `/api/reportes/${ajeno.id}`, await tokenFor(u)), ctx(ajeno.id))).status).toBe(403)
    expect((await patchReporte(req('PATCH', `/api/reportes/${propio.id}`, await tokenFor(u)), ctx(propio.id))).status).toBe(200)
  })
})

async function rolId(nombre: string) {
  return (await prisma.rol.findUniqueOrThrow({ where: { nombre } })).id
}

describe('administración por permiso', () => {
  it('lista de usuarios: 403 para Operador; 200 si tiene dispositivos.otros (solo lectura)', async () => {
    const op = await crear('Operador')
    expect((await getUsuarios(req('GET', '/api/admin/usuarios', await tokenFor(op)))).status).toBe(403)
    await setExcepcion(op.id, 'dispositivos.otros', true)
    expect((await getUsuarios(req('GET', '/api/admin/usuarios', await tokenFor(op)))).status).toBe(200)
  })

  it('no-Admin con usuarios.gestionar no asciende a Admin ni toca cuentas Admin', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    const admin = await crear('Admin')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const ascender = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor), { rolId: await rolId('Admin') }),
      ctx(u.id)
    )
    expect(ascender.status).toBe(403)

    const degradarAdmin = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${admin.id}`, await tokenFor(gestor), { rolId: await rolId('Usuario') }),
      ctx(admin.id)
    )
    expect(degradarAdmin.status).toBe(403)

    const borrarAdmin = await deleteUsuarioApi(req('DELETE', `/api/admin/usuarios/${admin.id}`, await tokenFor(gestor)), ctx(admin.id))
    expect(borrarAdmin.status).toBe(403)

    const aOperador = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor), { rolId: await rolId('Operador') }),
      ctx(u.id)
    )
    expect(aOperador.status).toBe(200)
  })

  it('cambiar el rol borra las excepciones de la cuenta', async () => {
    const admin = await crear('Admin')
    const u = await crear('Usuario')
    await setExcepcion(u.id, 'reportes.ver_todos', true)

    const res = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(admin), { rolId: await rolId('Operador') }),
      ctx(u.id)
    )
    expect(res.status).toBe(200)
    expect(await prisma.permisoCuenta.count({ where: { usuarioId: u.id } })).toBe(0)
  })
})

// Revisión 2026-09-25 (fix round de cierre, I-1): la anti-escalación del PUT
// de permisos (§ "sin escalada por cuenta intermedia" más abajo) también
// aplicaba a un cambio de rol o a un borrado de cuenta — ambos pueden
// otorgar/quitar permisos igual que una excepción explícita, y un gestor
// no-Admin no debía poder usar esas dos rutas para lograr lo que el PUT ya
// le bloqueaba.
describe('cambio de rol y borrado de cuenta — anti-escalación extendida (I-1)', () => {
  it('un gestor Usuario con usuarios.gestionar no puede ascender a otro Usuario a Operador (ganaría permisos que no tiene)', async () => {
    const gestor = await crear('Usuario')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const res = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor), { rolId: await rolId('Operador') }),
      ctx(u.id)
    )
    expect(res.status).toBe(403)

    const objetivo = await prisma.usuario.findUniqueOrThrow({
      where: { id: u.id },
      select: { rol: { select: { nombre: true } } },
    })
    expect(objetivo.rol.nombre).toBe('Usuario')
  })

  it('un gestor Operador con usuarios.gestionar sí puede pasar a un Usuario a Operador (tiene los tres defaults de Operador)', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const res = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor), { rolId: await rolId('Operador') }),
      ctx(u.id)
    )
    expect(res.status).toBe(200)
  })

  it('un gestor no-Admin no puede cambiar el rol de otro no-Admin que tiene usuarios.gestionar por excepción', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)
    await setExcepcion(u.id, 'usuarios.gestionar', true)

    const res = await patchUsuario(
      req('PATCH', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor), { rolId: await rolId('Operador') }),
      ctx(u.id)
    )
    expect(res.status).toBe(403)

    const objetivo = await prisma.usuario.findUniqueOrThrow({
      where: { id: u.id },
      select: { rol: { select: { nombre: true } } },
    })
    expect(objetivo.rol.nombre).toBe('Usuario')
  })

  it('un gestor no-Admin no puede eliminar a otro no-Admin que tiene usuarios.gestionar por excepción', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)
    await setExcepcion(u.id, 'usuarios.gestionar', true)

    const res = await deleteUsuarioApi(req('DELETE', `/api/admin/usuarios/${u.id}`, await tokenFor(gestor)), ctx(u.id))
    expect(res.status).toBe(403)
    expect(await prisma.usuario.findUnique({ where: { id: u.id } })).not.toBeNull()
  })
})

describe('/api/admin/usuarios/[id]/permisos', () => {
  it('Admin otorga y quita; se audita una fila por permiso cambiado', async () => {
    const admin = await crear('Admin')
    const op = await crear('Operador')

    const res = await putPermisos(
      req('PUT', `/api/admin/usuarios/${op.id}/permisos`, await tokenFor(admin), {
        permisos: { 'reportes.asignar': 'otorgado', 'reportes.resolver': 'quitado', 'reportes.ver_todos': 'defecto' },
      }),
      ctx(op.id)
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.estados['reportes.asignar']).toBe('otorgado')
    expect(body.efectivos).not.toContain('reportes.resolver')

    const auditoria = await prisma.auditoriaCuenta.findMany({ where: { objetivoId: op.id, accion: 'permiso_cambiado' } })
    expect(auditoria.map((a) => a.valorNuevo).sort()).toEqual(['reportes.asignar: otorgado', 'reportes.resolver: quitado'])
  })

  it('guardar sin cambios no audita nada; otorgar lo que el rol ya trae se normaliza a defecto', async () => {
    const admin = await crear('Admin')
    const op = await crear('Operador')
    const res = await putPermisos(
      req('PUT', `/api/admin/usuarios/${op.id}/permisos`, await tokenFor(admin), { permisos: { 'reportes.resolver': 'otorgado' } }),
      ctx(op.id)
    )
    expect(res.status).toBe(200)
    expect(await prisma.permisoCuenta.count({ where: { usuarioId: op.id } })).toBe(0)
    expect(await prisma.auditoriaCuenta.count({ where: { objetivoId: op.id } })).toBe(0)
  })

  it('400 sobre cuenta Admin, 400 con clave o estado inválido, 403 sobre sí mismo, 404 inexistente', async () => {
    const admin = await crear('Admin')
    const otroAdmin = await crear('Admin')
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)
    const put = (token: string, id: number, permisos: unknown) =>
      putPermisos(req('PUT', `/api/admin/usuarios/${id}/permisos`, token, { permisos }), ctx(id))

    expect((await put(await tokenFor(admin), otroAdmin.id, { 'reportes.asignar': 'quitado' })).status).toBe(400)
    expect((await put(await tokenFor(admin), u.id, { 'reportes.borrar': 'otorgado' })).status).toBe(400)
    expect((await put(await tokenFor(admin), u.id, { 'reportes.asignar': 'si' })).status).toBe(400)
    expect((await put(await tokenFor(gestor), gestor.id, { 'reportes.asignar': 'otorgado' })).status).toBe(403)
    expect((await put(await tokenFor(admin), 999999, { 'reportes.asignar': 'otorgado' })).status).toBe(404)
  })

  it('403 para quien no tiene usuarios.gestionar; GET devuelve estados', async () => {
    const op = await crear('Operador')
    const u = await crear('Usuario')
    expect((await getPermisos(req('GET', `/api/admin/usuarios/${u.id}/permisos`, await tokenFor(op)), ctx(u.id))).status).toBe(403)

    const admin = await crear('Admin')
    const res = await getPermisos(req('GET', `/api/admin/usuarios/${u.id}/permisos`, await tokenFor(admin)), ctx(u.id))
    const body = await res.json()
    expect(body.rol).toBe('Usuario')
    expect(body.porDefecto).toEqual(['dispositivos.propios'])
    expect(body.estados['reportes.ver_todos']).toBe('defecto')
  })
})

// Revisión 2026-09-25 (fix round 1): un actor no-Admin que solo llegó aquí por
// una excepción usuarios.gestionar no puede usar ese acceso para fabricarse
// (o a un tercero) más permisos de los que él mismo tiene.
describe('/api/admin/usuarios/[id]/permisos — sin escalada por cuenta intermedia', () => {
  it('gestor no-Admin no puede otorgar usuarios.gestionar a otra cuenta', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const res = await putPermisos(
      req('PUT', `/api/admin/usuarios/${u.id}/permisos`, await tokenFor(gestor), {
        permisos: { 'usuarios.gestionar': 'otorgado' },
      }),
      ctx(u.id)
    )
    expect(res.status).toBe(403)
    expect(await prisma.permisoCuenta.count({ where: { usuarioId: u.id, permiso: 'usuarios.gestionar' } })).toBe(0)
  })

  it('gestor no-Admin no puede otorgar un permiso que él mismo no tiene', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const res = await putPermisos(
      req('PUT', `/api/admin/usuarios/${u.id}/permisos`, await tokenFor(gestor), {
        permisos: { 'auditoria.ver': 'otorgado' },
      }),
      ctx(u.id)
    )
    expect(res.status).toBe(403)
    expect(await prisma.permisoCuenta.count({ where: { usuarioId: u.id, permiso: 'auditoria.ver' } })).toBe(0)
  })

  it('gestor no-Admin sí puede otorgar un permiso que él mismo tiene', async () => {
    const gestor = await crear('Operador')
    const u = await crear('Usuario')
    await setExcepcion(gestor.id, 'usuarios.gestionar', true)

    const res = await putPermisos(
      req('PUT', `/api/admin/usuarios/${u.id}/permisos`, await tokenFor(gestor), {
        permisos: { 'reportes.ver_todos': 'otorgado' },
      }),
      ctx(u.id)
    )
    expect(res.status).toBe(200)
  })
})

describe('dispositivos y prototipo por permiso', () => {
  it('Operador con dispositivos.propios otorgado ve su equipo; Usuario con él quitado recibe 403', async () => {
    const op = await crear('Operador')
    expect((await getDispositivos(req('GET', '/api/dispositivos', await tokenFor(op)))).status).toBe(403)
    await setExcepcion(op.id, 'dispositivos.propios', true)
    expect((await getDispositivos(req('GET', '/api/dispositivos', await tokenFor(op)))).status).toBe(200)

    const u = await crear('Usuario')
    await setExcepcion(u.id, 'dispositivos.propios', false)
    expect((await getDispositivos(req('GET', '/api/dispositivos', await tokenFor(u)))).status).toBe(403)
  })

  it('Usuario con dispositivos.otros consulta el equipo de otra cuenta vía usuarioId', async () => {
    const u = await crear('Usuario')
    const otro = await crear('Usuario')
    await setExcepcion(u.id, 'dispositivos.otros', true)
    // Dispositivo no tiene onDelete: Cascade hacia Usuario (prisma/schema.prisma:175-189):
    // hay que borrarlo antes de que el afterEach borre las cuentas, o el FK lo bloquea.
    const dispositivo = await prisma.dispositivo.create({
      data: {
        nombre: 'vitest cámara',
        uid: `vitest-disp-${Date.now()}`,
        tipo: 'camara',
        conexion: 'ESTABLE',
        usuarioId: otro.id,
      },
    })
    try {
      const res = await getDispositivos(req('GET', `/api/dispositivos?usuarioId=${otro.id}`, await tokenFor(u)))
      expect(res.status).toBe(200)
      const body = await res.json()
      const ids = body.dispositivos.map((d: { id: number }) => d.id)
      expect(ids).toContain(dispositivo.id)
      expect(body.dispositivos.every((d: { usuarioId: number }) => d.usuarioId === otro.id)).toBe(true)
    } finally {
      await prisma.dispositivo.deleteMany({ where: { id: dispositivo.id } })
    }
  })

  it('Usuario con prototipo.ejecutar puede limpiar datos simulados', async () => {
    const u = await crear('Usuario')
    expect((await deleteDatosPrototipo(req('DELETE', '/api/prototipo/datos', await tokenFor(u)))).status).toBe(403)
    await setExcepcion(u.id, 'prototipo.ejecutar', true)
    expect((await deleteDatosPrototipo(req('DELETE', '/api/prototipo/datos', await tokenFor(u)))).status).toBe(200)
  })

  // M-5 (revisión 2026-09-25): la limpieza borra lo simulado del Admin o de
  // quien ejecuta la limpieza (usuarioId), nunca lo de un tercero no-Admin —
  // aunque ese tercero también use el prefijo [SIMULADO].
  it('DELETE /api/prototipo/datos solo borra lo simulado propio del ejecutor, no lo de otro no-Admin', async () => {
    const ejecutor = await crear('Usuario')
    await setExcepcion(ejecutor.id, 'prototipo.ejecutar', true)
    const otro = await crear('Usuario')

    const propio = await prisma.reporte.create({
      data: { titulo: `${PREFIJO_SIMULADO} propio del ejecutor`, descripcion: 'x', usuarioId: ejecutor.id },
    })
    const ajeno = await prisma.reporte.create({
      data: { titulo: `${PREFIJO_SIMULADO} de otro no-Admin`, descripcion: 'x', usuarioId: otro.id },
    })
    reportesCreados.push(propio.id, ajeno.id)

    const res = await deleteDatosPrototipo(req('DELETE', '/api/prototipo/datos', await tokenFor(ejecutor)))
    expect(res.status).toBe(200)

    expect(await prisma.reporte.findUnique({ where: { id: propio.id } })).toBeNull()
    expect(await prisma.reporte.findUnique({ where: { id: ajeno.id } })).not.toBeNull()
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as postReporte } from '@/app/api/reportes/route'
import { PATCH as patchReporte } from '@/app/api/reportes/[id]/route'
import { createUsuario, tokenFor, cookieHeader, deleteUsuario, deleteReporte } from './helpers'

// Prioridad 4 (auditoría integral 26 ago, AUD2-15): el núcleo del producto —
// crear → pendiente → resuelto, y el combo resolver+reclasificar de la Fase 39.

function jsonRequest(url: string, method: string, token: string, body?: unknown) {
  const headers = new Headers({ 'content-type': 'application/json' })
  headers.set('cookie', cookieHeader(token))
  return new NextRequest(new URL(url), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/reportes → PATCH /api/reportes/[id]', () => {
  const cleanupUsuarioIds: number[] = []
  const cleanupReporteIds: number[] = []

  afterEach(async () => {
    while (cleanupReporteIds.length) await deleteReporte(cleanupReporteIds.pop()!)
    while (cleanupUsuarioIds.length) await deleteUsuario(cleanupUsuarioIds.pop()!)
  })

  it('un Usuario crea un reporte y nace en estado pendiente', async () => {
    const { usuario } = await createUsuario('Usuario')
    cleanupUsuarioIds.push(usuario.id)

    const req = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(usuario), {
      titulo: 'Vitest: falla de acceso',
      descripcion: 'Descripción de prueba',
    })
    const res = await postReporte(req)
    const reporte = await res.json()
    cleanupReporteIds.push(reporte.id)

    expect(res.status).toBe(201)
    expect(reporte.estado).toBe('pendiente')
    expect(reporte.prioridad).toBe('media') // DEFAULT_PRIORIDAD
    expect(reporte.usuarioId).toBe(usuario.id)
  })

  it('un Operador resuelve el reporte (PATCH sin cuerpo) y queda resuelto', async () => {
    const { usuario: creador } = await createUsuario('Usuario')
    const { usuario: operador } = await createUsuario('Operador')
    cleanupUsuarioIds.push(creador.id, operador.id)

    const crearReq = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(creador), {
      titulo: 'Vitest: pendiente de resolver',
      descripcion: 'Descripción',
    })
    const creado = await (await postReporte(crearReq)).json()
    cleanupReporteIds.push(creado.id)

    const patchReq = new NextRequest(new URL(`http://localhost/api/reportes/${creado.id}`), {
      method: 'PATCH',
      headers: new Headers({ cookie: cookieHeader(await tokenFor(operador)) }),
    })
    const res = await patchReporte(patchReq, { params: Promise.resolve({ id: String(creado.id) }) })
    const actualizado = await res.json()

    expect(res.status).toBe(200)
    expect(actualizado.estado).toBe('resuelto')
    expect(actualizado.resueltoPorId).toBe(operador.id)
  })

  it('un Usuario no puede resolver/reclasificar reportes (solo Admin/Operador)', async () => {
    const { usuario: creador } = await createUsuario('Usuario')
    cleanupUsuarioIds.push(creador.id)

    const crearReq = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(creador), {
      titulo: 'Vitest: no debería poder resolverse a sí mismo',
      descripcion: 'Descripción',
    })
    const creado = await (await postReporte(crearReq)).json()
    cleanupReporteIds.push(creado.id)

    const patchReq = new NextRequest(new URL(`http://localhost/api/reportes/${creado.id}`), {
      method: 'PATCH',
      headers: new Headers({ cookie: cookieHeader(await tokenFor(creador)) }),
    })
    const res = await patchReporte(patchReq, { params: Promise.resolve({ id: String(creado.id) }) })

    expect(res.status).toBe(403)
  })

  it('Fase 39: resolver+reclasificar en una sola llamada (resolver:true + prioridad/categoria)', async () => {
    const { usuario: creador } = await createUsuario('Usuario')
    const { usuario: admin } = await createUsuario('Admin')
    cleanupUsuarioIds.push(creador.id, admin.id)

    const crearReq = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(creador), {
      titulo: 'Vitest: resolver y reclasificar junto',
      descripcion: 'Descripción',
    })
    const creado = await (await postReporte(crearReq)).json()
    cleanupReporteIds.push(creado.id)

    const patchReq = jsonRequest(
      `http://localhost/api/reportes/${creado.id}`,
      'PATCH',
      await tokenFor(admin),
      { prioridad: 'critica', categoria: 'Seguridad', resolver: true }
    )
    const res = await patchReporte(patchReq, { params: Promise.resolve({ id: String(creado.id) }) })
    const actualizado = await res.json()

    expect(res.status).toBe(200)
    expect(actualizado.estado).toBe('resuelto')
    expect(actualizado.prioridad).toBe('critica')
    expect(actualizado.categoria).toBe('Seguridad')
    expect(actualizado.resueltoPorId).toBe(admin.id)
  })

  it('reclasificar sin resolver (solo prioridad/categoria) deja el reporte pendiente', async () => {
    const { usuario: creador } = await createUsuario('Usuario')
    const { usuario: operador } = await createUsuario('Operador')
    cleanupUsuarioIds.push(creador.id, operador.id)

    const crearReq = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(creador), {
      titulo: 'Vitest: solo reclasificar',
      descripcion: 'Descripción',
    })
    const creado = await (await postReporte(crearReq)).json()
    cleanupReporteIds.push(creado.id)

    const patchReq = jsonRequest(
      `http://localhost/api/reportes/${creado.id}`,
      'PATCH',
      await tokenFor(operador),
      { prioridad: 'alta' }
    )
    const res = await patchReporte(patchReq, { params: Promise.resolve({ id: String(creado.id) }) })
    const actualizado = await res.json()

    expect(actualizado.estado).toBe('pendiente')
    expect(actualizado.prioridad).toBe('alta')
  })

  it('rechaza una prioridad fuera del catálogo', async () => {
    const { usuario: creador } = await createUsuario('Usuario')
    const { usuario: operador } = await createUsuario('Operador')
    cleanupUsuarioIds.push(creador.id, operador.id)

    const crearReq = jsonRequest('http://localhost/api/reportes', 'POST', await tokenFor(creador), {
      titulo: 'Vitest: prioridad inválida',
      descripcion: 'Descripción',
    })
    const creado = await (await postReporte(crearReq)).json()
    cleanupReporteIds.push(creado.id)

    const patchReq = jsonRequest(
      `http://localhost/api/reportes/${creado.id}`,
      'PATCH',
      await tokenFor(operador),
      { prioridad: 'urgentísima' }
    )
    const res = await patchReporte(patchReq, { params: Promise.resolve({ id: String(creado.id) }) })

    expect(res.status).toBe(400)
  })
})

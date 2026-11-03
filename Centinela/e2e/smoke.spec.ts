import { test, expect } from '@playwright/test'

// Suite de humo: solo lectura, no crea cuentas ni escribe en la base de datos.

test('la landing carga con el título del producto', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Centinela AURIS/)
})

test('la página de inicio de sesión muestra el formulario', async ({ page }) => {
  await page.goto('/iniciar-sesion')
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.getByRole('button', { name: /ACCEDER AL SISTEMA/ })).toBeVisible()
})

test('una ruta inexistente muestra la 404 propia', async ({ page }) => {
  const res = await page.goto('/esta-ruta-no-existe')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Esta página no existe' })).toBeVisible()
})

test('el chequeo de salud responde y manda cabeceras de seguridad', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  expect(await res.json()).toEqual({ ok: true, db: 'ok' })
  expect(res.headers()['x-frame-options']).toBe('DENY')
})

for (const ruta of ['/soluciones', '/soluciones/agricultura', '/soluciones/hogar', '/soluciones/maritimo', '/plataforma', '/tecnologia', '/seguridad']) {
  test(`la landing ${ruta} es pública y tiene titular`, async ({ page }) => {
    const res = await page.goto(ruta)
    expect(res?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}

for (const ruta of ['/dashboard', '/reportes', '/admin', '/monitor', '/prototipo']) {
  test(`${ruta} sin sesión redirige a /iniciar-sesion`, async ({ page }) => {
    await page.goto(ruta)
    await expect(page).toHaveURL(/\/iniciar-sesion$/)
  })
}

test.describe('desde un navegador de PC (sin la app de escritorio)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' })

  test('el inicio de sesión manda a la página de descarga', async ({ page }) => {
    await page.goto('/iniciar-sesion')
    await expect(page).toHaveURL(/\/descargar$/)
    await expect(page.getByRole('link', { name: /Descargar para Windows/ }).first()).toBeVisible()
  })
})


import { test, expect } from '@playwright/test'
import { iniciarSesionAdmin } from './helpers'

// Plan 2026-10-16-enlace-edge.md Tarea 6. Escribe en dev.db un gateway desechable
// ("E2E Pi <timestamp>") y lo revoca al final.


test('vincular una Raspberry Pi muestra el token una sola vez', async ({ page }) => {
  const nombre = `E2E Pi ${Date.now()}`
  await iniciarSesionAdmin(page)
  await page.goto('/dispositivos')

  await page.getByRole('button', { name: 'Vincular Raspberry Pi' }).click()
  await page.getByLabel('Nombre de la Pi').fill(nombre)
  await page.getByLabel('Dirección de la Pi').fill('http://192.168.1.50:8000')
  await page.getByRole('button', { name: 'Generar token' }).click()

  const token = (await page.getByTestId('token-gateway').textContent())!.trim()
  expect(token.length).toBeGreaterThanOrEqual(43)
  await expect(page.getByText('Este token no se volverá a mostrar')).toBeVisible()
  await page.getByRole('button', { name: 'Ya lo copié' }).click()

  await page.reload()
  const fila = page.getByTestId('gateway-fila').filter({ hasText: nombre })
  await expect(fila).toBeVisible()
  await expect(page.getByText(token)).toHaveCount(0)

  await fila.getByRole('button', { name: 'Revocar' }).click()
  await fila.getByRole('button', { name: 'Confirmar revocación' }).click()
  await expect(fila.getByText('Revocada')).toBeVisible()
})

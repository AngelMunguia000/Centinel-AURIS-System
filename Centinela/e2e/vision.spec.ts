import { test, expect } from '@playwright/test'
import { iniciarSesionAdmin } from './helpers'

// Revisión de visión (2026-10-30): la página abre desde el menú y una marca se guarda y se quita.
test('revisión de visión: abrir, marcar y desmarcar una foto', async ({ page }) => {
  await iniciarSesionAdmin(page)
  await page.getByRole('link', { name: 'Visión' }).first().click()
  await expect(page).toHaveURL(/\/vision$/)
  await expect(page.getByRole('heading', { name: 'Revisión de visión' })).toBeVisible()
  await expect(page.getByText('Fotos sin revisar')).toBeVisible()

  await page.getByRole('button', { name: 'Todas' }).click()
  await expect(page.getByText('Cargando fotos…')).toHaveCount(0) // count() no espera a la API
  const boton = page.getByRole('button', { name: 'Había ave' }).first()
  test.skip((await boton.count()) === 0, 'la base de desarrollo no tiene fotos de cámara')

  const antes = await boton.getAttribute('aria-pressed')
  await boton.click()
  await expect(boton).not.toHaveAttribute('aria-pressed', antes!)
  await boton.click() // deja la foto como estaba
  await expect(boton).toHaveAttribute('aria-pressed', antes!)
})

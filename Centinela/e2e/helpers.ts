import type { Page } from '@playwright/test'

// Cuenta Admin de prisma/seed.ts (solo entorno de desarrollo).
export async function iniciarSesionAdmin(page: Page) {
  await page.goto('/iniciar-sesion')
  await page.getByLabel('Correo electrónico').fill('admin@auris.com')
  await page.locator('#password').fill('admin123')
  await page.getByRole('button', { name: /ACCEDER AL SISTEMA/ }).click()
  // El destino depende del rol (Admin → /reportes): basta con salir del login.
  await page.waitForURL((url) => !url.pathname.startsWith('/iniciar-sesion'))
}

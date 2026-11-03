import { test, expect } from '@playwright/test'
import { iniciarSesionAdmin } from './helpers'

// Plan 2026-10-16-enlace-edge.md Tarea 7. Solo lectura: no crea nodos.
// Vale con o sin nodos reales en dev.db (p. ej. la Pi del PO conectada).

test('monitor muestra nodos reales o el estado vacío, nunca datos de ejemplo', async ({ page }) => {
  await iniciarSesionAdmin(page)
  await page.goto('/monitor')
  const vacio = page.getByText('Aún no hay nodos.')
  const nodo = page.getByRole('button', { name: /^Abrir nodo / }).first()
  await expect(vacio.or(nodo)).toBeVisible()
  if (await vacio.isVisible()) {
    await expect(page.getByRole('link', { name: 'Centro de Dispositivos' })).toHaveAttribute('href', '/dispositivos')
  }
  await expect(page.getByText('feeds de ejemplo')).toHaveCount(0)
})

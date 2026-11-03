import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { iniciarSesionAdmin } from './helpers'

// Plan 2026-10-16-enlace-edge.md Tarea 12: la cadena completa en la laptop —
// web ← HTTP → gateway Python ← MQTT (Mosquitto local :1883) → ESP32 virtual.
// Solo con EDGE_E2E=1: necesita Mosquitto corriendo y el venv de edge/pi-gateway.

test.skip(!process.env.EDGE_E2E, 'EDGE_E2E=1 para correr la cadena edge completa')

const GATEWAY_DIR = path.join(__dirname, '..', 'edge', 'pi-gateway')
const PYTHON = path.join(GATEWAY_DIR, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
const PUERTO_PI = '18002'

function lanzar(args: string[], env: Record<string, string> = {}): ChildProcess {
  return spawn(PYTHON, args, { cwd: GATEWAY_DIR, env: { ...process.env, ...env }, stdio: 'ignore' })
}

test('cadena edge: nodo en línea, LED confirmado y desconexión por LWT', async ({ page }) => {
  test.setTimeout(120_000)
  const prisma = new PrismaClient()
  const nodeId = `node-${randomBytes(6).toString('hex')}`
  const nombrePi = `E2E cadena ${Date.now()}`
  const procesos: ChildProcess[] = []

  try {
    await iniciarSesionAdmin(page)
    await page.goto('/dispositivos')
    await page.getByRole('button', { name: 'Vincular Raspberry Pi' }).click()
    await page.getByLabel('Nombre de la Pi').fill(nombrePi)
    await page.getByLabel('Dirección de la Pi').fill(`http://127.0.0.1:${PUERTO_PI}`)
    await page.getByRole('button', { name: 'Generar token' }).click()
    const token = (await page.getByTestId('token-gateway').textContent())!.trim()

    procesos.push(
      lanzar(['-m', 'centinela_gateway'], {
        CENTINELA_WEB_URL: 'http://localhost:3000',
        CENTINELA_GATEWAY_TOKEN: token,
        PUERTO_API: PUERTO_PI,
        MQTT_HOST: '127.0.0.1',
        COLA_DB: path.join(tmpdir(), `cola-e2e-${Date.now()}.db`),
      }),
    )
    const nodo = lanzar(['-m', 'simulador.nodo_virtual', '--node-id', nodeId])
    procesos.push(nodo)

    await page.goto('/monitor')
    const tarjeta = page.getByRole('button', { name: new RegExp(`${nodeId}, estado En línea`) })
    await expect(tarjeta).toBeVisible({ timeout: 30_000 })

    await tarjeta.click()
    await page.getByRole('button', { name: 'Encender LED' }).click()
    await expect(page.getByText(/Confirmado \(\d+ ms\)/)).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')

    // Matar el proceso (no Ctrl+C) corta el socket sin DISCONNECT: el broker publica el LWT.
    nodo.kill()
    await expect(page.getByRole('button', { name: new RegExp(`${nodeId}, estado Desconectado`) })).toBeVisible({ timeout: 30_000 })
  } finally {
    for (const p of procesos) p.kill()
    const disp = await prisma.dispositivo.findUnique({ where: { nodeId } })
    if (disp) {
      await prisma.comandoDispositivo.deleteMany({ where: { dispositivoId: disp.id } })
      await prisma.notificacion.deleteMany({ where: { mensaje: { contains: nodeId } } })
      await prisma.reporte.deleteMany({ where: { titulo: { contains: nodeId } } })
      await prisma.dispositivo.delete({ where: { id: disp.id } })
    }
    await prisma.gateway.deleteMany({ where: { nombre: nombrePi } })
    await prisma.$disconnect()
  }
})

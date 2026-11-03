import { describe, expect, it } from 'vitest'
import { esClienteDeApp, esRutaConsola } from '@/lib/cliente-app'

const CHROME_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
const DESKTOP = `${CHROME_PC} QtWebEngine/6.8.1 CentinelaDesktop/0.2.0`
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'

describe('quién puede abrir la consola', () => {
  it('la app de escritorio y los teléfonos sí; un navegador de PC no', () => {
    expect(esClienteDeApp(DESKTOP)).toBe(true)
    expect(esClienteDeApp(IPHONE)).toBe(true)
    expect(esClienteDeApp(ANDROID)).toBe(true)
    expect(esClienteDeApp(CHROME_PC)).toBe(false)
    expect(esClienteDeApp(null)).toBe(false)
  })

  it('solo las rutas de la consola se restringen; la vitrina y la recuperación de contraseña no', () => {
    for (const r of ['/iniciar-sesion', '/dashboard', '/reportes/5', '/admin', '/monitor']) expect(esRutaConsola(r)).toBe(true)
    for (const r of ['/', '/soluciones', '/descargar', '/recuperar-contrasena', '/dashboardx', '/api/login']) {
      expect(esRutaConsola(r)).toBe(false)
    }
  })
})

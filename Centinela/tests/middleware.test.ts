import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

// Prioridad 2 (auditoría integral 26 ago, AUD2-15): único guard de rutas
// protegidas. A propósito solo verifica que exista una cookie "token" — la
// validez real del JWT y el Rol se verifican después, por página/API
// (17§4.1, 19§3.2). Estos tests fijan ese contrato explícitamente para que
// un cambio futuro que lo rompa se note aquí, no en producción.

// Por defecto la petición viene de la app de escritorio: la consola solo se abre desde ella o un teléfono.
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) QtWebEngine/6.8.1 CentinelaDesktop/0.2.0'
const UA_CHROME_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'

function request(pathname: string, token?: string, userAgent = UA_DESKTOP) {
  const headers = new Headers({ 'user-agent': userAgent })
  if (token !== undefined) headers.set('cookie', `token=${token}`)
  return new NextRequest(new URL(`http://localhost${pathname}`), { headers })
}

describe('middleware', () => {
  it.each(['/dashboard', '/admin', '/operador'])(
    'redirige a /iniciar-sesion si %s se visita sin cookie de token',
    (pathname) => {
      const res = middleware(request(pathname))
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/iniciar-sesion')
    }
  )

  it.each(['/dashboard/', '/admin/algo', '/operador/x'])(
    'también protege subrutas como %s',
    (pathname) => {
      const res = middleware(request(pathname))
      expect(res.status).toBe(307)
    }
  )

  it.each(['/dashboard', '/admin', '/operador'])(
    'deja pasar %s si existe una cookie de token (sin validar aquí si es válido)',
    (pathname) => {
      const res = middleware(request(pathname, 'cualquier-valor-incluso-invalido'))
      expect(res.headers.get('location')).toBeNull()
    }
  )

  it('protege /prototipo: sin cookie redirige, con cookie deja pasar', () => {
    expect(middleware(request('/prototipo')).status).toBe(307)
    expect(middleware(request('/prototipo/x')).status).toBe(307)
    expect(middleware(request('/prototipo', 'cualquier-valor')).headers.get('location')).toBeNull()
  })

  it('no bloquea rutas públicas sin token', () => {
    const res = middleware(request('/'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('no bloquea /iniciar-sesion sin token', () => {
    const res = middleware(request('/iniciar-sesion'))
    expect(res.headers.get('location')).toBeNull()
  })

  it.each(['/iniciar-sesion', '/dashboard', '/registrarse'])(
    'desde un navegador de PC, %s manda a /descargar aunque haya sesión',
    (pathname) => {
      const res = middleware(request(pathname, 'cualquier-valor', UA_CHROME_PC))
      expect(res.status).toBe(307)
      expect(res.headers.get('location')).toContain('/descargar')
    }
  )

  it('desde un navegador de PC, la vitrina y la recuperación de contraseña siguen abiertas', () => {
    for (const p of ['/', '/soluciones', '/descargar', '/recuperar-contrasena']) {
      expect(middleware(request(p, undefined, UA_CHROME_PC)).headers.get('location')).toBeNull()
    }
  })
})

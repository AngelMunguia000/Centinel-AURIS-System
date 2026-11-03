import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { esClienteDeApp, esRutaConsola } from './lib/cliente-app'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value

  // La consola solo se abre desde la app de escritorio o un teléfono; un navegador de PC va a /descargar.
  if (esRutaConsola(request.nextUrl.pathname) && !esClienteDeApp(request.headers.get('user-agent'))) {
    return NextResponse.redirect(new URL('/descargar', request.url))
  }

  // Rutas que requieren autenticación
  const protectedRoutes = ['/dashboard', '/reportes', '/admin', '/operador', '/bitacora', '/dispositivos', '/monitor', '/prototipo', '/vision']
  const { pathname } = request.nextUrl
  const isProtectedRoute = protectedRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/')
  )

  // Si es ruta protegida y no hay token, redirigir a login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/iniciar-sesion', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
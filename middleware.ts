import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Rutas completamente públicas
const PUBLIC_PATHS = [
  '/login',
  '/registro',
  '/recuperar',
  '/nueva-password',
  '/verificar',
  '/explorar',
  '/api/auth', // Crucial para NextAuth
  '/api/registro',
  '/api/recuperar',
  '/api/nueva-password',
  '/api/promos',
  '/api/categories',
  '/api/public',
  '/api/precios',
  '/api/internal',
  '/api/r',
  '/promos',
  '/api/admin/scrape',
  '/precios',
  '/favicon.ico',
]

// Rutas solo para ADMIN
const ADMIN_PATHS = ['/admin', '/api/admin']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Saltarse archivos estáticos y rutas internas de Next.js de forma explícita
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/static/') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg')
  ) {
    return NextResponse.next()
  }

  // 2. Comprobar si es la Home o una ruta pública explícita
  const isHomePage = pathname === '/'
  const isPublicRoute = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  
  if (isHomePage || isPublicRoute) {
    return NextResponse.next()
  }

  // 3. Obtener token para rutas protegidas
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // 4. No autenticado -> redirigir al login
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 5. Ruta de admin -> verificar rol
  const isAdminPath = ADMIN_PATHS.some(p => pathname.startsWith(p))
  if (isAdminPath) {
    const role = token.role as string | undefined
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      const homeUrl = new URL('/', req.url)
      homeUrl.searchParams.set('error', 'no-autorizado')
      return NextResponse.redirect(homeUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/public|favicon.ico).*)'], // Excluimos lo que sabemos que es 100% público para ahorrar ciclos
}
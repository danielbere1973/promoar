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
  '/api/search',
  '/api/categories',
  '/api/public',
  '/api/precios',
  '/api/internal',
  '/api/r',
  '/api/track',
  '/promos',
  '/precios',
  '/favicon.ico',
  '/sitemap.xml',
  '/sitemap',
  '/robots.txt',
  '/terminos',
  '/privacidad',
  '/contacto',
  '/quienes-somos',
  '/api/contacto',
  '/comercios',
  '/bancos',
  '/finanzas',
  '/api/finanzas',
  '/api/push',
  '/api/events',
  '/api/site-config',
  '/api/og',
]

// Rutas solo para ADMIN
const ADMIN_PATHS = ['/admin', '/api/admin']

// Crawlers de buscadores que sí queremos indexando el sitio (SEO), a diferir del
// resto de tráfico extranjero — estos no deben bloquearse pese a no ser de Argentina.
const ALLOWED_BOT_UA = /googlebot|bingbot|yandexbot|duckduckbot|applebot/i

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 1. Saltarse archivos estáticos y rutas internas de Next.js de forma explícita
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/static/') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next()
  }

  // 0. Restringir tráfico fuera de Argentina (reduce compute-hours de bots/scrapers
  // extranjeros que disparan queries a la DB en SSR) — excepto crawlers de buscadores
  // legítimos, que necesitamos para SEO, y las rutas de auth/estáticas ya filtradas arriba.
  if (!pathname.startsWith('/api/auth')) {
    const country = req.geo?.country ?? req.headers.get('x-vercel-ip-country')
    const userAgent = req.headers.get('user-agent') || ''
    const isAllowedBot = ALLOWED_BOT_UA.test(userAgent)
    if (country && country !== 'AR' && !isAllowedBot) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No disponible fuera de Argentina' }, { status: 403 })
      }
      return new NextResponse('No disponible fuera de Argentina', { status: 403 })
    }
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
}
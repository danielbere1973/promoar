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
// Bing/Yandex/DuckDuckGo se sacaron el 21/7/2026: aportan tráfico marginal en Argentina
// pero sus crawlers (IPs Microsoft/Azure datacenter) despertaban Neon en cada hit a
// /promos/[slug] y /comercios/[slug] con UA que el rate-limit clasificaba como humano.
const ALLOWED_BOT_UA = /googlebot|applebot/i

// ── INSTRUMENTACIÓN TEMPORAL RFC-003 (18-19/7/2026) ──────────────────────────
// Objetivo: medir distribución real de tráfico por ruta pública SSR antes de decidir
// dónde extender el cache de RFC-002. Solo logging, no cambia rate-limit ni caché ni
// lógica de negocio. Borrar este bloque (y su único console.log) una vez capturada
// la ventana de datos — no es instrumentación permanente.
// `likelyPrisma` es una heurística estática por prefijo de ruta (no una medición real:
// el middleware corre en Edge, antes del render, y no puede observar si la page terminó
// pegándole a Prisma) — sirve para separar de entrada rutas candidatas de las que no.
const TRAFFIC_DEBUG_PREFIXES = ['/promos/', '/comercios/', '/bancos/', '/precios', '/finanzas', '/api/promos', '/api/search']
function likelyPrisma(pathname: string): boolean {
  return pathname.startsWith('/promos/') || pathname.startsWith('/comercios/') || pathname.startsWith('/bancos/')
    || pathname.startsWith('/api/promos') || pathname.startsWith('/api/search')
}
// ──────────────────────────────────────────────────────────────────────────────

// Rate-limit en memoria por IP para rutas SSR pesadas (cada hit a un slug nuevo dispara
// una query a Neon). Best-effort: el Edge Runtime de Vercel puede tener múltiples instancias,
// así que esto no bloquea 100% un ataque distribuido, pero frena scrapers de una sola IP
// recorriendo el catálogo secuencialmente (caso real detectado 17/7/2026 — 2 IPs de AR
// haciendo ~2500 requests/día a /promos/[slug] y /comercios/[slug], manteniendo Neon sin
// idle toda la noche; luego se detectaron IPs adicionales con el mismo patrón el mismo día).
// Límite bajado a 15/min (de 40) tras confirmar cadencia de ~1 request/seg sostenida sin
// pausas — muy por encima de lo que genera un usuario navegando la grilla/detalle a mano.
const RATE_LIMITED_PREFIXES = ['/promos/', '/comercios/', '/api/promos', '/api/search']
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 15
const hitLog = new Map<string, number[]>()

// Googlebot rota IPs dentro de 66.249.64.0/19 (y rangos similares para otros bots
// permitidos) — el rate-limit por IP de arriba nunca lo frena porque cada IP individual
// se mantiene bajo el límite aunque el conjunto genere miles de hits/día a rutas SSR con
// Prisma (detectado 2/8/2026: ~17.8k requests de Google LLC en 24hs en Cloudflare, disparando
// consumo de Neon). Contador agregado (no por IP) solo para estas rutas pesadas: no bloquea
// indexación normal, pero evita que el crawl agregado de Google inunde la DB.
// Bajado de 60 a 20/min el 3/8/2026: 17.8k req/24h promedia ~12/min, pero el log de eventos
// mostró ráfagas sostenidas de ~1 req cada 2-4seg (15-30/min) — 60 dejaba pasar esas ráfagas
// completas sin cortar.
const GOOGLEBOT_RATE_LIMIT_WINDOW_MS = 60_000
const GOOGLEBOT_RATE_LIMIT_MAX = 20
let googlebotHits: number[] = []

function isGooglebotRateLimited(): boolean {
  const now = Date.now()
  googlebotHits = googlebotHits.filter(t => now - t < GOOGLEBOT_RATE_LIMIT_WINDOW_MS)
  googlebotHits.push(now)
  return googlebotHits.length > GOOGLEBOT_RATE_LIMIT_MAX
}

// User-Agents típicos de navegador real. Un cliente sin UA de navegador (script/curl/bot
// sin identificarse, salvo los bots de búsqueda ya permitidos arriba) pegando a estas rutas
// es en sí mismo una señal fuerte de scraping — se le aplica un límite mucho más estricto.
const BROWSER_UA = /mozilla|chrome|safari|firefox|edg\//i

function isRateLimited(ip: string, isLikelyBot: boolean): boolean {
  const now = Date.now()
  const max = isLikelyBot ? 5 : RATE_LIMIT_MAX
  const hits = (hitLog.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  hits.push(now)
  hitLog.set(ip, hits)
  // Poda ocasional para no crecer sin límite en memoria
  if (hitLog.size > 5000) {
    hitLog.forEach((times, key) => {
      if (times.every((t: number) => now - t > RATE_LIMIT_WINDOW_MS)) hitLog.delete(key)
    })
  }
  return hits.length > max
}

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

  // 1.4. INSTRUMENTACIÓN TEMPORAL RFC-003 — ver bloque de comentario arriba. Corre para
  // más rutas que el rate-limit (incluye /bancos/, que hoy no tiene ningún logging), y
  // nunca bloquea ni altera la request — solo observa.
  if (TRAFFIC_DEBUG_PREFIXES.some(p => pathname.startsWith(p))) {
    const ip =
      req.headers.get('x-real-ip') ??
      req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    const userAgent = req.headers.get('user-agent') || ''
    const uaShort = userAgent.slice(0, 60)
    const ipMasked = ip === 'unknown' ? 'unknown' : ip.split('.').slice(0, 3).join('.') + '.x'
    console.log(`[traffic-debug] path=${pathname} method=${req.method} ip=${ipMasked} ua="${uaShort}" prisma=${likelyPrisma(pathname)} ts=${Date.now()}`)
  }

  // 1.5. Rate-limit por IP en rutas SSR pesadas, antes de cualquier otra lógica
  if (RATE_LIMITED_PREFIXES.some(p => pathname.startsWith(p))) {
    const ip =
      req.headers.get('x-real-ip') ??
      req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    const userAgent = req.headers.get('user-agent') || ''
    const isLikelyBot = !BROWSER_UA.test(userAgent)
    const isAllowedBotUA = ALLOWED_BOT_UA.test(userAgent)
    const ipMaskedRL = ip === 'unknown' ? 'unknown' : ip.split('.').slice(0, 3).join('.') + '.x'
    console.log(`[rate-limit-debug] ip=${ipMaskedRL} bot=${isLikelyBot} path=${pathname} ua="${userAgent.slice(0, 60)}"`)
    if (isAllowedBotUA) {
      if (isGooglebotRateLimited()) {
        return new NextResponse('Too Many Requests', { status: 429 })
      }
    } else if (ip !== 'unknown' && isRateLimited(ip, isLikelyBot)) {
      return new NextResponse('Too Many Requests', { status: 429 })
    }
  }

  // 2. Comprobar si es la Home o una ruta pública explícita
  const isHomePage = pathname === '/'
  const isPublicRoute = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (isHomePage || isPublicRoute) {
    return NextResponse.next()
  }

  // 3. Obtener token para rutas protegidas
  // secureCookie explícito: getToken() por defecto lo deriva de si
  // NEXTAUTH_URL empieza con "https://", y NEXTAUTH_URL en Vercel quedó en
  // "http://localhost:3000" — sin esto busca la cookie sin prefijo __Secure-
  // y nunca encuentra la que sí setea authOptions (ver nota en lib/authOptions.ts).
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  })

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
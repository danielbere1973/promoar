import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { makeGetPromoBySlug, makeGetCommerceBySlug } from '@/lib/cache/detailFetchers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SECRET = process.env.VTEX_SESSION_SECRET
const MAX_SLUGS = 50
const CONCURRENCY = 5

// Mismo helper que /api/internal/revalidate — no se reinventa un segundo
// mecanismo de auth para un endpoint interno más.
function secretMatches(provided: string): boolean {
  if (!SECRET) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0
  async function next(): Promise<void> {
    const current = index++
    if (current >= items.length) return
    await worker(items[current])
    return next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()))
}

/**
 * ABANDONADO (22/11/2026) — ver CLAUDE.md, sección "Warm proactivo de
 * /api/internal/warm-detail — ABANDONADO". Escribir el caché desde este Route
 * Handler NO llena la entrada que lee la página — el motivo exacto vive en el
 * backend cerrado de Vercel y no se pudo confirmar desde el código. El botón
 * del admin y el workflow que disparaban una corrida masiva están
 * deshabilitados; esta ruta queda sin uso productivo, no borrada por si se
 * retoma la investigación con más información de Vercel.
 */
export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token || !secretMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  let type: 'promo' | 'comercio' | null = null
  let slugs: string[] = []
  try {
    const body = await request.json()
    type = body?.type === 'promo' || body?.type === 'comercio' ? body.type : null
    slugs = Array.isArray(body?.slugs) ? body.slugs.filter((s: unknown) => typeof s === 'string' && s.trim()) : []
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (!type) {
    return NextResponse.json({ error: 'type debe ser "promo" o "comercio"' }, { status: 400 })
  }
  if (slugs.length === 0) {
    return NextResponse.json({ error: 'slugs vacío' }, { status: 400 })
  }
  if (slugs.length > MAX_SLUGS) {
    return NextResponse.json({ error: `Máximo ${MAX_SLUGS} slugs por request (recibidos: ${slugs.length})` }, { status: 400 })
  }

  let warmed = 0
  let notFound = 0
  let errors = 0

  await runWithConcurrency(slugs, CONCURRENCY, async (slug) => {
    try {
      const result = type === 'promo'
        ? await makeGetPromoBySlug(slug)(slug)
        : await makeGetCommerceBySlug(slug)(slug)
      if (result) warmed++
      else notFound++
    } catch (error) {
      errors++
      console.error(`[warm-detail] error calentando ${type} ${slug}`, error)
    }
  })

  return NextResponse.json({
    ok: errors === 0,
    requested: slugs.length,
    warmed,
    notFound,
    errors,
    ms: Date.now() - start,
  })
}

/**
 * Lista los slugs a calentar (promos ACTIVE + comercios con al menos una
 * promo ACTIVE), misma auth que el POST. Pensada para que
 * scripts/warm-detail-cache.ts pida la lista por HTTP en vez de abrir una
 * conexión Prisma propia — así GitHub Actions (o cualquier runner fuera de
 * Vercel) nunca necesita DATABASE_URL como secret, solo el mismo Bearer que
 * ya usa para /api/internal/revalidate.
 *
 * Criterio de comercios (27/11/2026): antes se usaba `activePromoCount > 0`
 * (un contador denormalizado que puede desincronizarse — ver CLAUDE.md,
 * sección "Solapamiento..."/clasificación de cache-miss). Ahora usa el mismo
 * criterio EN VIVO que ya usa app/sitemap.ts para decidir si un comercio es
 * indexable: `promos: { some: { status: 'ACTIVE' } }`. Un comercio con el
 * contador en 0 pero con promos ACTIVE reales (visto en producción: 5 de 8
 * comercios auditados) ahora SÍ entra al universo de warm, igual que ya
 * entra al sitemap.
 *
 * GET /api/internal/warm-detail?type=promo|comercio&limit=N
 * Sin "type": devuelve { promoSlugs, commerceSlugs }. Con "type": solo esa lista
 * bajo la clave "slugs" (ambos formatos se devuelven igual para no romper nada
 * que ya exista).
 */
export async function GET(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token || !secretMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : undefined
  const take = Number.isFinite(limit) && limit! > 0 ? limit : undefined

  const wantPromos = type !== 'comercio'
  const wantCommerces = type !== 'promo'

  const [promos, commerces] = await Promise.all([
    wantPromos
      ? prisma.promo.findMany({
          where: { status: 'ACTIVE', slug: { not: null } },
          select: { slug: true },
          // id como desempate: sin esto, "updatedAt desc" solo no garantiza el
          // mismo orden (ni el mismo top-N con --limit) entre corridas cuando
          // hay timestamps iguales — necesario para que el test de Pablo
          // (warm --limit=20, abrir 2-3 de esa lista) sea reproducible.
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          take,
        })
      : Promise.resolve([]),
    wantCommerces
      ? prisma.commerce.findMany({
          where: { promos: { some: { status: 'ACTIVE' } } },
          select: { slug: true },
          // Mismo criterio que sitemap.ts, pero ese no necesita ordenar por
          // popularidad — acá sí, para que --limit tome los comercios más
          // relevantes primero (igual que antes con activePromoCount).
          orderBy: [{ activePromoCount: 'desc' }, { id: 'asc' }],
          take,
        })
      : Promise.resolve([]),
  ])

  const promoSlugs = promos.map(p => p.slug).filter((s): s is string => !!s)
  const commerceSlugs = commerces.map(c => c.slug).filter((s): s is string => !!s)

  if (type === 'promo') return NextResponse.json({ slugs: promoSlugs, promoSlugs, commerceSlugs: [] })
  if (type === 'comercio') return NextResponse.json({ slugs: commerceSlugs, promoSlugs: [], commerceSlugs })
  return NextResponse.json({ promoSlugs, commerceSlugs })
}

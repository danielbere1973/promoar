import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { makeGetPromoBySlug, makeGetCommerceBySlug } from '@/lib/cache/detailFetchers'

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
 * Llena el caché de detalle (/promos/[slug] y /comercios/[slug]) llamando,
 * desde adentro del runtime de Next, a las MISMAS funciones cacheadas
 * (makeGetPromoBySlug / makeGetCommerceBySlug, ver lib/cache/detailFetchers.ts)
 * que usan esas páginas — mismos keyParts, mismos tags, mismo revalidate. Así
 * la página encuentra un HIT real, no una entrada de caché distinta que nadie lee.
 *
 * Pensado para scripts/warm-detail-cache.ts (npm run warm:prod), que manda
 * tandas de hasta MAX_SLUGS slugs — no para ser llamado desde el navegador ni
 * sin auth. Ver CLAUDE.md: scrapers -> npm run revalidate:prod -> npm run warm:prod.
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

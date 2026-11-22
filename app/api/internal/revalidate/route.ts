import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'
import { invalidateCategoriesCache, invalidateEntitiesCache, invalidateSiteConfigCache } from '@/lib/cache/filtersCache'
import {
  invalidatePromoDetailCache,
  invalidateCommerceDetailCache,
  invalidateBankDetailCache,
  invalidatePromoDetailBySlugs,
  invalidateCommerceDetailBySlugs,
} from '@/lib/cache/detailCache'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

// Comparación en tiempo constante — timingSafeEqual requiere buffers del
// mismo largo, por eso se chequea el largo primero (devuelve false, no se
// comparan buffers de distinto tamaño) en vez de dejar que explote.
function secretMatches(provided: string): boolean {
  if (!SECRET) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(SECRET)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Para scripts sueltos (fuera de Next.js) que escriben directo en la DB de
 * producción — revalidateTag() no existe fuera del runtime de Next, así que
 * no hay otra forma de avisarle al caché que algo cambió. Ver npm run
 * revalidate:prod y la regla en CLAUDE.md.
 *
 * Sin body o con `{}`: invalida los tags gruesos (promos públicas,
 * categorías, entities, site-config, y el detalle de promos/comercios/bancos
 * de forma global). Con `{ promoSlugs, commerceSlugs }`: invalidación
 * puntual por slug además de la global de detalle (evita pagar la
 * invalidación global cuando se sabe exactamente qué cambió).
 */
export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

  if (!token || !secretMatches(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let promoSlugs: string[] = []
  let commerceSlugs: string[] = []
  try {
    const body = await request.json()
    promoSlugs = Array.isArray(body?.promoSlugs) ? body.promoSlugs : []
    commerceSlugs = Array.isArray(body?.commerceSlugs) ? body.commerceSlugs : []
  } catch {
    // sin body / body no-JSON -> invalidación global, como si no se hubiera pasado nada
  }

  await invalidatePublicPromosCache()
  invalidateCategoriesCache()
  invalidateEntitiesCache()
  invalidateSiteConfigCache()
  invalidateBankDetailCache()

  if (promoSlugs.length > 0) {
    invalidatePromoDetailBySlugs(promoSlugs)
  } else {
    invalidatePromoDetailCache()
  }

  if (commerceSlugs.length > 0) {
    invalidateCommerceDetailBySlugs(commerceSlugs)
  } else {
    invalidateCommerceDetailCache()
  }

  return NextResponse.json({
    ok: true,
    invalidated: {
      global: ['promos-public', 'categories-public', 'entities-public', 'site-config-public', 'bancos-detail'],
      promos: promoSlugs.length > 0 ? promoSlugs : 'global',
      commerces: commerceSlugs.length > 0 ? commerceSlugs : 'global',
    },
  })
}

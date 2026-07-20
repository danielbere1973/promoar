export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { CATEGORIES_PUBLIC_TAG } from '@/lib/cache/filtersCache'

const POPULAR_SLUGS = ['combustible', 'supermercados', 'hogar', 'indumentaria', 'transporte']

// Caso público (sin perfil): 1 agregación por categoría con el filtro de día
// resuelto en SQL (bitmask, no expresable en groupBy de Prisma) + 1 findMany
// de categorías — reemplaza el N+1 anterior (1 findMany completo por
// categoría, filtrado en JS después).
const getCategoriesCached = unstable_cache(
  async (dayBit: number) => {
    console.log(`[categories-cache] MISS — ejecutando queries reales (dayBit=${dayBit})`)
    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } })

    const totalRows = await prisma.promo.groupBy({
      by: ['categoryId'],
      where: {
        status: 'ACTIVE',
        validFrom: { lte: today },
        OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
      },
      _count: { _all: true },
    })
    const totalByCategory = new Map(totalRows.map(r => [r.categoryId, r._count._all]))

    const todayRows = await prisma.$queryRaw<{ categoryId: string; count: bigint }[]>`
      SELECT "categoryId", count(*)::bigint as count FROM "promos"
      WHERE status = 'ACTIVE'
        AND "validFrom" <= now()
        AND ("validUntil" IS NULL OR "validUntil" >= date_trunc('day', now()))
        AND ("validDays" & ${dayBit}) != 0
      GROUP BY "categoryId"
    `
    const todayByCategory = new Map(todayRows.map(r => [r.categoryId, Number(r.count)]))

    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      color: cat.color,
      order: cat.order,
      promoCount: todayByCategory.get(cat.id) ?? 0,
      totalCount: totalByCategory.get(cat.id) ?? 0,
      isPopular: POPULAR_SLUGS.includes(cat.slug),
    }))
  },
  ['public-categories'],
  { revalidate: 180, tags: [CATEGORIES_PUBLIC_TAG] },
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const forMe = searchParams.get('for_me') === 'true'
    const session = await getServerSession()
    const email = session?.user?.email || req.headers.get('x-user-email')

    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)
    // Servidor en UTC (Vercel) — ajustar a Argentina (UTC-3 fijo) para no adelantar el día
    const argNow = new Date(today.getTime() - 3 * 60 * 60 * 1000)
    const dayBit = 1 << argNow.getDay()

    let userCards: any[] = []
    if (forMe && email) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { financialProfile: { include: { cards: true } } }
      })
      userCards = user?.financialProfile?.cards || []
    }

    // Caso público (sin perfil aplicado): cacheado.
    if (!forMe || !email || userCards.length === 0) {
      const result = await getCategoriesCached(dayBit)
      return NextResponse.json({ categories: result })
    }

    // Caso personalizado (for_me=true con perfil real): depende del usuario,
    // no cacheable públicamente — mismo camino que ya existía antes de este cambio.
    const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } })

    const result = await Promise.all(
      categories.map(async (cat) => {
        const where: any = {
          categoryId: cat.id,
          status: 'ACTIVE',
          validFrom: { lte: today },
          OR: [
            { validUntil: null },
            { validUntil: { gte: startOfToday } },
          ],
          requirements: {
            some: {
              OR: userCards.map(c => ({
                AND: [
                  c.bankId ? { bankId: c.bankId } : { bankId: null },
                  c.walletId ? { walletId: c.walletId } : { walletId: null },
                  c.cardNetworkId ? { cardNetworkId: c.cardNetworkId } : {},
                  c.cardType ? { cardType: c.cardType } : {},
                ]
              }))
            }
          },
        }

        const promos = await prisma.promo.findMany({
          where,
          select: { validDays: true },
        })

        const todayCount = promos.filter(p => (p.validDays & dayBit) !== 0).length

        return {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
          color: cat.color,
          order: cat.order,
          promoCount: todayCount,
          totalCount: promos.length,
          isPopular: POPULAR_SLUGS.includes(cat.slug),
        }
      })
    )

    return NextResponse.json({ categories: result })
  } catch (error) {
    console.error('[GET /api/categories]', error)
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }
}

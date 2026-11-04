import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Ranking de "dónde entran" los usuarios: promos individuales más vistas
// (PROMO_VIEW, tiene promoId) y comercios más clickeados (COMMERCE_CLICK +
// PROMO_VIEW agregados por comercio, porque COMMERCE_CLICK solo tiene
// commerceName sin id/slug propio).
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days') ?? 14)))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [promoViews, commerceClicks] = await Promise.all([
    prisma.userEvent.findMany({
      where: { eventType: 'PROMO_VIEW', createdAt: { gte: since } },
      select: { payload: true },
    }),
    prisma.userEvent.findMany({
      where: { eventType: 'COMMERCE_CLICK', createdAt: { gte: since } },
      select: { payload: true },
    }),
  ])

  // --- Top promos individuales ---
  const promoCounts = new Map<string, number>()
  for (const ev of promoViews) {
    const payload = ev.payload as any
    const promoId = payload?.promoId
    if (!promoId) continue
    promoCounts.set(promoId, (promoCounts.get(promoId) ?? 0) + 1)
  }

  const topPromoIds = Array.from(promoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([id]) => id)

  const promos = await prisma.promo.findMany({
    where: { id: { in: topPromoIds } },
    select: {
      id: true,
      title: true,
      slug: true,
      commerce: { select: { name: true, slug: true, logoUrl: true } },
    },
  })
  const promoById = new Map(promos.map(p => [p.id, p]))

  const topPromos = topPromoIds
    .map(id => {
      const p = promoById.get(id)
      if (!p) return null
      return {
        promoId: id,
        title: p.title,
        slug: p.slug,
        commerceName: p.commerce.name,
        commerceSlug: p.commerce.slug,
        logoUrl: p.commerce.logoUrl,
        views: promoCounts.get(id) ?? 0,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  // --- Top comercios (combina COMMERCE_CLICK por nombre + PROMO_VIEW por nombre de comercio) ---
  const commerceCounts = new Map<string, number>()
  for (const ev of commerceClicks) {
    const name = (ev.payload as any)?.commerceName
    if (!name) continue
    commerceCounts.set(name, (commerceCounts.get(name) ?? 0) + 1)
  }
  for (const ev of promoViews) {
    const name = (ev.payload as any)?.commerceName
    if (!name) continue
    commerceCounts.set(name, (commerceCounts.get(name) ?? 0) + 1)
  }

  const topCommerceNames = Array.from(commerceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name]) => name)

  const commerces = await prisma.commerce.findMany({
    where: { name: { in: topCommerceNames } },
    select: { name: true, slug: true, logoUrl: true },
  })
  const commerceByName = new Map(commerces.map(c => [c.name, c]))

  const topCommerces = topCommerceNames.map(name => {
    const c = commerceByName.get(name)
    return {
      commerceName: name,
      slug: c?.slug ?? null,
      logoUrl: c?.logoUrl ?? null,
      clicks: commerceCounts.get(name) ?? 0,
    }
  })

  return NextResponse.json(
    { since: since.toISOString(), days, topPromos, topCommerces },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

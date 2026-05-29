import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token || token.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [total, bySource, byDay, topUrls, topPromos] = await Promise.all([
    prisma.promoClick.count(),

    prisma.promoClick.groupBy({
      by: ['source'],
      _count: true,
      orderBy: { _count: { source: 'desc' } },
    }),

    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as day, COUNT(*) as count
      FROM promo_clicks
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,

    prisma.promoClick.groupBy({
      by: ['url'],
      _count: true,
      orderBy: { _count: { url: 'desc' } },
      take: 10,
    }),

    prisma.promoClick.groupBy({
      by: ['promoId'],
      _count: true,
      where: { promoId: { not: null } },
      orderBy: { _count: { promoId: 'desc' } },
      take: 10,
    }),
  ])

  // Enriquecer top promos con nombre
  const promoIds = topPromos.map(p => p.promoId!).filter(Boolean)
  const promos = await prisma.promo.findMany({
    where: { id: { in: promoIds } },
    select: { id: true, title: true, commerce: { select: { name: true } } },
  })
  const promoMap = Object.fromEntries(promos.map(p => [p.id, p]))

  return NextResponse.json({
    total,
    bySource: bySource.map(s => ({ source: s.source, count: s._count })),
    byDay: byDay.map(d => ({ day: d.day, count: Number(d.count) })),
    topUrls: topUrls.map(u => ({ url: u.url, count: u._count })),
    topPromos: topPromos.map(p => ({
      promoId: p.promoId,
      count: p._count,
      title: promoMap[p.promoId!]?.title ?? 'Sin título',
      commerce: promoMap[p.promoId!]?.commerce?.name ?? '—',
    })),
  })
}

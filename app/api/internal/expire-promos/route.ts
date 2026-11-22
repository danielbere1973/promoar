import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'
import { invalidateCategoriesCache } from '@/lib/cache/filtersCache'
import { invalidatePromoDetailBySlugs, invalidateCommerceDetailBySlugs } from '@/lib/cache/detailCache'

export const dynamic = 'force-dynamic'

const SECRET = process.env.VTEX_SESSION_SECRET

export async function POST(request: Request) {
  const auth = request.headers.get('Authorization') || ''
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  // Único source de auto-expiración desde RFC-002 Fase 1 (antes también corría,
  // redundante, en cada GET público a /api/promos vía getPromosData).
  // Se busca primero (en vez de updateMany directo) para poder invalidar por
  // id/slug solo las promos que realmente vencieron, no el dominio completo.
  const toExpire = await prisma.promo.findMany({
    where: { status: 'ACTIVE', validUntil: { lt: startOfToday } },
    select: { id: true, slug: true, commerce: { select: { slug: true } } },
  })

  if (toExpire.length > 0) {
    await prisma.promo.updateMany({
      where: { id: { in: toExpire.map(p => p.id) } },
      data: { status: 'EXPIRED' },
    })

    await invalidatePublicPromosCache()
    invalidateCategoriesCache()
    invalidatePromoDetailBySlugs(toExpire.map(p => p.slug).filter((s): s is string => !!s))
    invalidateCommerceDetailBySlugs(Array.from(new Set(toExpire.map(p => p.commerce?.slug).filter((s): s is string => !!s))))
  }

  return NextResponse.json({ expired: toExpire.length })
}

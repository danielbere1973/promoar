export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'
import { invalidateCategoriesCache } from '@/lib/cache/filtersCache'
import {
  invalidatePromoDetailCache,
  invalidateCommerceDetailCache,
  invalidatePromoDetailBySlugs,
  invalidateCommerceDetailBySlugs,
} from '@/lib/cache/detailCache'

// Slugs de promo/comercio afectados por un `where` dado, leídos ANTES del
// deleteMany correspondiente — después de borrar las filas ya no se puede
// volver a consultar qué slugs tenían.
async function affectedSlugs(where: any) {
  const rows = await prisma.promo.findMany({ where, select: { slug: true, commerce: { select: { slug: true } } } })
  return {
    promoSlugs: rows.map(r => r.slug).filter((s): s is string => !!s),
    commerceSlugs: Array.from(new Set(rows.map(r => r.commerce?.slug).filter((s): s is string => !!s))),
  }
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken(req)
  if (!token || (token.role !== 'ADMIN' && token.role !== 'MODERATOR')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { tipo, commerceId, sourceUrl } = await req.json()

  let deleted = 0
  let promoSlugs: string[] = []
  let commerceSlugs: string[] = []
  // `tipo === 'all'` borra la tabla entera sin where — leer todos los slugs
  // antes de borrar sería técnicamente posible, pero equivale en costo a una
  // invalidación global (no hay riesgo de "wipe parcial" que evitar cuando se
  // borra todo). Se deja como invalidación global explícita, logueada.
  let isDeleteAll = false

  if (tipo === 'expired') {
    const where = { validUntil: { lt: new Date() } }
    ;({ promoSlugs, commerceSlugs } = await affectedSlugs(where))
    const result = await prisma.promo.deleteMany({ where })
    deleted = result.count

  } else if (tipo === 'by_commerce' && commerceId) {
    const where = { commerceId }
    ;({ promoSlugs, commerceSlugs } = await affectedSlugs(where))
    const result = await prisma.promo.deleteMany({ where })
    deleted = result.count

  } else if (tipo === 'by_source' && sourceUrl) {
    const where = { sourceUrl: { contains: sourceUrl } }
    ;({ promoSlugs, commerceSlugs } = await affectedSlugs(where))
    const result = await prisma.promo.deleteMany({ where })
    deleted = result.count

  } else if (tipo === 'all') {
    isDeleteAll = true
    const result = await prisma.promo.deleteMany({})
    deleted = result.count

  } else {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  if (deleted > 0) {
    await invalidatePublicPromosCache()
    invalidateCategoriesCache()
    if (isDeleteAll) {
      invalidatePromoDetailCache('POST /api/admin/cleanup (all)')
      invalidateCommerceDetailCache('POST /api/admin/cleanup (all)')
    } else {
      await invalidatePromoDetailBySlugs(promoSlugs, { alwaysBySlug: true, commerceSlugs, origin: `POST /api/admin/cleanup (${tipo})` })
      await invalidateCommerceDetailBySlugs(commerceSlugs, { alwaysBySlug: true, origin: `POST /api/admin/cleanup (${tipo})` })
    }
  }

  return NextResponse.json({ deleted })
}

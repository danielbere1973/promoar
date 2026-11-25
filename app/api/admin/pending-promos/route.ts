export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { invalidatePublicPromosCache } from '@/lib/cache/promosCache'
import { invalidateCategoriesCache } from '@/lib/cache/filtersCache'
import { invalidatePromoDetailBySlugs, invalidateCommerceDetailBySlugs } from '@/lib/cache/detailCache'

async function isAdmin() {
  const session = await getServerSession()
  if (!session?.user?.email) return false
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  return user?.role === 'ADMIN'
}

const promoInclude = {
  commerce: { select: { id: true, name: true, logoUrl: true } },
  category: { select: { id: true, name: true, icon: true } },
  requirements: {
    include: {
      bank: { select: { id: true, name: true } },
      wallet: { select: { id: true, name: true } },
      cardNetwork: { select: { id: true, name: true } },
      cardSegmentRef: { select: { id: true, name: true } },
    },
  },
}

// GET — listar promos en DRAFT con reporte completo
export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const promos = await prisma.promo.findMany({
    where: { status: 'DRAFT' },
    include: promoInclude,
    orderBy: [{ commerce: { name: 'asc' } }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ promos, total: promos.length })
}

// PATCH — aprobar o rechazar promos
export async function PATCH(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, action } = await req.json()
  if (!ids?.length || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  // Slugs ANTES de mutar — tras approve/reject ya no se puede volver a
  // consultar el estado previo (reject borra las filas).
  const affected = await prisma.promo.findMany({
    where: { id: { in: ids }, status: 'DRAFT' },
    select: { slug: true, commerce: { select: { slug: true } } },
  })
  const promoSlugs = affected.map(p => p.slug).filter((s): s is string => !!s)
  const commerceSlugs = Array.from(new Set(affected.map(p => p.commerce?.slug).filter((s): s is string => !!s)))

  if (action === 'approve') {
    await prisma.promo.updateMany({
      where: { id: { in: ids }, status: 'DRAFT' },
      data: { status: 'ACTIVE' },
    })
  } else {
    await prisma.promo.deleteMany({
      where: { id: { in: ids }, status: 'DRAFT' },
    })
  }

  await invalidatePublicPromosCache()
  invalidateCategoriesCache()
  invalidatePromoDetailBySlugs(promoSlugs, { alwaysBySlug: true, commerceSlugs, origin: 'PATCH /api/admin/pending-promos' })
  invalidateCommerceDetailBySlugs(commerceSlugs, { alwaysBySlug: true, origin: 'PATCH /api/admin/pending-promos' })
  return NextResponse.json({ ok: true, count: ids.length })
}

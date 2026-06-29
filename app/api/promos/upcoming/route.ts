export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const now = new Date()
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', validFrom: { gt: now } },
    include: {
      commerce: {
        select: {
          id: true, name: true, slug: true, logoUrl: true,
          _count: { select: { promos: { where: { status: 'ACTIVE' } } } },
        },
      },
      category: { select: { id: true, name: true, slug: true, icon: true } },
      requirements: {
        select: {
          id: true, discountType: true, discountValue: true,
          cap: true, capUnlimited: true, capPeriod: true,
          nxmN: true, nxmM: true, minPurchase: true,
          bankId: true, walletId: true, cardNetworkId: true, cardSegmentId: true,
          paymentChannel: true,
          bank:        { select: { name: true, logoUrl: true } },
          wallet:      { select: { name: true, logoUrl: true } },
          cardNetwork: { select: { name: true } },
        },
      },
    },
    orderBy: { validFrom: 'asc' },
    take: 30,
  })
  return NextResponse.json(promos)
}

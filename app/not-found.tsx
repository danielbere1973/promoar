import { prisma } from '@/lib/prisma'
import NotFoundClient from './NotFoundClient'

export const dynamic = 'force-dynamic'

export default async function NotFound() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      slug: true,
      title: true,
      validDays: true,
      validDaysNote: true,
      specificDates: true,
      salesChannel: true,
      geographicScope: true,
      provinces: true,
      validFrom: true,
      validUntil: true,
      categoryId: true,
      commerceId: true,
      isFeatured: true,
      commerceNote: true,
      validFromHour: true,
      validToHour: true,
      stackable: true,
      description: true,
      sourceUrl: true,
      sourceText: true,
      stackableNote: true,
      category: { select: { name: true, slug: true, icon: true, color: true } },
      commerce: { select: { id: true, name: true, slug: true, logoUrl: true } },
      requirements: {
        include: {
          bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
          wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
          cardNetwork: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: 6,
  })

  return <NotFoundClient promos={promos as any} />
}

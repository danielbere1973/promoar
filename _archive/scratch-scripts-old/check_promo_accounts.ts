import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const counts = await prisma.promoRequirement.groupBy({
    by: ['accountType'],
    _count: { promoId: true }
  })
  console.log('PROMO COUNTS BY ACCOUNT TYPE:', counts)

  const sample = await prisma.promoRequirement.findMany({
    where: { accountType: { not: 'ANY' } },
    include: { bank: { select: { name: true } }, promo: { select: { title: true } } },
    take: 5
  })
  console.log('SAMPLE PROMOS WITH SPECIAL ACCOUNT TYPE:', sample)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { prisma } from '../lib/prisma'

async function main() {
  const total = await prisma.promo.count({ where: { sourceUrl: { contains: 'favacard' } } })
  const sample = await prisma.promo.findFirst({
    where: { sourceUrl: { contains: 'favacard' } },
    select: { id: true, title: true, sourceUrl: true, status: true },
  })
  const wallet = await prisma.promoRequirement.findFirst({
    where: { wallet: { slug: 'favacard' } },
    include: { wallet: { select: { name: true } } },
  })
  console.log('Promos con sourceUrl favacard:', total)
  console.log('Muestra:', sample)
  console.log('Req con wallet Favacard:', wallet ? 'sí' : 'no')
  await prisma.$disconnect()
}
main().catch(console.error)

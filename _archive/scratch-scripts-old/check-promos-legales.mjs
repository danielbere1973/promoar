import { prisma } from '../lib/prisma.ts'

// Check sourceText for Coto/Jumbo/Disco promos in Supermercados category
const promos = await prisma.promo.findMany({
  where: {
    status: 'ACTIVE',
    commerce: { name: { in: ['Coto', 'Jumbo', 'Disco'] } },
  },
  include: { commerce: true },
  take: 6,
})

for (const p of promos) {
  console.log(`\n=== ${p.commerce.name} — ${p.title} ===`)
  console.log('sourceUrl:', p.sourceUrl)
  console.log('sourceText length:', p.sourceText?.length ?? 0)
  console.log('sourceText preview:', p.sourceText?.slice(0, 300) ?? '(vacío)')
}

await prisma.$disconnect()

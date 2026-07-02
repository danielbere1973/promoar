import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const galiciaPromos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'galicia' },
    },
    select: {
      id: true,
      title: true,
      commerceId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const groups = new Map<string, typeof galiciaPromos>()
  for (const p of galiciaPromos) {
    const key = `${p.title}|${p.commerceId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const dupeIds: string[] = []
  for (const group of groups.values()) {
    if (group.length > 1) {
      for (const p of group.slice(1)) dupeIds.push(p.id)
    }
  }

  console.log(`Eliminando ${dupeIds.length} promos duplicadas de Galicia...`)

  const { count } = await prisma.promo.deleteMany({
    where: { id: { in: dupeIds } },
  })

  console.log(`✅ Eliminadas: ${count}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

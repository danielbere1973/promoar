import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
const rows = await prisma.promo.groupBy({
  by: ['categoryId', 'commerceId'],
  where: { status: 'ACTIVE' },
  _count: { id: true }
})

const cats = await prisma.category.findMany({ select: { id: true, name: true } })
const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]))

const byCat: Record<string, { promos: number; coms: Set<string>; max: number }> = {}
for (const r of rows) {
  const cat = catMap[r.categoryId] ?? 'Sin Categoria'
  if (!byCat[cat]) byCat[cat] = { promos: 0, coms: new Set(), max: 0 }
  byCat[cat].promos += r._count.id
  byCat[cat].coms.add(r.commerceId)
  if (r._count.id > byCat[cat].max) byCat[cat].max = r._count.id
}

const sorted = Object.entries(byCat).sort((a, b) => b[1].promos - a[1].promos)
console.log('Categoria\t\t\tPromos\tComercios\tProm/Com\tMax 1 comercio')
console.log('---')
for (const [cat, d] of sorted) {
  const avg = (d.promos / d.coms.size).toFixed(1)
  console.log(`${cat.padEnd(24)}\t${d.promos}\t${d.coms.size}\t\t${avg}\t\t${d.max}`)
}

await prisma.$disconnect()
}
main().catch(console.error)

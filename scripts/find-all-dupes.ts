import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true, title: true, commerceId: true, createdAt: true, validDays: true, validFrom: true,
      commerce: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const groups = new Map<string, typeof promos>()
  for (const p of promos) {
    const key = `${p.title}|${p.commerceId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const dupeGroups = [...groups.values()].filter(g => g.length > 1)
  const dupeIds: string[] = []

  console.log(`\nTotal grupos duplicados ACTIVE: ${dupeGroups.length}`)
  console.log(`Total promos a eliminar (las más nuevas): ${dupeGroups.reduce((n, g) => n + g.length - 1, 0)}`)
  console.log('\nPrimeros 15 grupos:')
  for (const group of dupeGroups.slice(0, 15)) {
    console.log(`  [${group[0].commerce.name}] "${group[0].title}"`)
    for (const p of group) {
      const keep = p === group[0]
      console.log(`    ${keep ? '✅ KEEP' : '❌ DUPE'} validDays=${p.validDays} createdAt=${p.createdAt.toISOString().slice(0,10)}`)
      if (!keep) dupeIds.push(p.id)
    }
  }
  for (const group of dupeGroups.slice(15)) {
    for (const p of group.slice(1)) dupeIds.push(p.id)
  }
  console.log('\n(no se eliminó nada — solo diagnóstico)')
}

main().catch(console.error).finally(() => prisma.$disconnect())

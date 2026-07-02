import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Buscar promos ACTIVE de Galicia (sourceUrl contiene 'galicia')
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
      sourceUrl: true,
      commerce: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`\nTotal promos ACTIVE de Galicia: ${galiciaPromos.length}`)

  // Agrupar por (title, commerceId)
  const groups = new Map<string, typeof galiciaPromos>()
  for (const p of galiciaPromos) {
    const key = `${p.title}|${p.commerceId}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  }

  const dupeGroups = [...groups.values()].filter(g => g.length > 1)
  const dupeIds: string[] = []

  console.log(`\nGrupos duplicados: ${dupeGroups.length}`)
  console.log(`Promos a eliminar (las más nuevas): ${dupeGroups.reduce((n, g) => n + g.length - 1, 0)}`)

  if (dupeGroups.length > 0) {
    console.log('\nPrimeros 10 grupos duplicados:')
    for (const group of dupeGroups.slice(0, 10)) {
      console.log(`  [${group[0].commerce.name}] "${group[0].title}"`)
      for (const p of group) {
        const isOldest = p === group[0]
        console.log(`    ${isOldest ? '✅ KEEP' : '❌ DUPE'} id=${p.id} createdAt=${p.createdAt.toISOString()}`)
        if (!isOldest) dupeIds.push(p.id)
      }
    }
    // Recolectar TODOS los ids a eliminar
    for (const group of dupeGroups) {
      for (const p of group.slice(1)) {
        if (!dupeIds.includes(p.id)) dupeIds.push(p.id)
      }
    }
    console.log(`\nTotal IDs a eliminar: ${dupeIds.length}`)
    console.log('(no se eliminó nada — solo diagnóstico)')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

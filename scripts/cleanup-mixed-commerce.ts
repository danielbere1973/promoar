import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'galicia' } },
    select: {
      id: true, commerceId: true,
      requirements: { select: { discountType: true } },
    },
  })

  const byCommerce = new Map<string, typeof promos>()
  for (const p of promos) {
    if (!byCommerce.has(p.commerceId)) byCommerce.set(p.commerceId, [])
    byCommerce.get(p.commerceId)!.push(p)
  }

  const toDelete: string[] = []
  for (const [, group] of byCommerce) {
    const allTypes = new Set(group.flatMap(p => p.requirements.map(r => r.discountType)))
    const hasCSI = allTypes.has('CUOTAS_SIN_INTERES')
    const hasPct = allTypes.has('PERCENTAGE_DESCUENTO') || allTypes.has('PERCENTAGE_REINTEGRO')
    if (hasCSI && hasPct) {
      for (const p of group) toDelete.push(p.id)
    }
  }

  console.log(`Eliminando ${toDelete.length} promos de ${[...new Set(toDelete)].length} IDs únicos...`)

  let deleted = 0
  for (let i = 0; i < toDelete.length; i += 100) {
    const { count } = await prisma.promo.deleteMany({ where: { id: { in: toDelete.slice(i, i + 100) } } })
    deleted += count
  }
  console.log(`✅ Eliminadas: ${deleted}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

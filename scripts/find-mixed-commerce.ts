import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'galicia' } },
    select: {
      id: true, title: true, commerceId: true,
      commerce: { select: { name: true } },
      requirements: { select: { discountType: true } },
    },
  })

  // Agrupar por commerceId
  const byCommerce = new Map<string, typeof promos>()
  for (const p of promos) {
    if (!byCommerce.has(p.commerceId)) byCommerce.set(p.commerceId, [])
    byCommerce.get(p.commerceId)!.push(p)
  }

  const toDelete: string[] = []
  let commerceCount = 0

  for (const [, group] of byCommerce) {
    const allTypes = new Set(group.flatMap(p => p.requirements.map(r => r.discountType)))
    const hasCSI = allTypes.has('CUOTAS_SIN_INTERES')
    const hasPct = allTypes.has('PERCENTAGE_DESCUENTO') || allTypes.has('PERCENTAGE_REINTEGRO')
    if (hasCSI && hasPct) {
      commerceCount++
      for (const p of group) toDelete.push(p.id)
    }
  }

  console.log(`Comercios con CSI + PERCENTAGE (juntos o separados): ${commerceCount}`)
  console.log(`Promos a eliminar: ${toDelete.length}`)

  // Mostrar primeros 10 comercios
  let shown = 0
  for (const [, group] of byCommerce) {
    if (shown >= 10) break
    const allTypes = new Set(group.flatMap(p => p.requirements.map(r => r.discountType)))
    const hasCSI = allTypes.has('CUOTAS_SIN_INTERES')
    const hasPct = allTypes.has('PERCENTAGE_DESCUENTO') || allTypes.has('PERCENTAGE_REINTEGRO')
    if (hasCSI && hasPct) {
      console.log(`  [${group[0].commerce.name}] ${group.length} promos → ${[...allTypes].join(', ')}`)
      shown++
    }
  }
  console.log('\n(no se eliminó nada — solo diagnóstico)')
}

main().catch(console.error).finally(() => prisma.$disconnect())

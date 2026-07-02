import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'galicia' },
    },
    select: {
      id: true, title: true,
      commerce: { select: { name: true } },
      requirements: { select: { discountType: true } },
    },
  })

  const mixed = promos.filter(p => {
    const types = new Set(p.requirements.map(r => r.discountType))
    return types.has('CUOTAS_SIN_INTERES') && (types.has('PERCENTAGE_DESCUENTO') || types.has('PERCENTAGE_REINTEGRO'))
  })

  console.log(`Promos Galicia con CSI + PERCENTAGE mezclados: ${mixed.length}`)
  for (const p of mixed.slice(0, 15)) {
    const types = [...new Set(p.requirements.map(r => r.discountType))].join(', ')
    console.log(`  [${p.commerce.name}] "${p.title}" → ${types}`)
  }
  if (mixed.length > 15) console.log(`  ... y ${mixed.length - 15} más`)
  console.log('\n(no se eliminó nada — solo diagnóstico)')
}

main().catch(console.error).finally(() => prisma.$disconnect())

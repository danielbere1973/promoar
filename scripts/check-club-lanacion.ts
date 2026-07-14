import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Restaurar bankId=Supervielle a los requirements de Supervielle que quedaron sin banco
  const supervielle = await prisma.bank.findFirst({
    where: { name: { contains: 'Supervielle', mode: 'insensitive' } },
    select: { id: true, name: true }
  })
  if (!supervielle) { console.log('No se encontró Supervielle'); return }
  console.log('Supervielle:', supervielle.id)

  // Los requirements de Supervielle MODO que perdieron el bankId
  const superReqs = await prisma.promoRequirement.findMany({
    where: {
      accountType: 'JUBILADO',
      bankId: null,
      promo: { title: { contains: 'SUPERVIELLE', mode: 'insensitive' } }
    },
    select: { id: true, promo: { select: { title: true } } }
  })
  for (const r of superReqs) {
    await prisma.promoRequirement.update({
      where: { id: r.id },
      data: { bankId: supervielle.id, accountType: 'ANY' }
    })
    console.log(`✅ Restaurado Supervielle → "${r.promo.title}"`)
  }

  // También quitar JUBILADO de "JUBILADOS" (MP) - ese sí puede quedar sin banco pero con accountType correcto
  // Verificar el estado final
  const remaining = await prisma.promoRequirement.findMany({
    where: { accountType: 'JUBILADO', bankId: null },
    select: { promo: { select: { title: true } }, wallet: { select: { name: true } }, discountValue: true }
  })
  console.log(`\nJUBILADO sin banco (${remaining.length}) — estos son correctos:`)
  for (const r of remaining) {
    console.log(`  "${r.promo.title.slice(0, 60)}" wallet=${r.wallet?.name ?? 'ninguna'} ${r.discountValue}%`)
  }
}

main().finally(() => prisma.$disconnect())

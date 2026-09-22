import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const commerces = await prisma.commerce.findMany({
    where: { name: { contains: 'mcdonald', mode: 'insensitive' } },
  })
  console.log("Comercios McDonald's:", JSON.stringify(commerces, null, 2))

  if (commerces.length === 0) {
    console.log('--- No existe el comercio con ese nombre ---')
    const alias = await prisma.commerceAlias.findMany({
      where: { alias: { contains: 'mcdonald', mode: 'insensitive' } },
      include: { commerce: true },
    })
    console.log('Alias:', JSON.stringify(alias, null, 2))
  } else {
    for (const c of commerces) {
      const promos = await prisma.promo.findMany({
        where: { commerceId: c.id },
        include: { requirements: true },
      })
      console.log(`Promos de ${c.name} (status de cada una):`, promos.map(p => ({ id: p.id, title: p.title, status: p.status, validFrom: p.validFrom, validUntil: p.validUntil })))
    }
  }

  // Buscar promos de MercadoPago que mencionen McDonald's en título/descripción, por si el comercio quedó mal resuelto
  const mpWallet = await prisma.wallet.findFirst({ where: { name: { contains: 'Mercado Pago', mode: 'insensitive' } } })
  console.log('Wallet Mercado Pago:', mpWallet?.id, mpWallet?.name)
  if (mpWallet) {
    const reqs = await prisma.promoRequirement.findMany({
      where: { walletId: mpWallet.id },
      include: { promo: { include: { commerce: true } } },
    })
    const mcdonaldsLike = reqs.filter(r =>
      r.promo.title?.toLowerCase().includes('mcdonald') ||
      r.promo.description?.toLowerCase().includes('mcdonald') ||
      r.promo.commerce?.name?.toLowerCase().includes('mcdonald')
    )
    console.log('Promos MercadoPago que mencionan McDonald\'s:', JSON.stringify(mcdonaldsLike.map(r => ({
      promoId: r.promo.id, title: r.promo.title, status: r.promo.status, commerce: r.promo.commerce?.name,
    })), null, 2))
  }
}
main().finally(() => prisma.$disconnect())

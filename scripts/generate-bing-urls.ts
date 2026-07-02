import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const BASE = 'https://www.promoar.com.ar'

  // Estáticas
  console.log(BASE)
  console.log(`${BASE}/promos`)

  // Bancos y billeteras
  const banks = await prisma.bank.findMany({ where: { active: true }, select: { slug: true } })
  const wallets = await prisma.wallet.findMany({ where: { active: true }, select: { slug: true } })
  for (const e of [...banks, ...wallets]) console.log(`${BASE}/bancos/${e.slug}`)

  // Comercios con promos activas
  const commerces = await prisma.commerce.findMany({
    where: { active: true, promos: { some: { status: 'ACTIVE' } } },
    select: { slug: true },
  })
  for (const c of commerces) console.log(`${BASE}/comercios/${c.slug}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

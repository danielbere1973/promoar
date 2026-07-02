import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const BASE = 'https://www.promoar.com.ar'

  console.log(BASE)
  console.log(`${BASE}/promos`)

  const banks = await prisma.bank.findMany({
    where: { active: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  })
  const wallets = await prisma.wallet.findMany({
    where: { active: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  })

  for (const e of [...banks, ...wallets]) {
    console.log(`${BASE}/bancos/${e.slug}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

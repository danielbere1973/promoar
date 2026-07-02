import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const { count } = await prisma.promo.updateMany({
    where: { status: 'ACTIVE', validUntil: { lt: now, not: null } },
    data: { status: 'EXPIRED' },
  })
  console.log(`✅ Expiradas: ${count}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

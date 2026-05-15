import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.promo.count()
  console.log('Total promos in DB:', count)
}

main().catch(console.error).finally(() => { prisma.$disconnect() })

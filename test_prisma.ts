import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const wallets = await prisma.wallet.findFirst({ include: { cardNetworks: true } })
  console.log('Test wallet:', wallets)
}

main().catch(console.error).finally(() => { prisma.$disconnect() })

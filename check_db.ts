import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const banks = await prisma.bank.count()
  const wallets = await prisma.wallet.count()
  const networks = await prisma.cardNetwork.count()
  console.log({ banks, wallets, networks })
}

main().catch(console.error).finally(() => prisma.$disconnect())

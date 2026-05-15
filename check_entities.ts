import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const banks = await prisma.bank.findMany({ select: { name: true, active: true } })
  console.log('BANKS:', banks)
  const wallets = await prisma.wallet.findMany({ select: { name: true, active: true } })
  console.log('WALLETS:', wallets)
  const networks = await prisma.cardNetwork.findMany({ select: { name: true } })
  console.log('NETWORKS:', networks)
}

main().catch(console.error).finally(() => prisma.$disconnect())

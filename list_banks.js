const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const banks = await prisma.bank.findMany()
  console.log(JSON.stringify(banks, null, 2))
}

main().finally(() => prisma.$disconnect())

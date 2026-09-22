import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const segments = await prisma.bankSegment.findMany({ 
    where: { bank: { name: { in: ['Banco Galicia', 'BBVA', 'Banco Francés'], mode: 'insensitive' } } },
    include: { bank: { select: { name: true } } }
  })
  console.log('SEGMENTS:', segments.map(s => `${s.bank.name}: ${s.name}`))
}

main().catch(console.error).finally(() => prisma.$disconnect())

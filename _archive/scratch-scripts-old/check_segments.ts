import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const bankSegments = await prisma.bankSegment.findMany({ 
    where: { bank: { name: { in: ['Banco Galicia', 'BBVA', 'Banco Francés'], mode: 'insensitive' } } },
    include: { bank: { select: { name: true } } },
  })
  console.log('BANK SEGMENTS (sample):', bankSegments)

  try {
    const cardSegments = await (prisma as any).cardSegment.findMany({
      include: { cardNetwork: { select: { name: true } }, banks: { select: { name: true } } },
      take: 10
    })
    console.log('CARD SEGMENTS (sample):', cardSegments)
  } catch (e: any) {
    console.log('CardSegment table might not exist or error:', e.message)
  }
  
  const accountTypes = await prisma.financialAccountType.findMany()
  console.log('ACCOUNT TYPES:', accountTypes)
}

main().catch(console.error).finally(() => prisma.$disconnect())

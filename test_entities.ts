import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const [categories, commerces, banks, wallets, cardNetworks, segments, currencies, accountTypes] = await Promise.all([
      prisma.category.findMany({ orderBy: { order: 'asc' } }),
      prisma.commerce.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.bank.findMany({ 
        include: { segments: true, cardNetworks: true, cardSegments: true },
        orderBy: { name: 'asc' } 
      }),
      prisma.wallet.findMany({ 
        include: { cardNetworks: true },
        where: { active: true }, 
        orderBy: { name: 'asc' } 
      }),
      prisma.cardNetwork.findMany({ 
        include: { 
          banks: { select: { id: true, name: true } },
          wallets: { select: { id: true, name: true } }
        },
        orderBy: { name: 'asc' } 
      }),
      prisma.bankSegment.findMany({ 
        include: { bank: { select: { name: true } } },
        orderBy: { name: 'asc' } 
      }),
      prisma.currency.findMany({ orderBy: { code: 'asc' } }),
      prisma.financialAccountType.findMany({ orderBy: { name: 'asc' } }),
    ])
    console.log('SUCCESS')
  } catch (error) {
    console.error('ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()

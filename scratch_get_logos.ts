import { prisma } from './lib/prisma'

async function main() {
  const galicia = await prisma.bank.findFirst({ where: { name: { contains: 'Galicia', mode: 'insensitive' } } })
  const santander = await prisma.bank.findFirst({ where: { name: { contains: 'Santander', mode: 'insensitive' } } })
  const modo = await prisma.wallet.findFirst({ where: { name: { contains: 'MODO', mode: 'insensitive' } } })
  const coto = await prisma.commerce.findFirst({ where: { name: { contains: 'Coto', mode: 'insensitive' } } })
  const carrefour = await prisma.commerce.findFirst({ where: { name: { contains: 'Carrefour', mode: 'insensitive' } } })

  console.log('Galicia:', galicia?.logoUrl)
  console.log('Santander:', santander?.logoUrl)
  console.log('MODO:', modo?.logoUrl)
  console.log('Coto:', coto?.logoUrl)
  console.log('Carrefour:', carrefour?.logoUrl)
}

main().catch(console.error).finally(() => prisma.$disconnect())

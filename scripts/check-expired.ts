import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const now = new Date()
  const expired = await prisma.promo.findMany({
    where: { status: 'ACTIVE', validUntil: { lt: now, not: null } },
    select: { id: true, title: true, validUntil: true, commerce: { select: { name: true } } },
    orderBy: { validUntil: 'asc' },
  })
  console.log(`Promos ACTIVE vencidas: ${expired.length}`)
  for (const p of expired.slice(0, 20)) {
    console.log(`  [${p.commerce.name}] "${p.title}" — venció ${p.validUntil?.toISOString().slice(0,10)}`)
  }
  if (expired.length > 20) console.log(`  ... y ${expired.length - 20} más`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

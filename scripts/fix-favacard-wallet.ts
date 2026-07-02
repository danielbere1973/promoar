import { prisma } from '../lib/prisma'

async function main() {
  const w = await prisma.wallet.findUnique({
    where: { slug: 'favacard' },
    select: { id: true, name: true, active: true, logoUrl: true },
  })
  console.log('Antes:', w)

  if (w && !w.active) {
    await prisma.wallet.update({
      where: { slug: 'favacard' },
      data: { active: true },
    })
    console.log('→ activada')
  } else if (w?.active) {
    console.log('→ ya estaba activa')
  }

  await prisma.$disconnect()
}

main().catch(console.error)

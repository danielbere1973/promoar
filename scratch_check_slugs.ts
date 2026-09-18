import { prisma } from './lib/prisma'

async function main() {
  const coto = await prisma.commerce.findMany({ where: { name: { contains: 'Coto', mode: 'insensitive' } } })
  const carrefour = await prisma.commerce.findMany({ where: { name: { contains: 'Carrefour', mode: 'insensitive' } } })

  console.log('Coto:', coto.map(c => ({ name: c.name, slug: c.slug, id: c.id })))
  console.log('Carrefour:', carrefour.map(c => ({ name: c.name, slug: c.slug, id: c.id })))
}

main().catch(console.error).finally(() => prisma.$disconnect())

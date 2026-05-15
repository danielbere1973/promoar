const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const banks = [
    { name: 'Banco Galicia', slug: 'galicia', segments: ['Eminent', 'Prefer', 'Classic'] },
    { name: 'Banco Santander', slug: 'santander', segments: ['Select', 'Black', 'Platinum', 'Infinity'] },
    { name: 'Banco BBVA', slug: 'bbva', segments: ['Premium World', 'Premium', 'Libre'] },
    { name: 'Banco Macro', slug: 'macro', segments: ['Selecta', 'Macro Premium'] },
    { name: 'HSBC', slug: 'hsbc', segments: ['Premier', 'Advanced'] },
    { name: 'ICBC', slug: 'icbc', segments: ['Exclusive Banking', 'Premium'] },
    { name: 'Banco Ciudad', slug: 'ciudad', segments: ['Plan Sueldo', 'General'] },
    { name: 'Banco Nacion', slug: 'bna', segments: ['General'] },
    { name: 'Banco Provincia', slug: 'bapro', segments: ['General'] },
    { name: 'Banco Patagonia', slug: 'patagonia', segments: ['Patagonia Singular', 'Patagonia Plus'] },
    { name: 'Banco Supervielle', slug: 'supervielle', segments: ['Identité', 'Premium'] },
    { name: 'Banco Comafi', slug: 'comafi', segments: ['Comafi Único'] },
    { name: 'Banco Credicoop', slug: 'credicoop', segments: ['General'] },
  ]

  console.log('Seeding banks and segments...')

  for (const b of banks) {
    // Try to find by slug first as it's more stable in this DB
    const bank = await prisma.bank.upsert({
      where: { slug: b.slug },
      update: { name: b.name }, // Ensure name is correct
      create: {
        name: b.name,
        slug: b.slug,
        active: true
      }
    })

    console.log(`- Bank: ${bank.name}`)

    for (const sName of b.segments) {
      await prisma.bankSegment.upsert({
        where: { bankId_name: { bankId: bank.id, name: sName } },
        update: {},
        create: {
          name: sName,
          bankId: bank.id
        }
      })
      console.log(`  + Segment: ${sName}`)
    }
  }

  console.log('Seeding finished!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

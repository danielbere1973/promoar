/**
 * Fix script:
 * 1. Actualiza los nombres de categorías en la DB con tildes correctas
 * 2. Corrige el bitmask de la promo de Rappi (jue+vie = bits 4+5 = 48)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Corrigiendo categorías y bitmask...\n')

  // ─── 1. Nombres con tildes correctas ──────────────────────────
  const fixes = [
    { slug: 'gastronomia', name: 'Gastronomía' },
    { slug: 'tecnologia',  name: 'Tecnología' },
  ]

  for (const { slug, name } of fixes) {
    await prisma.category.update({
      where: { slug },
      data: { name },
    })
    console.log(`✓ Categoría actualizada: ${name}`)
  }

  // ─── 2. Bitmask de Rappi (jue=bit4 + vie=bit5 = 16 + 32 = 48) ─
  // Dom=0, Lun=1, Mar=2, Mié=3, Jue=4, Vie=5, Sáb=6
  // 1<<4 = 16 (Jue), 1<<5 = 32 (Vie), total = 48
  const JUEVES_VIERNES = (1 << 4) | (1 << 5) // = 48

  const rappi = await prisma.promo.findUnique({ where: { id: 'seed-promo-004' } })
  if (rappi) {
    console.log(`\nPromo Rappi actual validDays: ${rappi.validDays} (binario: ${rappi.validDays.toString(2)})`)
    await prisma.promo.update({
      where: { id: 'seed-promo-004' },
      data: { validDays: JUEVES_VIERNES },
    })
    console.log(`✓ Rappi bitmask corregido a ${JUEVES_VIERNES} (${JUEVES_VIERNES.toString(2).padStart(7, '0')})`)
    console.log('  Dom Lun Mar Mié Jue Vie Sáb')
    console.log('  ' + JUEVES_VIERNES.toString(2).padStart(7, '0').split('').reverse().join('   '))
  } else {
    console.log('⚠ No se encontró la promo de Rappi (seed-promo-004)')
  }

  console.log('\n✅ Fix completado!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

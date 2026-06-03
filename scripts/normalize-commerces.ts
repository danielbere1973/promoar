/**
 * Normaliza nombres de comercios en la DB:
 * 1. Corrige encoding roto (UTF-8 mojibake)
 * 2. Fusiona variantes bajo un nombre canónico
 * 3. Reasigna promos y sucursales al comercio canónico
 * 4. Elimina los duplicados
 *
 * Uso:
 *   npx tsx scripts/normalize-commerces.ts --dry-run   # ver cambios sin aplicar
 *   npx tsx scripts/normalize-commerces.ts             # aplicar cambios
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ── Correcciones de encoding (UTF-8 leído como Latin-1) ──────────────────────
const ENCODING_FIXES: Record<string, string> = {
  'CafÃ© MartÃ­nez':        'Café Martínez',
  'CafÃ© MartÃ­nez': 'Café Martínez',
  'PinturerÃ­as Colorshop': 'Pinturerías Colorshop',
  'CinÃ©polis':             'Cinépolis',
  'JugueterÃ­as Carrousel': 'Jugueterías Carrousel',
  'La AnÃ³nima con MODO':   'La Anónima con MODO',
  'AhorrÃ¡ en las Full YPF': 'Ahorrá en las Full YPF',
  'AhorrÃ¡ en las YPF Full': 'Ahorrá en las YPF Full',
  'LlegÃ³ el Especial Toledo': 'Llegó el Especial Toledo',
  'CARGÃ EN YPF CON CUENTA DNI': 'CARGÁ EN YPF CON CUENTA DNI',
  'HiperChangomás':    'HiperChangomas',
  'Supermercados Disco & Vea': 'Supermercados Disco & Vea', // ok
}

// ── Grupos de normalización ───────────────────────────────────────────────────
// canonical: nombre final (se crea si no existe)
// variants:  nombres a fusionar y eliminar
// keepVariants: variantes que se mantienen separadas (solo reasignar sucursales, no eliminar)

type MergeGroup = {
  canonical: string
  variants: string[]
}

const MERGE_GROUPS: MergeGroup[] = [
  // YPF — Full YPF (mercadito dentro de la estación) se mantiene separado
  {
    canonical: 'YPF',
    variants: [
      'App YPF',
      'CARGÁ EN YPF CON CUENTA DNI',
      'YPF Solar',
    ],
  },
  // Changomas
  {
    canonical: 'Changomas',
    variants: ['HIPER CHANGO MAS', 'HiperChangomas', 'SuperChangomas', 'HiperChangomás'],
  },
  // Vea — Disco y Vea se mantiene como promo combinada
  {
    canonical: 'Vea',
    variants: ['VEA.COM.AR', 'Vea - Jubilados', 'Vea con MODO'],
  },
  // Disco
  {
    canonical: 'Disco',
    variants: ['DISCO.COM.AR', 'Disco con MODO', 'Disco - Jubilados'],
  },
  // Toledo
  {
    canonical: 'Toledo',
    variants: [
      'Llegó el Especial Toledo',
      'LlegÃ³ el Especial Toledo',
      'No dejes pasar esta oportunidad en Toledo',
      'Supermercado Toledo',
      'Supermercados Toledo',
      'TOLEDO CTAS',
      'Toledo con MODO',
    ],
  },
  // Havanna
  {
    canonical: 'Havanna',
    variants: ['HAVANNA GOOGLE PAY APPLE PAY', 'Havanna San Nicolas', 'Havanna Tienda online'],
  },
  // Adidas
  {
    canonical: 'Adidas',
    variants: ['Adidas Factory Outlets con Visa', 'Adidas MDQ', 'Adidas.'],
  },
  // Nike
  {
    canonical: 'Nike',
    variants: ['Nike Mendoza', 'Nike.'],
  },
  // McDonald's
  {
    canonical: "McDonald's",
    variants: ['MC DONALDS GOOGLE PAY APPLE PAY', 'Mcdonalds', 'MC DONALD\'S'],
  },
  // Audi
  {
    canonical: 'Audi',
    variants: [], // las variantes tienen nombres distintos, revisar después
  },
  // Cinépolis (CINES MULTIPLEX es una cadena distinta — NO mergear)
  {
    canonical: 'Cinépolis',
    variants: ['CinÃ©polis', 'Cinepolis'],
  },
  // Café Martínez
  {
    canonical: 'Café Martínez',
    variants: ['CafÃ© MartÃ­nez', 'Cafe Martinez', 'Café Martinez'],
  },
  // Pinturerías Colorshop
  {
    canonical: 'Pinturerías Colorshop',
    variants: ['PinturerÃ­as Colorshop', 'Pinturerias Colorshop'],
  },
  // Jugueterías Carrousel
  {
    canonical: 'Jugueterías Carrousel',
    variants: ['JugueterÃ­as Carrousel', 'Jugaterias Carrousel', 'Carrousel'],
  },
  // La Anónima
  {
    canonical: 'La Anónima',
    variants: ['La AnÃ³nima con MODO', 'La Anonima con MODO', 'Supermercados La Anonima', 'Supermercados La Anónima'],
  },
  // Farmaplus
  {
    canonical: 'Farmaplus',
    variants: ['FarmaPlus Online', 'Farmaplus.Com.Ar'],
  },
  // Bonafide (uppercase → title case)
  {
    canonical: 'Bonafide',
    variants: ['BONAFIDE'],
  },
  // Megatone
  {
    canonical: 'Megatone',
    variants: ['MEGATONE'],
  },
  // Pirelli
  {
    canonical: 'Pirelli',
    variants: ['PIRELLI'],
  },
  // Norauto
  {
    canonical: 'Norauto',
    variants: ['NORAUTO'],
  },
  // Chungo → separar de "CHUNGO GOOGLE PAY APPLE PAY"
  {
    canonical: 'Chungo',
    variants: ['CHUNGO GOOGLE PAY APPLE PAY'],
  },
  // Fravega
  {
    canonical: 'Frávega',
    variants: ['Fravega', 'FrÃ¡vega'],
  },
]

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('⚠️  DRY RUN — sin cambios en DB\n')

  const allCommerces = await prisma.commerce.findMany({ select: { id: true, name: true, slug: true } })
  const byName = new Map(allCommerces.map(c => [c.name, c]))
  const byNorm = new Map(allCommerces.map(c => [normStr(c.name), c]))

  let totalMerged = 0
  let totalEncoding = 0

  // ── 1. Correcciones de encoding ──────────────────────────────────────────────
  console.log('═══ ENCODING FIXES ═══')
  for (const [broken, fixed] of Object.entries(ENCODING_FIXES)) {
    const commerce = byName.get(broken)
    if (!commerce) continue

    // Si ya existe uno con el nombre correcto, fusionar
    const existing = byName.get(fixed) ?? byNorm.get(normStr(fixed))
    if (existing && existing.id !== commerce.id) {
      console.log(`  MERGE encoding: "${broken}" → "${fixed}" (id: ${existing.id})`)
      if (!dryRun) {
        await prisma.promo.updateMany({ where: { commerceId: commerce.id }, data: { commerceId: existing.id } })
        await prisma.commerceBranch.updateMany({ where: { commerceId: commerce.id }, data: { commerceId: existing.id } })
        await prisma.commerce.delete({ where: { id: commerce.id } })
      }
    } else {
      console.log(`  RENAME encoding: "${broken}" → "${fixed}"`)
      if (!dryRun) {
        const slug = toSlug(fixed)
        await prisma.commerce.update({ where: { id: commerce.id }, data: { name: fixed, slug } })
        byName.set(fixed, { ...commerce, name: fixed, slug })
      }
    }
    totalEncoding++
  }

  // ── 2. Merges de variantes ────────────────────────────────────────────────────
  console.log('\n═══ MERGE GROUPS ═══')
  for (const group of MERGE_GROUPS) {
    if (group.variants.length === 0) continue

    // Buscar o crear el comercio canónico
    let canonical = byName.get(group.canonical) ?? byNorm.get(normStr(group.canonical))
    if (!canonical) {
      console.log(`  CREATE canonical: "${group.canonical}"`)
      if (!dryRun) {
        const slug = toSlug(group.canonical)
        canonical = await prisma.commerce.create({
          data: { name: group.canonical, slug, active: true },
        })
      } else {
        canonical = { id: 'DRY_RUN_ID', name: group.canonical, slug: toSlug(group.canonical) }
      }
    }

    for (const variantName of group.variants) {
      const variant = byName.get(variantName) ?? byNorm.get(normStr(variantName))
      if (!variant) {
        console.log(`  SKIP (not found): "${variantName}"`)
        continue
      }
      if (variant.id === canonical!.id) continue

      // Contar promos y sucursales
      const promoCount = await prisma.promo.count({ where: { commerceId: variant.id } })
      const branchCount = await prisma.commerceBranch.count({ where: { commerceId: variant.id } })

      console.log(`  MERGE: "${variantName}" → "${group.canonical}" (${promoCount} promos, ${branchCount} sucursales)`)

      if (!dryRun) {
        await prisma.promo.updateMany({ where: { commerceId: variant.id }, data: { commerceId: canonical!.id } })
        await prisma.commerceBranch.updateMany({ where: { commerceId: variant.id }, data: { commerceId: canonical!.id } })
        try {
          await prisma.commerce.delete({ where: { id: variant.id } })
        } catch (e: any) {
          console.log(`    ⚠️ No se pudo eliminar ${variantName}: ${e.message}`)
        }
      }
      totalMerged++
    }
  }

  console.log(`\n═══════════════════════`)
  console.log(`Encoding fixes: ${totalEncoding}`)
  console.log(`Merges:         ${totalMerged}`)
  if (dryRun) console.log('\n⚠️  DRY RUN — nada fue modificado. Corré sin --dry-run para aplicar.')

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

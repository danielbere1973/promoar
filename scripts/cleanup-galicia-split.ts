import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Promos Galicia ACTIVE con título en formato split (tiene "% descuento/reintegro" O "cuotas sin interés"
  // pero NO el formato combinado "% + N cuotas")
  const galiciaPromos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      sourceUrl: { contains: 'galicia' },
    },
    select: { id: true, title: true, commerce: { select: { name: true } } },
  })

  const splitPromos = galiciaPromos.filter(p => {
    const isCombined = p.title.includes(' + ') && p.title.includes('cuotas sin interés')
    const isSplitPct = !isCombined && /%\s*(descuento|reintegro)/i.test(p.title)
    const isSplitCSI = !isCombined && /\d+\s+cuotas?\s+sin\s+inter[eé]s/i.test(p.title)

    // Solo marcar como split si el comercio TAMBIÉN tiene la versión combinada en la DB
    return isSplitPct || isSplitCSI
  })

  // Para cada promo split, verificar si existe la versión combinada del mismo comercio
  const allTitles = new Set(galiciaPromos.map(p => p.title))
  const toDelete: string[] = []

  for (const p of splitPromos) {
    const storePart = p.title.split(' – ').slice(1).join(' – ')
    // Buscar si existe una promo combinada con ese storePart
    const hasCombined = [...allTitles].some(t =>
      t.includes(' + ') && t.includes('cuotas sin interés') && t.endsWith(` – ${storePart}`)
    )
    if (hasCombined) toDelete.push(p.id)
  }

  console.log(`Promos split con versión combinada disponible: ${toDelete.length}`)
  console.log(`Ejemplos:`)
  for (const p of splitPromos.filter(p => toDelete.includes(p.id)).slice(0, 10)) {
    console.log(`  ❌ [${p.commerce.name}] "${p.title}"`)
  }

  if (toDelete.length === 0) {
    console.log('Nada que limpiar.')
    return
  }

  const { count } = await prisma.promo.deleteMany({ where: { id: { in: toDelete } } })
  console.log(`\n✅ Eliminadas: ${count}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

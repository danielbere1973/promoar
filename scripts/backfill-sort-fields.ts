/**
 * Backfill de maxDiscountPct, isCSIOnly en Promo y activePromoCount en Commerce.
 * Correr una vez después de aplicar el schema con `npx prisma db push`.
 *
 * Uso:
 *   npx tsx scripts/backfill-sort-fields.ts
 *   npx tsx scripts/backfill-sort-fields.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 500

async function main() {
  console.log(DRY_RUN ? '[DRY RUN] ' : '', 'Backfill maxDiscountPct + isCSIOnly en Promo...')

  let offset = 0
  let total = 0

  while (true) {
    const promos = await prisma.promo.findMany({
      skip: offset,
      take: BATCH,
      select: {
        id: true,
        requirements: { select: { discountType: true, discountValue: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    if (promos.length === 0) break

    const updates = promos.map(promo => {
      const reqs = promo.requirements
      const pctReqs = reqs.filter(r =>
        r.discountType !== 'CUOTAS_SIN_INTERES' &&
        r.discountType !== 'NXM' &&
        (r.discountValue ?? 0) > 0
      )
      const maxDiscountPct = pctReqs.length > 0
        ? Math.round(Math.max(...pctReqs.map(r => r.discountValue ?? 0)))
        : null
      const isCSIOnly = pctReqs.length === 0
      return { id: promo.id, maxDiscountPct, isCSIOnly }
    })

    if (!DRY_RUN) {
      await Promise.all(updates.map(u =>
        prisma.promo.update({
          where: { id: u.id },
          data: { maxDiscountPct: u.maxDiscountPct, isCSIOnly: u.isCSIOnly }
        })
      ))
    } else {
      const sample = updates.slice(0, 3)
      console.log('  muestra:', sample)
    }

    total += promos.length
    offset += BATCH
    console.log(`  procesadas ${total} promos...`)
  }

  console.log(`Promos actualizadas: ${total}`)
  console.log('Actualizando activePromoCount en Commerce...')

  const commerces = await prisma.commerce.findMany({ select: { id: true } })
  let cTotal = 0

  for (const commerce of commerces) {
    const count = await prisma.promo.count({
      where: { commerceId: commerce.id, status: 'ACTIVE' }
    })
    if (!DRY_RUN) {
      await prisma.commerce.update({
        where: { id: commerce.id },
        data: { activePromoCount: count }
      })
    }
    cTotal++
    if (cTotal % 100 === 0) console.log(`  ${cTotal}/${commerces.length} comercios...`)
  }

  console.log(`Commerce actualizados: ${cTotal}`)
  console.log('Listo.')
}

main().catch(e => { console.error(e); process.exit(1) })

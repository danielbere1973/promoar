/**
 * Actualiza activePromoCount en todos los comercios con un solo query bulk.
 * Uso: npx tsx scripts/backfill-commerce-count.ts
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

async function main() {
  console.log('Actualizando activePromoCount con query bulk...')
  const result = await prisma.$executeRaw`
    UPDATE commerces
    SET "activePromoCount" = (
      SELECT COUNT(*) FROM promos
      WHERE promos."commerceId" = commerces.id AND promos.status = 'ACTIVE'
    )
  `
  console.log('Filas actualizadas:', result)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

/**
 * Puebla financial_match_index desde cero (todos los perfiles x todos los
 * requirements activos). Ver lib/financialMatchIndex.ts y financial-match-index.md.
 *
 * Uso:
 *   npx tsx scripts/rebuild-financial-match-index.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'
import { rebuildFullIndex } from '../lib/financialMatchIndex'

async function main() {
  console.log('Reconstruyendo financial_match_index...')
  const t0 = Date.now()
  const { profiles, rows } = await rebuildFullIndex()
  console.log(`Listo: ${profiles} perfiles, ${rows} filas, ${Date.now() - t0}ms`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

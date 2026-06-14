/**
 * Backfill de provincia/ciudad para CommerceBranch usando reverse geocoding (Nominatim).
 * Solo procesa registros con province IS NULL. Respeta rate limit de Nominatim (1 req/seg).
 *
 * Uso:
 *   npx tsx scripts/backfill-branch-provinces.ts              # todos los pendientes
 *   npx tsx scripts/backfill-branch-provinces.ts --limit 50   # solo los primeros 50
 *   npx tsx scripts/backfill-branch-provinces.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

async function reverseGeocode(lat: number, lng: number): Promise<{ province?: string; city?: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1&accept-language=es`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PromoAR/1.0 (contacto: danielbere@gmail.com)' },
  })
  if (!res.ok) return null
  const json: any = await res.json()
  const addr = json.address ?? {}
  const province = addr.state || addr.region || undefined
  const city = addr.city || addr.town || addr.village || addr.county || addr.suburb || undefined
  return { province, city }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined

  const branches = await prisma.commerceBranch.findMany({
    where: { province: null },
    select: { id: true, lat: true, lng: true, city: true },
    ...(limit ? { take: limit } : {}),
  })

  console.log(`${branches.length} sucursales sin provincia${limit ? ` (limit ${limit})` : ''}`)
  if (dryRun) console.log('DRY RUN — sin cambios en DB')

  let updated = 0, noResult = 0, failed = 0

  for (let i = 0; i < branches.length; i++) {
    const b = branches[i]
    try {
      const result = await reverseGeocode(b.lat, b.lng)
      if (!result?.province) {
        noResult++
      } else {
        if (!dryRun) {
          await prisma.commerceBranch.update({
            where: { id: b.id },
            data: {
              province: result.province,
              ...(b.city ? {} : result.city ? { city: result.city } : {}),
            },
          })
        }
        updated++
        if (dryRun && i < 10) console.log(`  ${b.id} → ${result.province} / ${result.city ?? '-'}`)
      }
    } catch (e: any) {
      console.error(`  error ${b.id}: ${e.message}`)
      failed++
    }

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${branches.length} — ok=${updated} sin resultado=${noResult} error=${failed}`)
    }

    // Nominatim usage policy: máx 1 req/seg
    await new Promise(r => setTimeout(r, 1100))
  }

  console.log(`\nTotal: ${branches.length} | actualizadas: ${updated} | sin resultado: ${noResult} | error: ${failed}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

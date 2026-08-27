/**
 * Carga sucursales de Pinturerías Rex a CommerceBranch.
 *
 * somosrex.com/stores (Magento, módulo SummaTheme_StorePickup) embebe en el HTML, dentro
 * de un <script type="text/x-magento-init">, un array initialStores con las sucursales del
 * país: { pickup_location_code, name, latitude, longitude, region, city, street, postcode,
 * phone, schedule_id }. Sin WAF — fetch directo al HTML y parseo del JSON embebido.
 * Nota: la URL documentada originalmente (/sucursales) ahora redirige (302) a /stores.
 *
 * Uso:
 *   npx tsx scripts/load-pinturerias-rex-branches.ts --dry-run
 *   npx tsx scripts/load-pinturerias-rex-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'PINTURERIAS_REX'
const PAGE_URL = 'https://somosrex.com/stores'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

type RawBranch = {
  pickup_location_code: string
  name: string
  latitude: number
  longitude: number
  region?: string
  city?: string
  street?: string
}

async function fetchBranches(): Promise<RawBranch[]> {
  const res = await fetch(PAGE_URL, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const html = await res.text()
  const idx = html.indexOf('initialStores')
  if (idx === -1) throw new Error('No se encontró initialStores en el HTML')
  const arrStart = html.indexOf('[', idx)
  let depth = 0
  let end = -1
  for (let i = arrStart; i < html.length; i++) {
    if (html[i] === '[') depth++
    else if (html[i] === ']') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (end === -1) throw new Error('No se pudo delimitar el array initialStores')
  return JSON.parse(html.slice(arrStart, end))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[DRY RUN] No se escribirá en la base de datos.\n')

  const commerce = await prisma.commerce.findFirst({
    where: { name: 'Pinturerías Rex' },
    select: { id: true, name: true },
  })
  if (!commerce) {
    console.error('No se encontró el comercio Pinturerías Rex.')
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)

  console.log('Fetching sucursales desde somosrex.com...')
  const raw = await fetchBranches()
  console.log(`Fetched: ${raw.length}`)

  if (raw.length < 40) {
    console.error(`⚠ Cantidad inesperadamente baja (${raw.length}). Se esperaban ~73. Abortando.`)
    process.exit(1)
  }

  const withCoords = raw.filter(b => Number.isFinite(b.latitude) && Number.isFinite(b.longitude))
  console.log(`Con lat/lng válidos: ${withCoords.length}`)

  const byRegion: Record<string, number> = {}
  for (const b of withCoords) byRegion[b.region ?? '?'] = (byRegion[b.region ?? '?'] ?? 0) + 1
  console.log(`Provincias cubiertas: ${Object.keys(byRegion).length}`)

  let inserted = 0, updated = 0, errors = 0

  if (!dryRun) {
    for (const b of withCoords) {
      const osmId = b.pickup_location_code
      try {
        const result = await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: { name: b.name, address: b.street, city: b.city, province: b.region, lat: b.latitude, lng: b.longitude },
          create: {
            commerceId: commerce.id, source: SOURCE, osmId,
            name: b.name, address: b.street, city: b.city, province: b.region,
            lat: b.latitude, lng: b.longitude,
          },
        })
        if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
        else updated++
      } catch (e) {
        console.error(`  Error en sucursal ${b.pickup_location_code} (${b.name}):`, e)
        errors++
      }
    }
  } else {
    const existingOsmIds = new Set(
      (await prisma.commerceBranch.findMany({ where: { commerceId: commerce.id, source: SOURCE }, select: { osmId: true } })).map(b => b.osmId)
    )
    for (const b of withCoords) {
      if (existingOsmIds.has(b.pickup_location_code)) updated++
      else inserted++
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Resumen: fetched=${raw.length} inserted=${inserted} updated=${updated} errors=${errors}`)
  if (!dryRun && errors === 0) {
    console.log(`✓ Pinturerías Rex cargado con ${inserted + updated} sucursales en ${Object.keys(byRegion).length} provincias.`)
  } else if (errors > 0) {
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

/**
 * Carga sucursales de Frávega a CommerceBranch.
 *
 * fravega.com/sucursales/ es Next.js; el <script id="__NEXT_DATA__"> embebe en el HTML
 * props.pageProps.branches, un array con las 109 sucursales del país, todas con lat/lng
 * (address.coordinates.latitude/longitude). Sin WAF — fetch directo al HTML + parseo del
 * JSON embebido, no requiere sesión de navegador ni geocoding.
 *
 * Uso:
 *   npx tsx scripts/load-fravega-branches.ts --dry-run
 *   npx tsx scripts/load-fravega-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'FRAVEGA'
const PAGE_URL = 'https://www.fravega.com/sucursales/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

type RawBranch = {
  id: string
  name: string
  enabled: boolean
  address: {
    coordinates: { latitude: number; longitude: number }
    postalCode?: string
    location: string
    street: string
  }
}

async function fetchBranches(): Promise<RawBranch[]> {
  const res = await fetch(PAGE_URL, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s)
  if (!m) throw new Error('No se encontró __NEXT_DATA__ en el HTML')
  const json = JSON.parse(m[1])
  const branches = json?.props?.pageProps?.branches
  if (!Array.isArray(branches)) throw new Error('branches no es un array en __NEXT_DATA__')
  return branches
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[DRY RUN] No se escribirá en la base de datos.\n')

  const commerce = await prisma.commerce.findFirst({
    where: { name: 'Frávega' },
    select: { id: true, name: true },
  })
  if (!commerce) {
    console.error('No se encontró el comercio Frávega.')
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)

  console.log('Fetching sucursales desde fravega.com...')
  const raw = await fetchBranches()
  console.log(`Fetched: ${raw.length}`)

  if (raw.length < 80) {
    console.error(`⚠ Cantidad inesperadamente baja (${raw.length}). Se esperaban ~109. Abortando.`)
    process.exit(1)
  }

  const withCoords = raw.filter(b =>
    b.enabled &&
    Number.isFinite(b.address?.coordinates?.latitude) &&
    Number.isFinite(b.address?.coordinates?.longitude)
  )
  console.log(`Habilitadas con lat/lng válidos: ${withCoords.length}`)

  const byLocation: Record<string, number> = {}
  for (const b of withCoords) byLocation[b.address.location] = (byLocation[b.address.location] ?? 0) + 1
  console.log(`Localidades cubiertas: ${Object.keys(byLocation).length}`)

  let inserted = 0, updated = 0, errors = 0

  if (!dryRun) {
    for (const b of withCoords) {
      const osmId = b.id
      try {
        const result = await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: {
            name: b.name,
            address: b.address.street,
            city: b.address.location,
            lat: b.address.coordinates.latitude,
            lng: b.address.coordinates.longitude,
          },
          create: {
            commerceId: commerce.id, source: SOURCE, osmId,
            name: b.name, address: b.address.street, city: b.address.location,
            lat: b.address.coordinates.latitude, lng: b.address.coordinates.longitude,
          },
        })
        if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
        else updated++
      } catch (e) {
        console.error(`  Error en sucursal ${b.id} (${b.name}):`, e)
        errors++
      }
    }
  } else {
    const existingOsmIds = new Set(
      (await prisma.commerceBranch.findMany({ where: { commerceId: commerce.id, source: SOURCE }, select: { osmId: true } })).map(b => b.osmId)
    )
    for (const b of withCoords) {
      if (existingOsmIds.has(b.id)) updated++
      else inserted++
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Resumen: fetched=${raw.length} inserted=${inserted} updated=${updated} errors=${errors}`)
  if (!dryRun && errors === 0) {
    console.log(`✓ Frávega cargado con ${inserted + updated} sucursales en ${Object.keys(byLocation).length} localidades.`)
  } else if (errors > 0) {
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

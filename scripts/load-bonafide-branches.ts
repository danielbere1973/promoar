/**
 * Carga sucursales de Bonafide a CommerceBranch.
 *
 * bonafide.com.ar/locales/ usa el plugin WordPress "WP Store Locator":
 *   GET /wp-admin/admin-ajax.php?action=store_search&lat={lat}&lng={lng}&max_results=500&search_radius=500&skip_cache=1
 * Devuelve locales con lat/lng, pero el plugin cappea siempre a 25 resultados sin importar
 * max_results/search_radius. Para cobertura nacional se consulta desde múltiples puntos
 * distribuidos por el país y se dedupea por id (mismo enfoque que load-bna-branches.ts).
 * Sin WAF, fetch directo.
 *
 * Uso:
 *   npx tsx scripts/load-bonafide-branches.ts --dry-run
 *   npx tsx scripts/load-bonafide-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'BONAFIDE'
const API_URL = 'https://bonafide.com.ar/wp-admin/admin-ajax.php'

// Puntos distribuidos por el país para cubrir distintas regiones (el plugin cappea a 25
// resultados por consulta, así que hacen falta múltiples puntos + dedupe por id).
const GEO_POINTS: Array<[number, number]> = [
  [-34.6037, -58.3816],   // CABA
  [-34.9214, -57.9544],   // La Plata
  [-38.0023, -57.5575],   // Mar del Plata
  [-31.4201, -64.1888],   // Córdoba
  [-32.9442, -60.6505],   // Rosario
  [-32.8908, -68.8272],   // Mendoza
  [-24.7821, -65.4232],   // Salta
  [-26.8083, -65.2176],   // Tucumán
  [-27.3621, -55.9008],   // Posadas
  [-27.4514, -58.9867],   // Resistencia
  [-38.7183, -62.2663],   // Bahía Blanca
  [-41.1335, -71.3103],   // Bariloche
  [-45.8641, -67.4966],   // Comodoro Rivadavia
  [-51.6230, -69.2168],   // Río Gallegos
  [-54.8019, -68.3030],   // Ushuaia
  [-29.4131, -66.8558],   // La Rioja
  [-31.5375, -68.5364],   // San Juan
  [-33.3017, -66.3378],   // San Luis
  [-28.4696, -65.7852],   // Catamarca
  [-27.7834, -64.2642],   // Santiago del Estero
]

type RawBranch = {
  id: string
  store: string
  address?: string
  city?: string
  state?: string
  lat: string
  lng: string
}

async function fetchNear(lat: number, lng: number): Promise<RawBranch[]> {
  const url = `${API_URL}?action=store_search&lat=${lat}&lng=${lng}&max_results=500&search_radius=500&skip_cache=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  return Array.isArray(body) ? body : []
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[DRY RUN] No se escribirá en la base de datos.\n')

  const commerce = await prisma.commerce.findFirst({
    where: { name: 'Bonafide' },
    select: { id: true, name: true },
  })
  if (!commerce) {
    console.error('No se encontró el comercio Bonafide.')
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)

  const byId = new Map<string, RawBranch>()
  for (const [lat, lng] of GEO_POINTS) {
    try {
      const branches = await fetchNear(lat, lng)
      for (const b of branches) byId.set(b.id, b)
      console.log(`  [${lat}, ${lng}] → ${branches.length} resultados (acumulado único: ${byId.size})`)
    } catch (e: any) {
      console.error(`  [${lat}, ${lng}] ERROR ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  const all = Array.from(byId.values())
  console.log(`\nTotal sucursales únicas: ${all.length}`)

  const withCoords = all.filter(b => Number.isFinite(parseFloat(b.lat)) && Number.isFinite(parseFloat(b.lng)))
  console.log(`Con lat/lng válidos: ${withCoords.length}`)

  const byProvince: Record<string, number> = {}
  for (const b of withCoords) byProvince[b.state || b.city || '?'] = (byProvince[b.state || b.city || '?'] ?? 0) + 1
  console.log(`Ciudades/provincias distintas: ${Object.keys(byProvince).length}`)

  let inserted = 0, updated = 0, errors = 0

  if (!dryRun) {
    for (const b of withCoords) {
      const osmId = b.id
      try {
        const result = await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: { name: b.store, address: b.address, city: b.city, province: b.state, lat: parseFloat(b.lat), lng: parseFloat(b.lng) },
          create: {
            commerceId: commerce.id, source: SOURCE, osmId,
            name: b.store, address: b.address, city: b.city, province: b.state,
            lat: parseFloat(b.lat), lng: parseFloat(b.lng),
          },
        })
        if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
        else updated++
      } catch (e) {
        console.error(`  Error en sucursal ${b.id} (${b.store}):`, e)
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

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Resumen: total=${withCoords.length} inserted=${inserted} updated=${updated} errors=${errors}`)
  if (!dryRun && errors === 0) {
    console.log(`✓ Bonafide cargado con ${inserted + updated} sucursales.`)
  } else if (errors > 0) {
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

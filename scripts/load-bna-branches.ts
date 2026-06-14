/**
 * Carga sucursales de Banco Nación (Semana Nación) a CommerceBranch.
 *
 * El sitio semananacion.com.ar consulta, para el buscador de sucursales cercanas:
 *   GET https://backend.activx.production.digiventures.la/api/points/
 *     ?bank=bna-semananacion&checkValidity=true&status=active
 *     &search={merchant}&select=merchant+locationData.province+locationData.city
 *       +locationData.address+location.coordinates+campaign
 *     &lat={lat}&lng={lng}&distance=10000000
 * Devuelve siempre los 5 puntos más cercanos al lat/lng dado (no pagina con
 * skip/limit) con locationData (province/city/address) y location.coordinates
 * ([lng, lat]) listos — sin geocoding ni WAF (fetch directo funciona).
 *
 * Para cubrir el país, se consulta desde varios puntos (capitales de provincia
 * representativas) y se deduplican resultados por distancia. Se filtran resultados
 * cuyo `merchant` no coincide razonablemente con el nombre del comercio (la búsqueda
 * es texto libre y puede traer falsos positivos, ej. "modo" matchea "Comodoro").
 *
 * Uso:
 *   npx tsx scripts/load-bna-branches.ts
 *   npx tsx scripts/load-bna-branches.ts --limit 20
 *   npx tsx scripts/load-bna-branches.ts --commerce cetrogar
 *   npx tsx scripts/load-bna-branches.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const API_BASE = 'https://backend.activx.production.digiventures.la/api'
const PAGE_URL = 'https://semananacion.com.ar/semananacion'
const SOURCE = 'BNA'
const SELECT = 'merchant+locationData.province+locationData.city+locationData.address+location.coordinates+campaign'

// Puntos de referencia distribuidos por el país para cubrir distintas regiones
// (la API devuelve solo los 5 más cercanos a cada punto).
const GEO_POINTS: Array<[number, number]> = [
  [-34.6037, -58.3816],   // CABA
  [-31.4201, -64.1888],   // Córdoba
  [-32.9442, -60.6505],   // Rosario
  [-32.8908, -68.8272],   // Mendoza
  [-24.7821, -65.4232],   // Salta
  [-38.7183, -62.2663],   // Bahía Blanca
  [-27.3621, -55.9008],   // Posadas
  [-45.8641, -67.4966],   // Comodoro Rivadavia
  [-38.0023, -57.5575],   // Mar del Plata
  [-27.4514, -58.9867],   // Resistencia
]

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// "Farmalife con MODO" → "Farmalife", "www.simplicity.com.ar" → "simplicity"
function cleanCommerceName(name: string): string {
  let n = name
    .replace(/\s*\(?con\s+modo\)?\s*$/i, '')
    .replace(/^www\./i, '')
    .replace(/\.(com|com\.ar|net|net\.ar)$/i, '')
    .trim()
  return n
}

function matches(commerceName: string, merchant: string): boolean {
  const a = normalize(commerceName)
  const b = normalize(merchant)
  if (a.length < 3 || b.length < 3) return false
  return a.includes(b) || b.includes(a)
}

type Point = {
  merchant?: string
  locationData?: { province?: string; city?: string; address?: string }
  location?: { coordinates?: [number, number] }
}

async function searchPoints(name: string, lat: number, lng: number): Promise<Point[]> {
  const qs = `bank=bna-semananacion&checkValidity=true&status=active&search=${encodeURIComponent(name)}&select=${SELECT}&lat=${lat}&lng=${lng}&distance=10000000`
  const res = await fetch(`${API_BASE}/points/?${qs}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: PAGE_URL },
  })
  if (!res.ok) return []
  const json = await res.json().catch(() => null)
  return Array.isArray(json) ? json : []
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1]?.toLowerCase() : undefined

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', requirements: { some: { bank: { name: 'Banco Nación' } } } },
    select: { commerce: { select: { id: true, name: true } } },
    distinct: ['commerceId'],
  })

  let targets = promos.map(p => ({ commerceId: p.commerce.id, commerceName: p.commerce.name }))
  if (commerceFilter) targets = targets.filter(t => t.commerceName.toLowerCase().includes(commerceFilter))
  if (limit) targets = targets.slice(0, limit)

  console.log(`${targets.length} comercios a procesar${dryRun ? ' (DRY RUN)' : ''}`)

  let totalNew = 0, totalDup = 0, totalSkipped = 0, withBranches = 0, processed = 0

  for (const t of targets) {
    try {
      const searchName = cleanCommerceName(t.commerceName)
      if (searchName.length < 3) { processed++; totalSkipped++; continue }

      const found = new Map<string, Point>()
      for (const [lat, lng] of GEO_POINTS) {
        const points = await searchPoints(searchName, lat, lng)
        for (const p of points) {
          const coords = p.location?.coordinates
          if (!coords || coords.length !== 2) continue
          if (!p.merchant || !matches(searchName, p.merchant)) continue
          const key = `${coords[1].toFixed(5)},${coords[0].toFixed(5)}`
          if (!found.has(key)) found.set(key, p)
        }
        await new Promise(r => setTimeout(r, 150))
      }

      if (found.size === 0) { processed++; continue }

      const existing = await prisma.commerceBranch.findMany({
        where: { commerceId: t.commerceId },
        select: { lat: true, lng: true },
      })

      let added = 0, dup = 0
      for (const p of found.values()) {
        const [lng, lat] = p.location!.coordinates!
        const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, lat, lng) < 0.1)
        if (isDuplicate) { dup++; continue }

        const osmId = `${lat.toFixed(5)},${lng.toFixed(5)}_${t.commerceId}`
        const loc = p.locationData ?? {}
        if (!dryRun) {
          await prisma.commerceBranch.upsert({
            where: { source_osmId: { source: SOURCE, osmId } },
            update: { address: loc.address, city: loc.city, province: loc.province, lat, lng },
            create: { commerceId: t.commerceId, source: SOURCE, osmId, lat, lng, address: loc.address, city: loc.city, province: loc.province },
          })
        }
        existing.push({ lat, lng })
        added++
      }

      totalNew += added
      totalDup += dup
      if (added + dup > 0) withBranches++
      console.log(`  ${t.commerceName.padEnd(35)} → ${found.size} candidatos, ${added} nuevas, ${dup} ya existían`)
    } catch (e: any) {
      console.error(`  ${t.commerceName}: ERROR ${e.message}`)
    }

    processed++
    if (processed % 50 === 0) console.log(`  ── progreso: ${processed}/${targets.length} ──`)
  }

  console.log(`\nTotal: ${processed} comercios | con sucursales: ${withBranches} | nuevas: ${totalNew} | ya existían: ${totalDup} | sin nombre útil: ${totalSkipped}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

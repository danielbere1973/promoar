/**
 * Carga sucursales de Banco Nación (Semana Nación) a CommerceBranch — v2, bulk.
 *
 * A diferencia de load-bna-branches.ts (que busca por nombre de comercio, 5 puntos
 * más cercanos por vez, solo para comercios que ya tienen promo activa en nuestra DB),
 * esta versión trae el catálogo completo expuesto por la API en una sola pasada:
 *
 *   GET /api/promotions/distinct/campaign/?bank=bna-semananacion&checkValidity=true
 *     -> lista de campañas activas (188 al momento de escribir esto)
 *
 *   GET /api/points/?bank=bna-semananacion&checkValidity=true&status=active
 *     &select=merchant+campaign+location.coordinates+locationData
 *     &lat={cualquiera}&lng={cualquiera}&distance=10000000&limit=50000&skip={N}
 *     &campaigns=+{campaña1}+{campaña2}+...
 *
 * Confirmado por prueba manual: distance/lat/lng no filtran nada country-wide (dan
 * el mismo total con radios de 20km a 10.000.000km) — lo que realmente determina el
 * resultado es la lista de campañas. El backend cappea cada respuesta a ~4000
 * elementos pase lo que pase en `limit`, así que hay que paginar con `skip` hasta
 * que devuelva un array vacío. Total real verificado: 4037 puntos, 1312 comercios
 * únicos, todos con lat/lng.
 *
 * Esto NO reemplaza a load-bna-branches.ts (que sigue siendo válido), pero cubre
 * comercios que aparecen en el catálogo de BNA aunque hoy no tengan ninguna promo
 * BNA cargada en nuestra DB, y evita el fuzzy-match por nombre 10 veces por comercio.
 *
 * Uso:
 *   npx tsx scripts/load-bna-branches-v2.ts --dry-run
 *   npx tsx scripts/load-bna-branches-v2.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const API_BASE = 'https://backend.activx.production.digiventures.la/api'
const PAGE_URL = 'https://semananacion.com.ar/semananacion'
const SOURCE = 'BNA'
const SELECT = 'merchant+campaign+location.coordinates+locationData'
const ANY_LAT = -34.603722
const ANY_LNG = -58.381592
const PAGE_SIZE = 50000

type Point = {
  merchant?: string
  locationData?: { province?: string; city?: string; address?: string; postalCode?: string }
  location?: { coordinates?: [number, number] }
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function cleanCommerceName(name: string): string {
  return name
    .replace(/\s*\(?con\s+modo\)?\s*$/i, '')
    .replace(/^www\./i, '')
    .replace(/\.(com|com\.ar|net|net\.ar)$/i, '')
    .trim()
}

function matches(commerceName: string, merchant: string): boolean {
  const a = normalize(commerceName)
  const b = normalize(merchant)
  if (a.length < 3 || b.length < 3) return false
  return a.includes(b) || b.includes(a)
}

async function fetchCampaigns(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/promotions/distinct/campaign/?bank=bna-semananacion&checkValidity=true`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: PAGE_URL },
  })
  if (!res.ok) throw new Error(`campaigns fetch failed: ${res.status}`)
  const json = await res.json()
  return Array.isArray(json) ? json.map((c: string) => c.trim()).filter(Boolean) : []
}

async function fetchAllPoints(campaigns: string[]): Promise<Point[]> {
  const campaignsParam = campaigns.map(encodeURIComponent).join('+')
  const all: Point[] = []
  let skip = 0
  while (true) {
    const url = `${API_BASE}/points/?bank=bna-semananacion&checkValidity=true&status=active&select=${SELECT}&lat=${ANY_LAT}&lng=${ANY_LNG}&distance=10000000&limit=${PAGE_SIZE}&skip=${skip}&campaigns=+${campaignsParam}`
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0', Referer: PAGE_URL } })
    if (!res.ok) throw new Error(`points fetch failed at skip=${skip}: ${res.status}`)
    const json = await res.json().catch(() => null)
    const page: Point[] = Array.isArray(json) ? json : []
    if (page.length === 0) break
    all.push(...page)
    skip += page.length
    await new Promise(r => setTimeout(r, 200))
  }
  return all
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('Bajando lista de campañas activas...')
  const campaigns = await fetchCampaigns()
  console.log(`${campaigns.length} campañas`)

  console.log('Bajando catálogo completo de puntos...')
  const points = await fetchAllPoints(campaigns)
  console.log(`${points.length} puntos totales`)

  const validPoints = points.filter(p => p.merchant && p.location?.coordinates?.length === 2)
  const merchantNames = [...new Set(validPoints.map(p => p.merchant!))]
  console.log(`${validPoints.length} puntos con merchant+coordenadas, ${merchantNames.length} comercios únicos en el catálogo BNA`)

  const commerces = await prisma.commerce.findMany({ select: { id: true, name: true } })

  let totalNew = 0, totalDup = 0, matchedCommerces = 0, unmatchedMerchants = 0

  for (const commerce of commerces) {
    const searchName = cleanCommerceName(commerce.name)
    if (searchName.length < 3) continue

    const merchantPoints = validPoints.filter(p => matches(searchName, p.merchant!))
    if (merchantPoints.length === 0) continue

    const existing = await prisma.commerceBranch.findMany({
      where: { commerceId: commerce.id },
      select: { lat: true, lng: true },
    })

    let added = 0, dup = 0
    for (const p of merchantPoints) {
      const [lng, lat] = p.location!.coordinates!
      const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, lat, lng) < 0.1)
      if (isDuplicate) { dup++; continue }

      const osmId = `${lat.toFixed(5)},${lng.toFixed(5)}_${commerce.id}`
      const loc = p.locationData ?? {}
      if (!dryRun) {
        await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: { address: loc.address, city: loc.city, province: loc.province, lat, lng },
          create: { commerceId: commerce.id, source: SOURCE, osmId, lat, lng, address: loc.address, city: loc.city, province: loc.province },
        })
      }
      existing.push({ lat, lng })
      added++
    }

    totalNew += added
    totalDup += dup
    if (added + dup > 0) {
      matchedCommerces++
      console.log(`  ${commerce.name.padEnd(35)} → ${merchantPoints.length} candidatos, ${added} nuevas, ${dup} ya existían`)
    }
  }

  const matchedMerchantNames = new Set<string>()
  for (const commerce of commerces) {
    const searchName = cleanCommerceName(commerce.name)
    for (const m of merchantNames) if (matches(searchName, m)) matchedMerchantNames.add(m)
  }
  unmatchedMerchants = merchantNames.length - matchedMerchantNames.size

  console.log(`\nTotal: ${matchedCommerces} comercios matcheados | ${totalNew} sucursales nuevas | ${totalDup} ya existían`)
  console.log(`Comercios del catálogo BNA sin match en nuestra DB: ${unmatchedMerchants} (no tienen Commerce creado)`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

/**
 * Carga sucursales de Banco Santander a CommerceBranch.
 *
 * Para cada comercio con al menos una promo ACTIVA de Santander, extrae brandId/idPromotion
 * del sourceUrl ("...#b{brandId}_p{idPromotion}"). El endpoint de sucursales necesita
 * `item.id` (publicationId), que NO es `idPromotion` — hay que resolverlo primero con:
 *   GET https://www.santander.com.ar/bff-benefits/brands/{brandId}
 * (busca el item con idPromotion == p, toma su `id`), y luego:
 *   GET https://www.santander.com.ar/bff-benefits/publications/{programId}?brandId={brandId}
 * → { brands: [{ id, brand: {...}, establishments: [...] }] }
 * Cada establishment: { address, city, province, fantasyName, latitude, longitude }.
 * `address`/`city`/`province` siempre vienen completos, pero `latitude`/`longitude` son
 * frecuentemente null. Esta primera pasada solo guarda los que ya tienen coordenadas
 * (CommerceBranch.lat/lng son obligatorios) — los sin coordenadas se loguean para un
 * backfill de geocoding directo (Nominatim forward) en un script separado.
 *
 * Requiere WAF bypass con headless:false (igual que lib/scrapers/santander.ts) — con
 * context.request directo el request queda colgado sin responder.
 *
 * Uso:
 *   npx tsx scripts/load-santander-branches.ts
 *   npx tsx scripts/load-santander-branches.ts --limit 20
 *   npx tsx scripts/load-santander-branches.ts --commerce mostaza
 *   npx tsx scripts/load-santander-branches.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'
import { chromium } from 'playwright'

const PAGE_URL = 'https://www.santander.com.ar/personas/beneficios#/results?category-code=SUP'
const BFF_BASE = 'https://www.santander.com.ar/bff-benefits'
const SOURCE = 'Santander'

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type Establishment = {
  address?: string; city?: string; province?: string
  latitude?: number | string | null; longitude?: number | string | null
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1]?.toLowerCase() : undefined

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'santander.com.ar' } },
    select: { commerceId: true, sourceUrl: true, commerce: { select: { id: true, name: true } } },
    distinct: ['commerceId'],
  })

  let targets = promos.map(p => {
    const m = p.sourceUrl!.match(/#b(\d+)_p(\d+)$/)
    return m ? { commerceId: p.commerce.id, commerceName: p.commerce.name, brandId: m[1], idPromotion: m[2] } : null
  }).filter((t): t is NonNullable<typeof t> => t !== null)

  if (commerceFilter) targets = targets.filter(t => t.commerceName.toLowerCase().includes(commerceFilter))
  if (limit) targets = targets.slice(0, limit)

  console.log(`${targets.length} comercios a procesar${dryRun ? ' (DRY RUN)' : ''}`)

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox', '--start-maximized'] })

  let totalNew = 0, totalDup = 0, totalNoCoords = 0, totalErr = 0, withBranches = 0, processed = 0

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: null,
      locale: 'es-AR',
    })

    let bffHeaders: Record<string, string> = {}
    const page = await context.newPage()
    page.on('request', (req) => {
      if (req.url().includes('bff-benefits')) bffHeaders = req.headers()
    })

    console.log('[Santander] Cargando página para capturar sesión/headers...')
    try {
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 40000 })
    } catch { }
    try {
      await page.waitForRequest(req => req.url().includes('bff-benefits'), { timeout: 15000 })
      console.log('[Santander] Headers capturados.')
    } catch {
      console.log('[Santander] Timeout esperando request al BFF, seguimos con lo que haya.')
    }
    await page.waitForTimeout(2000)

    for (const t of targets) {
      try {
        // Resolver publicationId (item.id) a partir de idPromotion via /brands/{brandId}
        const brandRes = await context.request.get(`${BFF_BASE}/brands/${t.brandId}`, {
          headers: { ...bffHeaders, Accept: 'application/json', Referer: PAGE_URL }, timeout: 15000,
        })
        if (!brandRes.ok()) {
          processed++
          await new Promise(r => setTimeout(r, 300))
          continue
        }
        const brandJson = await brandRes.json()
        const items: any[] = brandJson?.items ?? []
        const item = items.find(i => String(i.idPromotion) === t.idPromotion)
        if (!item) {
          processed++
          await new Promise(r => setTimeout(r, 300))
          continue
        }
        const programId = item.id

        const res = await context.request.get(
          `${BFF_BASE}/publications/${programId}?brandId=${t.brandId}`,
          { headers: { ...bffHeaders, Accept: 'application/json', Referer: PAGE_URL }, timeout: 15000 }
        )
        if (!res.ok()) {
          processed++
          await new Promise(r => setTimeout(r, 300))
          continue
        }
        const json = await res.json()
        const brands: any[] = json?.brands ?? []
        const brandEntry = brands.find(b => String(b.id) === String(t.brandId)) ?? brands[0]
        const establishments: Establishment[] = brandEntry?.establishments ?? []

        if (establishments.length === 0) {
          processed++
          await new Promise(r => setTimeout(r, 300))
          continue
        }

        const withCoords = establishments.filter(e => {
          const lat = typeof e.latitude === 'string' ? parseFloat(e.latitude) : e.latitude
          const lng = typeof e.longitude === 'string' ? parseFloat(e.longitude) : e.longitude
          return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)
        })
        const noCoords = establishments.length - withCoords.length

        const existing = await prisma.commerceBranch.findMany({
          where: { commerceId: t.commerceId },
          select: { lat: true, lng: true },
        })

        let added = 0, dup = 0
        for (const e of withCoords) {
          const lat = typeof e.latitude === 'string' ? parseFloat(e.latitude) : (e.latitude as number)
          const lng = typeof e.longitude === 'string' ? parseFloat(e.longitude) : (e.longitude as number)
          const isDuplicate = existing.some(ex => distanceKm(ex.lat, ex.lng, lat, lng) < 0.1)
          if (isDuplicate) { dup++; continue }

          const osmId = `${lat.toFixed(5)},${lng.toFixed(5)}_${t.commerceId}`
          if (!dryRun) {
            await prisma.commerceBranch.upsert({
              where: { source_osmId: { source: SOURCE, osmId } },
              update: { address: e.address, city: e.city, province: e.province, lat, lng },
              create: { commerceId: t.commerceId, source: SOURCE, osmId, lat, lng, address: e.address, city: e.city, province: e.province },
            })
          }
          existing.push({ lat, lng })
          added++
        }

        totalNew += added
        totalDup += dup
        totalNoCoords += noCoords
        if (added + dup > 0) withBranches++
        console.log(`  ${t.commerceName.padEnd(35)} → ${establishments.length} locales, ${added} nuevas, ${dup} ya existían, ${noCoords} sin coords`)
      } catch (e: any) {
        totalErr++
        console.error(`  ${t.commerceName}: ERROR ${e.message}`)
      }

      processed++
      if (processed % 50 === 0) console.log(`  ── progreso: ${processed}/${targets.length} ──`)
      await new Promise(r => setTimeout(r, 300))
    }
  } finally {
    await browser.close()
  }

  console.log(`\nTotal: ${processed} comercios | con sucursales: ${withBranches} | nuevas: ${totalNew} | ya existían: ${totalDup} | sin coords (no cargadas): ${totalNoCoords} | errores: ${totalErr}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

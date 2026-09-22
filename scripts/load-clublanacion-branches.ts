/**
 * Carga sucursales de Club La Nación a CommerceBranch.
 *
 * Para cada comercio con al menos una promo ACTIVA de Club La Nación (wallet "Club La
 * Nacion"), extrae el crmid (ej. "A05876994") del sourceUrl y consulta:
 *   GET https://api-clubv2.lanacion.com.ar/v2/accounts/{crmid}/branches?page={n}
 * Devuelve { data: [...], meta: { total } }, paginado fijo de 8 por página. Cada sucursal
 * trae geolocation.lat/lon (strings) y address/city/state ya separados — no requiere
 * geocoding ni parseo. Sin WAF, fetch directo.
 *
 * Uso:
 *   npx tsx scripts/load-clublanacion-branches.ts                # todos los comercios pendientes
 *   npx tsx scripts/load-clublanacion-branches.ts --limit 20
 *   npx tsx scripts/load-clublanacion-branches.ts --commerce carrefour
 *   npx tsx scripts/load-clublanacion-branches.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'ClubLaNacion'
const API_BASE = 'https://api-clubv2.lanacion.com.ar/v2/accounts'

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function extractCrmid(sourceUrl: string): string | null {
  const m = sourceUrl.match(/-([A-Z]\d+)(?:\/)?$/)
  return m ? m[1] : null
}

type ClubBranch = {
  lat: number
  lng: number
  address?: string
  city?: string
  province?: string
}

async function fetchBranches(crmid: string): Promise<ClubBranch[]> {
  const branches: ClubBranch[] = []
  let page = 1
  let total = Infinity

  while ((page - 1) * 8 < total) {
    const res = await fetch(`${API_BASE}/${crmid}/branches?page=${page}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) break
    const json: any = await res.json()
    total = json?.meta?.total ?? 0
    const data = json?.data ?? []
    if (data.length === 0) break

    for (const b of data) {
      const lat = parseFloat(b?.geolocation?.lat)
      const lng = parseFloat(b?.geolocation?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const streetAddr = [b.address, b.number].filter(Boolean).join(' ') || undefined
      branches.push({ lat, lng, address: streetAddr, city: b.city, province: b.state })
    }

    page++
    await new Promise(r => setTimeout(r, 250))
  }

  return branches
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1]?.toLowerCase() : undefined

  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      requirements: { some: { wallet: { name: 'Club La Nacion' } } },
    },
    select: { commerceId: true, sourceUrl: true, commerce: { select: { id: true, name: true } } },
    distinct: ['commerceId'],
  })

  let targets = promos
    .map(p => ({
      commerceId: p.commerce.id,
      commerceName: p.commerce.name,
      crmid: p.sourceUrl ? extractCrmid(p.sourceUrl) : null,
    }))
    .filter((t): t is { commerceId: string; commerceName: string; crmid: string } => !!t.crmid)

  if (commerceFilter) {
    targets = targets.filter(t => t.commerceName.toLowerCase().includes(commerceFilter))
  }
  if (limit) targets = targets.slice(0, limit)

  console.log(`${targets.length} comercios a procesar${dryRun ? ' (DRY RUN)' : ''}`)

  let totalNew = 0, totalDup = 0, totalErr = 0, processed = 0

  for (const t of targets) {
    try {
      const branches = await fetchBranches(t.crmid)
      if (branches.length === 0) {
        processed++
        continue
      }

      const existing = await prisma.commerceBranch.findMany({
        where: { commerceId: t.commerceId },
        select: { lat: true, lng: true },
      })

      let added = 0, dup = 0
      for (const b of branches) {
        const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, b.lat, b.lng) < 0.1)
        if (isDuplicate) { dup++; continue }

        const osmId = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}_${t.commerceId}`

        if (!dryRun) {
          await prisma.commerceBranch.upsert({
            where: { source_osmId: { source: SOURCE, osmId } },
            update: { address: b.address, city: b.city, province: b.province, lat: b.lat, lng: b.lng },
            create: {
              commerceId: t.commerceId,
              source: SOURCE,
              osmId,
              lat: b.lat,
              lng: b.lng,
              address: b.address,
              city: b.city,
              province: b.province,
            },
          })
        }
        existing.push({ lat: b.lat, lng: b.lng })
        added++
      }

      totalNew += added
      totalDup += dup
      console.log(`  ${t.commerceName.padEnd(35)} → ${branches.length} sucursales, ${added} nuevas, ${dup} ya existían`)
    } catch (e: any) {
      totalErr++
      console.error(`  ${t.commerceName}: ERROR ${e.message}`)
    }

    processed++
    if (processed % 50 === 0) console.log(`  ── progreso: ${processed}/${targets.length} ──`)

    await new Promise(r => setTimeout(r, 300))
  }

  console.log(`\nTotal: ${processed} comercios | nuevas sucursales: ${totalNew} | ya existían: ${totalDup} | errores: ${totalErr}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

/**
 * Carga sucursales de Banco Ciudad a CommerceBranch.
 *
 * Para cada comercio con al menos una promo ACTIVA de Banco Ciudad, usa el id de esa
 * promo para consultar POST /beneficios_rest/beneficios/{id} (con coords dummy) —
 * la respuesta trae `retorno.sucursales_cercanas` = TODAS las sucursales del comercio
 * a nivel país, con lat/lng. No requiere WAF/Playwright.
 *
 * Uso:
 *   npx tsx scripts/load-bancociudad-branches.ts                # todos los comercios pendientes
 *   npx tsx scripts/load-bancociudad-branches.ts --limit 20
 *   npx tsx scripts/load-bancociudad-branches.ts --commerce coto
 *   npx tsx scripts/load-bancociudad-branches.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'BancoCiudad'

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// "Junin 1073, Barrio Norte, Barrio Norte" → { address: "Junin 1073", city: "Barrio Norte" }
// El formato de "localidad" varía mucho por comercio (barrio, ciudad, o repetido) y no es
// confiable para derivar provincia — eso lo completa el backfill de Nominatim (lat/lng).
function parseDireccion(direccion: string): { address?: string; city?: string } {
  const parts = direccion.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return {}
  return { address: parts[0] || undefined, city: parts[1] || undefined }
}

async function fetchBranches(promoId: string): Promise<Array<{ lat: number; lng: number; direccion: string }>> {
  const res = await fetch(`https://www.bancociudad.com.ar/beneficios_rest/beneficios/${promoId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { latitud: -34.6, longitud: -58.4 }, header: {} }),
  })
  if (!res.ok) return []
  const json: any = await res.json()
  const sucursales = json?.retorno?.sucursales_cercanas ?? []
  return sucursales
    .filter((s: any) => typeof s.latitud === 'number' && typeof s.longitud === 'number')
    .map((s: any) => ({ lat: s.latitud, lng: s.longitud, direccion: s.direccion ?? '' }))
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1]?.toLowerCase() : undefined

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'bancociudad.com.ar/beneficios/detalle/' } },
    select: { commerceId: true, sourceUrl: true, commerce: { select: { id: true, name: true } } },
    distinct: ['commerceId'],
  })

  let targets = promos
    .map(p => ({
      commerceId: p.commerce.id,
      commerceName: p.commerce.name,
      promoId: p.sourceUrl!.split('/').pop()!,
    }))
    .filter(t => /^\d+$/.test(t.promoId))

  if (commerceFilter) {
    targets = targets.filter(t => t.commerceName.toLowerCase().includes(commerceFilter))
  }
  if (limit) targets = targets.slice(0, limit)

  console.log(`${targets.length} comercios a procesar${dryRun ? ' (DRY RUN)' : ''}`)

  let totalNew = 0, totalDup = 0, totalErr = 0, processed = 0

  for (const t of targets) {
    try {
      const branches = await fetchBranches(t.promoId)
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

        const { address, city } = parseDireccion(b.direccion)
        const osmId = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}_${t.commerceId}`

        if (!dryRun) {
          await prisma.commerceBranch.upsert({
            where: { source_osmId: { source: SOURCE, osmId } },
            update: { address, city, lat: b.lat, lng: b.lng },
            create: { commerceId: t.commerceId, source: SOURCE, osmId, lat: b.lat, lng: b.lng, address, city },
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

    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\nTotal: ${processed} comercios | nuevas sucursales: ${totalNew} | ya existían: ${totalDup} | errores: ${totalErr}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

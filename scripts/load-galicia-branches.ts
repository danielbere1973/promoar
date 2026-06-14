/**
 * Carga sucursales de Banco Galicia a CommerceBranch.
 *
 * Para cada comercio con al menos una promo ACTIVA de Galicia, usa el idPromocion (embebido
 * en sourceUrl como "#<id>") para consultar:
 *   GET https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/locales/idPromocion/{id}?page=1&pageSize=15
 * → { data: { list: [...], totalSize } }, cada item con latitud/longitud y provinciaNombre listos.
 *
 * Requiere WAF bypass: un page.goto() previo a la página de promos para obtener
 * cookies/sesión de navegador real antes de llamar la API (igual que galicia.ts).
 * Promos sin tienda física devuelven list vacía — se saltean.
 *
 * Uso:
 *   npx tsx scripts/load-galicia-branches.ts
 *   npx tsx scripts/load-galicia-branches.ts --limit 20
 *   npx tsx scripts/load-galicia-branches.ts --commerce cuspide
 *   npx tsx scripts/load-galicia-branches.ts --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'
import { chromium } from 'playwright'

const PAGE_URL = 'https://www.galicia.ar/personas/buscador-de-promociones'
const LOCALES_BASE = 'https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/locales/idPromocion'
const PAGE_SIZE = 15
const SOURCE = 'Galicia'

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type Local = {
  calle?: string; numero?: string; localidadNombre?: string; provinciaNombre?: string
  latitud?: number | null; longitud?: number | null
}

async function fetchLocales(ctx: any, idPromocion: string): Promise<Local[]> {
  const all: Local[] = []
  let pageNum = 1
  while (true) {
    const url = `${LOCALES_BASE}/${idPromocion}?page=${pageNum}&pageSize=${PAGE_SIZE}`
    const res = await ctx.request.get(url, { headers: { Accept: 'application/json', Referer: PAGE_URL } })
    if (!res.ok()) break
    const json = await res.json()
    const list: Local[] = json?.data?.list ?? []
    all.push(...list)
    const totalSize = json?.data?.totalSize ?? 0
    if (all.length >= totalSize || list.length === 0) break
    pageNum++
  }
  return all
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitArg = args.indexOf('--limit')
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1]) : undefined
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1]?.toLowerCase() : undefined

  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE', sourceUrl: { contains: 'galicia.ar/personas/buscador-de-promociones#' } },
    select: { commerceId: true, sourceUrl: true, commerce: { select: { id: true, name: true } } },
    distinct: ['commerceId'],
  })

  let targets = promos.map(p => ({
    commerceId: p.commerce.id,
    commerceName: p.commerce.name,
    idPromocion: p.sourceUrl!.split('#').pop()!,
  })).filter(t => /^\d+$/.test(t.idPromocion))

  if (commerceFilter) targets = targets.filter(t => t.commerceName.toLowerCase().includes(commerceFilter))
  if (limit) targets = targets.slice(0, limit)

  console.log(`${targets.length} comercios a procesar${dryRun ? ' (DRY RUN)' : ''}`)

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  })

  let totalNew = 0, totalDup = 0, totalErr = 0, withBranches = 0, processed = 0

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
      locale: 'es-AR',
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    const page = await context.newPage()
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort())

    console.log('[Galicia] Cargando página para obtener sesión...')
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(3000)

    for (const t of targets) {
      try {
        const locales = await fetchLocales(context, t.idPromocion)
        const withCoords = locales.filter(l => typeof l.latitud === 'number' && typeof l.longitud === 'number')

        if (withCoords.length === 0) {
          processed++
          await new Promise(r => setTimeout(r, 600))
          continue
        }

        const existing = await prisma.commerceBranch.findMany({
          where: { commerceId: t.commerceId },
          select: { lat: true, lng: true },
        })

        let added = 0, dup = 0
        for (const l of withCoords) {
          const lat = l.latitud as number, lng = l.longitud as number
          const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, lat, lng) < 0.1)
          if (isDuplicate) { dup++; continue }

          const address = [l.calle, l.numero].filter(Boolean).join(' ') || undefined
          const osmId = `${lat.toFixed(5)},${lng.toFixed(5)}_${t.commerceId}`

          if (!dryRun) {
            await prisma.commerceBranch.upsert({
              where: { source_osmId: { source: SOURCE, osmId } },
              update: { address, city: l.localidadNombre, province: l.provinciaNombre, lat, lng },
              create: { commerceId: t.commerceId, source: SOURCE, osmId, lat, lng, address, city: l.localidadNombre, province: l.provinciaNombre },
            })
          }
          existing.push({ lat, lng })
          added++
        }

        totalNew += added
        totalDup += dup
        if (added + dup > 0) withBranches++
        console.log(`  ${t.commerceName.padEnd(35)} → ${withCoords.length} locales, ${added} nuevas, ${dup} ya existían`)
      } catch (e: any) {
        totalErr++
        console.error(`  ${t.commerceName}: ERROR ${e.message}`)
      }

      processed++
      if (processed % 50 === 0) console.log(`  ── progreso: ${processed}/${targets.length} ──`)
      await new Promise(r => setTimeout(r, 600))
    }
  } finally {
    await browser.close()
  }

  console.log(`\nTotal: ${processed} comercios | con sucursales: ${withBranches} | nuevas: ${totalNew} | ya existían: ${totalDup} | errores: ${totalErr}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

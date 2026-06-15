/**
 * Carga sucursales desde Tiendeo.com.ar a CommerceBranch.
 *
 * Tiendeo (Shopfully) tiene, para cada cadena con presencia en una ciudad, una página
 *   https://www.tiendeo.com.ar/{ciudad-slug}/{cadena-slug}
 * con una sección "Horarios y direcciones {Cadena}" que linkea a páginas individuales
 * por sucursal:
 *   https://www.tiendeo.com.ar/Tiendas/{ciudad-slug}/{sucursal-slug}/{storeId}
 * Esa página individual trae, en __NEXT_DATA__ -> props.pageProps.pageInfo.store, el
 * objeto completo: { id, retailer_id, city, address, zip, province, slug, lat, lng,
 * phone, StoreHour }. Todo server-rendered, fetch directo sin sesión de navegador.
 *
 * No hay un endpoint nacional único: se recorre una lista curada de ciudades
 * (1-2 por provincia) y se consulta /{ciudad}/{cadena-slug} en cada una. Las páginas
 * de ciudad solo muestran las sucursales más cercanas a esa ciudad, así que se
 * deduplica por storeId al final (mismo enfoque multi-punto que BNA).
 *
 * Uso:
 *   npx tsx scripts/load-tiendeo-branches.ts --retailer-slug cordiez --commerce cordiez
 *   npx tsx scripts/load-tiendeo-branches.ts --retailer-slug atomo-conviene --commerce "atomo con modo" --dry-run
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'TIENDEO'
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'es-AR',
}

// 1-2 ciudades por provincia para cubrir el país (las páginas de ciudad solo
// muestran las sucursales más cercanas, hay que consultar desde varios puntos).
const CITY_SLUGS = [
  'buenos-aires', 'la-plata', 'mar-del-plata', 'bahia-blanca', 'quilmes',
  'cordoba', 'rio-cuarto',
  'rosario', 'santa-fe',
  'mendoza', 'godoy-cruz',
  'san-miguel-de-tucuman',
  'salta',
  'parana',
  'resistencia',
  'corrientes',
  'posadas',
  'san-juan',
  'san-salvador-jujuy',
  'santiago-del-estero',
  'san-luis',
  'san-fernando-del-valle-de-catamarca',
  'la-rioja',
  'formosa',
  'neuquen',
  'san-carlos-de-bariloche', 'viedma',
  'comodoro-rivadavia',
  'rio-gallegos',
  'ushuaia',
  'santa-rosa',
]

async function fetchHtml(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  return res.text()
}

function extractNextData(html: string): any | null {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

type TiendeoStore = {
  id: string
  address?: string
  city?: string
  province?: string
  lat?: string
  lng?: string
  phone?: string
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const retailerIdx = args.indexOf('--retailer-slug')
  const retailerSlug = retailerIdx >= 0 ? args[retailerIdx + 1] : null
  const commerceIdx = args.indexOf('--commerce')
  const commerceFilter = commerceIdx >= 0 ? args[commerceIdx + 1] : null
  const citiesIdx = args.indexOf('--cities')
  const limitCities = citiesIdx >= 0 ? parseInt(args[citiesIdx + 1]) : undefined

  if (!retailerSlug || !commerceFilter) {
    console.error('Uso: npx tsx scripts/load-tiendeo-branches.ts --retailer-slug <slug-tiendeo> --commerce <nombre-comercio> [--dry-run] [--cities N]')
    process.exit(1)
  }

  const commerce = await prisma.commerce.findFirst({
    where: { name: { contains: commerceFilter, mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!commerce) {
    console.error(`No se encontró ningún Commerce que matchee "${commerceFilter}"`)
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)
  console.log(`Retailer Tiendeo: ${retailerSlug}${dryRun ? ' (DRY RUN)' : ''}`)

  const cities = limitCities ? CITY_SLUGS.slice(0, limitCities) : CITY_SLUGS
  const storeUrls = new Map<string, string>() // storeId -> path

  for (const city of cities) {
    const html = await fetchHtml(`https://www.tiendeo.com.ar/${city}/${retailerSlug}`)
    if (!html) { console.log(`  ${city}: HTTP error`); await new Promise(r => setTimeout(r, 200)); continue }

    const links = html.match(/\/Tiendas\/[^"]+\/\d+/g) || []
    let added = 0
    for (const link of new Set(links)) {
      const idMatch = link.match(/\/(\d+)$/)
      if (!idMatch) continue
      if (!storeUrls.has(idMatch[1])) { storeUrls.set(idMatch[1], link); added++ }
    }
    console.log(`  ${city}: ${new Set(links).size} sucursales (${added} nuevas, total acumulado ${storeUrls.size})`)
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\nTotal sucursales únicas a consultar: ${storeUrls.size}`)

  const existing = await prisma.commerceBranch.findMany({
    where: { commerceId: commerce.id },
    select: { source: true, osmId: true },
  })
  const existingOsmIds = new Set(existing.filter(e => e.source === SOURCE).map(e => e.osmId))

  let added = 0, skipped = 0, errors = 0
  for (const [storeId, path] of storeUrls) {
    const osmId = `tiendeo_${storeId}`
    if (existingOsmIds.has(osmId)) { skipped++; continue }

    const html = await fetchHtml(`https://www.tiendeo.com.ar${path}`)
    if (!html) { errors++; await new Promise(r => setTimeout(r, 250)); continue }

    const json = extractNextData(html)
    const store: TiendeoStore | undefined = json?.props?.pageProps?.pageInfo?.store
    if (!store?.lat || !store?.lng) { errors++; await new Promise(r => setTimeout(r, 250)); continue }

    const lat = parseFloat(store.lat)
    const lng = parseFloat(store.lng)

    console.log(`  + ${store.address}, ${store.city}, ${store.province} (${lat}, ${lng})`)
    if (!dryRun) {
      await prisma.commerceBranch.upsert({
        where: { source_osmId: { source: SOURCE, osmId } },
        update: { address: store.address, city: store.city, province: store.province, lat, lng },
        create: { commerceId: commerce.id, source: SOURCE, osmId, address: store.address, city: store.city, province: store.province, lat, lng },
      })
    }
    added++
    await new Promise(r => setTimeout(r, 250))
  }

  console.log(`\nTotal: ${added} nuevas, ${skipped} ya existían, ${errors} errores`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

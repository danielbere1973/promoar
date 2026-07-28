/**
 * Carga sucursales de Pinturerías ColorShop a CommerceBranch.
 *
 * colorshop.com.ar (VTEX) expone sus locales vía una GraphQL persisted query propia
 * (operationName=branchesList, provider iocolorshop.store-branches@0.x).
 * Un solo fetch con pageSize=500 trae las 307 sucursales, las 24 provincias, 0 sin lat/lng.
 * Sin WAF, sin sesión de navegador — fetch directo funciona.
 *
 * Uso:
 *   npx tsx scripts/load-colorshop-branches.ts --dry-run
 *   npx tsx scripts/load-colorshop-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'COLORSHOP'

// Variables para la persisted query: page 0-based, pageSize 500 trae todo de una vez.
// VTEX espera este parámetro como JSON plano (URL-encoded), no en base64 — un intento
// anterior con base64 devolvía 500 "Unexpected token ... is not valid JSON".
const VARIABLES = JSON.stringify({ page: 0, pageSize: 500, sortBy: '', where: '' })

const API_URL =
  'https://www.colorshop.com.ar/_v/public/graphql/v1' +
  '?workspace=master&maxAge=medium&appsEtag=remove&domain=store&locale=es-AR' +
  '&operationName=branchesList' +
  '&extensions=' + encodeURIComponent(JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash: '953a9a113738e3a3f0dfa67fa62d56990e70d09ee91a2359b5211e89bc762dfd',
      sender: 'iocolorshop.custom-apps@0.x',
      provider: 'iocolorshop.store-branches@0.x',
    },
  })) +
  `&variables=${encodeURIComponent(VARIABLES)}`

type RawBranch = {
  id: string
  name: string
  address: string
  isActive: boolean
  city: string
  province: string
  postalCode?: string
  location: { lat: string; lng: string }
}

async function fetchBranches(): Promise<RawBranch[]> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  const branches: RawBranch[] = body?.data?.branchesList?.data
  if (!Array.isArray(branches)) throw new Error(`Respuesta inesperada: ${JSON.stringify(body).slice(0, 200)}`)
  return branches
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[DRY RUN] No se escribirá en la base de datos.\n')

  // 1. Verificar que el comercio existe
  const commerce = await prisma.commerce.findFirst({
    where: { name: { contains: 'ColorShop', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!commerce) {
    const candidates = await prisma.commerce.findMany({
      where: { name: { contains: 'Colorshop', mode: 'insensitive' } },
      select: { id: true, name: true },
    })
    console.error('No se encontró el comercio ColorShop. Candidatos:', candidates)
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)

  // 2. Fetch
  console.log('Fetching sucursales desde colorshop.com.ar...')
  const raw = await fetchBranches()
  console.log(`Fetched: ${raw.length}`)

  // 3. Validaciones antes de tocar la DB
  if (raw.length < 200) {
    console.error(`⚠ Cantidad inesperadamente baja (${raw.length}). Se esperaban ~307. Abortando.`)
    process.exit(1)
  }

  const active = raw.filter(b => b.isActive)
  console.log(`Activas: ${active.length} / ${raw.length}`)

  const withCoords = active.filter(b => {
    const lat = parseFloat(b.location?.lat)
    const lng = parseFloat(b.location?.lng)
    return !Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0
  })
  console.log(`Con lat/lng válidos: ${withCoords.length}`)

  const byProvince: Record<string, number> = {}
  for (const b of withCoords) {
    byProvince[b.province] = (byProvince[b.province] ?? 0) + 1
  }
  console.log(`Provincias cubiertas: ${Object.keys(byProvince).length}`)

  // 4. Upsert en transacción
  let inserted = 0, updated = 0, skipped = 0, errors = 0

  if (!dryRun) {
    // Cada upsert ya es atómico por sí solo — no envolver 298 llamadas en una única
    // transacción, porque el timeout por default (5s) de Prisma corta la transacción
    // completa a mitad de camino contra el pooler de Neon (mayor latencia por conexión).
    for (const b of withCoords) {
      const lat = parseFloat(b.location.lat)
      const lng = parseFloat(b.location.lng)
      const osmId = b.id  // ID propio de ColorShop como clave de idempotencia

      try {
        const result = await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: {
            name: b.name,
            address: b.address,
            city: b.city,
            province: b.province,
            lat,
            lng,
          },
          create: {
            commerceId: commerce.id,
            source: SOURCE,
            osmId,
            name: b.name,
            address: b.address,
            city: b.city,
            province: b.province,
            lat,
            lng,
          },
        })
        // createdAt === updatedAt solo en el instante de creación
        if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
        else updated++
      } catch (e) {
        console.error(`  Error en sucursal ${b.id} (${b.name}):`, e)
        errors++
      }
    }
  } else {
    // Dry run: contar existentes vs nuevas
    const existingOsmIds = new Set(
      (await prisma.commerceBranch.findMany({
        where: { commerceId: commerce.id, source: SOURCE },
        select: { osmId: true },
      })).map(b => b.osmId)
    )
    for (const b of withCoords) {
      if (existingOsmIds.has(b.id)) updated++
      else inserted++
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Resumen:`)
  console.log(`  Fetched:  ${raw.length}`)
  console.log(`  Activas:  ${active.length}`)
  console.log(`  Inserted: ${inserted}`)
  console.log(`  Updated:  ${updated}`)
  console.log(`  Skipped:  ${skipped}`)
  console.log(`  Errors:   ${errors}`)

  if (!dryRun && errors === 0) {
    console.log(`\n✓ ColorShop cargado con ${inserted + updated} sucursales en ${Object.keys(byProvince).length} provincias.`)
  } else if (errors > 0) {
    console.error(`\n⚠ Completado con ${errors} errores.`)
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

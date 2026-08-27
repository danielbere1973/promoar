/**
 * Carga sucursales de Megatone a CommerceBranch.
 *
 * megatone.net/sucursales/ consume GET /apirecursoswebv4/api/sucursales — un solo fetch
 * trae las 57 sucursales del país con lat/lng listos. Sin WAF, pero requiere un
 * User-Agent de navegador real (curl/fetch sin UA da 418).
 *
 * Uso:
 *   npx tsx scripts/load-megatone-branches.ts --dry-run
 *   npx tsx scripts/load-megatone-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const SOURCE = 'MEGATONE'
const API_URL = 'https://www.megatone.net/apirecursoswebv4/api/sucursales'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

type RawBranch = {
  idSucursalUnico: number
  nombreCorto: string
  direccion: string
  codigoPostal?: number
  localidad: string
  provincia: string
  latitud: number
  longitud: number
}

async function fetchBranches(): Promise<RawBranch[]> {
  const res = await fetch(API_URL, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (!Array.isArray(body)) throw new Error(`Respuesta inesperada: ${JSON.stringify(body).slice(0, 200)}`)
  return body
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[DRY RUN] No se escribirá en la base de datos.\n')

  const commerce = await prisma.commerce.findFirst({
    where: { name: 'MEGATONE' },
    select: { id: true, name: true },
  })
  if (!commerce) {
    console.error('No se encontró el comercio MEGATONE.')
    process.exit(1)
  }
  console.log(`Comercio: ${commerce.name} (${commerce.id})`)

  console.log('Fetching sucursales desde megatone.net...')
  const raw = await fetchBranches()
  console.log(`Fetched: ${raw.length}`)

  if (raw.length < 40) {
    console.error(`⚠ Cantidad inesperadamente baja (${raw.length}). Se esperaban ~57. Abortando.`)
    process.exit(1)
  }

  const withCoords = raw.filter(b => Number.isFinite(b.latitud) && Number.isFinite(b.longitud) && b.latitud !== 0)
  console.log(`Con lat/lng válidos: ${withCoords.length}`)

  const byProvince: Record<string, number> = {}
  for (const b of withCoords) byProvince[b.provincia] = (byProvince[b.provincia] ?? 0) + 1
  console.log(`Provincias cubiertas: ${Object.keys(byProvince).length}`)

  let inserted = 0, updated = 0, errors = 0

  if (!dryRun) {
    for (const b of withCoords) {
      const osmId = String(b.idSucursalUnico)
      try {
        const result = await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: SOURCE, osmId } },
          update: { name: b.nombreCorto, address: b.direccion, city: b.localidad, province: b.provincia, lat: b.latitud, lng: b.longitud },
          create: {
            commerceId: commerce.id, source: SOURCE, osmId,
            name: b.nombreCorto, address: b.direccion, city: b.localidad, province: b.provincia,
            lat: b.latitud, lng: b.longitud,
          },
        })
        if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++
        else updated++
      } catch (e) {
        console.error(`  Error en sucursal ${b.idSucursalUnico} (${b.nombreCorto}):`, e)
        errors++
      }
    }
  } else {
    const existingOsmIds = new Set(
      (await prisma.commerceBranch.findMany({ where: { commerceId: commerce.id, source: SOURCE }, select: { osmId: true } })).map(b => b.osmId)
    )
    for (const b of withCoords) {
      if (existingOsmIds.has(String(b.idSucursalUnico))) updated++
      else inserted++
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Resumen: fetched=${raw.length} inserted=${inserted} updated=${updated} errors=${errors}`)
  if (!dryRun && errors === 0) {
    console.log(`✓ Megatone cargado con ${inserted + updated} sucursales en ${Object.keys(byProvince).length} provincias.`)
  } else if (errors > 0) {
    process.exit(1)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

/**
 * Carga sucursales de Café Martínez a CommerceBranch.
 *
 * cafemartinez.com (VTEX) expone su listado de locales vía Master Data:
 *   GET https://www.cafemartinez.com/api/dataentities/LO/search/
 *     ?_fields=address,city,latitude,longitude,name,state,postalCode
 *   Header: REST-Range: resources={from}-{to} (paginado, máx ~50/página)
 *   El total viene en el header de respuesta rest-content-range: resources X-Y/TOTAL
 * Sin WAF, sin sesión de navegador — fetch directo funciona. ~227 locales,
 * cubre Argentina + Uruguay + Paraguay (se filtran estos últimos por `state`/`country`).
 *
 * Uso:
 *   npx tsx scripts/load-cafemartinez-branches.ts --dry-run
 *   npx tsx scripts/load-cafemartinez-branches.ts
 */

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { prisma } from '../lib/prisma'

const API_URL = 'https://www.cafemartinez.com/api/dataentities/LO/search/'
const FIELDS = 'address,city,country,latitude,longitude,name,state,postalCode'
const SOURCE = 'CAFEMARTINEZ'
const PAGE_SIZE = 50

// Provincias/estados que corresponden a Argentina (el dataset mezcla AR/UY/PY).
const NON_ARGENTINA_STATES = new Set([
  'montevideo', 'mariano roque alonso', 'san lorenzo', 'asunción', 'asuncion',
  'pedro juan caballero', 'luque',
])

type Branch = {
  name?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  latitude?: string
  longitude?: string
}

async function fetchAll(): Promise<Branch[]> {
  const all: Branch[] = []
  let from = 0
  while (true) {
    const to = from + PAGE_SIZE - 1
    const res = await fetch(`${API_URL}?_fields=${FIELDS}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'REST-Range': `resources=${from}-${to}` },
    })
    if (!res.ok) break
    const batch: Branch[] = await res.json()
    all.push(...batch)
    const range = res.headers.get('rest-content-range')
    const total = range ? parseInt(range.split('/')[1]) : all.length
    if (all.length >= total || batch.length === 0) break
    from += PAGE_SIZE
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
  const dryRun = process.argv.includes('--dry-run')

  const commerce = await prisma.commerce.findFirst({
    where: { name: { equals: 'Café Martínez', mode: 'insensitive' } },
  })
  if (!commerce) {
    // fallback por si el nombre exacto difiere
    const candidates = await prisma.commerce.findMany({
      where: { name: { contains: 'Martinez', mode: 'insensitive' } },
      select: { id: true, name: true },
    })
    console.log('No se encontró "Café Martínez" exacto. Candidatos:', candidates)
    await prisma.$disconnect()
    return
  }

  console.log(`Comercio: ${commerce.name} (${commerce.id})`)
  const raw = await fetchAll()
  console.log(`Total sucursales recibidas de la API: ${raw.length}`)

  const arBranches = raw.filter(b => {
    const state = (b.state ?? '').trim().toLowerCase()
    if (!state) return false
    if (NON_ARGENTINA_STATES.has(state)) return false
    return true
  })
  console.log(`Sucursales en Argentina (tras filtrar UY/PY): ${arBranches.length}`)

  const withCoords = arBranches.filter(b => b.latitude && b.longitude)
  console.log(`Con lat/lng válidos: ${withCoords.length}`)

  const existing = await prisma.commerceBranch.findMany({
    where: { commerceId: commerce.id },
    select: { lat: true, lng: true },
  })

  let added = 0, dup = 0, updated = 0

  for (const b of withCoords) {
    const lat = parseFloat(b.latitude!)
    const lng = parseFloat(b.longitude!)
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue

    const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, lat, lng) < 0.1)
    const osmId = `${lat.toFixed(5)},${lng.toFixed(5)}`

    if (!dryRun) {
      const result = await prisma.commerceBranch.upsert({
        where: { source_osmId: { source: SOURCE, osmId } },
        update: { name: b.name, address: b.address, city: b.city, province: b.state, lat, lng },
        create: { commerceId: commerce.id, source: SOURCE, osmId, name: b.name, address: b.address, city: b.city, province: b.state, lat, lng },
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) added++
      else updated++
    } else {
      if (isDuplicate) dup++
      else added++
    }
    existing.push({ lat, lng })
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Nuevas: ${added} | ${dryRun ? `ya existirían (~duplicadas): ${dup}` : `actualizadas: ${updated}`}`)
  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

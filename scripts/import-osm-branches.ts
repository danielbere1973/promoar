/**
 * Importa sucursales desde OpenStreetMap a la tabla commerce_branches.
 * Filtra por tipo de lugar (amenity, shop, etc.) para evitar falsos positivos.
 *
 * Uso:
 *   npx tsx scripts/import-osm-branches.ts                    # todas
 *   npx tsx scripts/import-osm-branches.ts --commerce coto    # una sola
 *   npx tsx scripts/import-osm-branches.ts --dry-run          # sin guardar
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// Bbox Argentina (south, west, north, east)
const BBOX = '-55.1,-73.6,-21.8,-53.6'

type BranchDef = {
  name: string
  aliases?: string[]
  tags: string[]  // filtros OSM por tipo: ["amenity=supermarket", "shop=supermarket"]
}

const BRANCH_DEFS: BranchDef[] = [
  // Supermercados
  { name: 'Coto',             tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Jumbo',            tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Carrefour',        tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Disco',            tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Vea',              tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Changomas',        aliases: ['ChangoMás', 'Chango Mas'], tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Diarco',           tags: ['shop=supermarket', 'amenity=supermarket', 'shop=wholesale'] },
  { name: 'La Anónima',       aliases: ['La Anonima'], tags: ['shop=supermarket', 'amenity=supermarket'] },
  { name: 'Toledo',           tags: ['shop=supermarket', 'amenity=supermarket'] },

  // Farmacias
  { name: 'Farmacity',        tags: ['amenity=pharmacy', 'shop=pharmacy'] },
  { name: 'Farmaplus',        tags: ['amenity=pharmacy', 'shop=pharmacy'] },
  { name: 'Openfarma',        aliases: ['Open Farma'], tags: ['amenity=pharmacy', 'shop=pharmacy'] },

  // Combustible
  { name: 'YPF',              tags: ['amenity=fuel'] },
  { name: 'Shell',            tags: ['amenity=fuel'] },
  { name: 'Axion',            tags: ['amenity=fuel'] },
  { name: 'Puma',             aliases: ['Puma Energy'], tags: ['amenity=fuel'] },

  // Comida rápida
  { name: "McDonald's",       aliases: ['McDonalds', "Mc Donald's"], tags: ['amenity=fast_food', 'amenity=restaurant'] },
  { name: 'Burger King',      tags: ['amenity=fast_food', 'amenity=restaurant'] },
  { name: 'Mostaza',          tags: ['amenity=fast_food', 'amenity=restaurant'] },
  { name: "Wendy's",          aliases: ['Wendys'], tags: ['amenity=fast_food', 'amenity=restaurant'] },
  { name: 'KFC',              tags: ['amenity=fast_food', 'amenity=restaurant'] },

  // Heladerías
  { name: 'Freddo',           tags: ['amenity=ice_cream', 'shop=ice_cream'] },
  { name: 'Grido',            tags: ['amenity=ice_cream', 'shop=ice_cream'] },
  { name: 'Chungo',           tags: ['amenity=ice_cream', 'shop=ice_cream'] },
  { name: 'Daniel',           aliases: ['Heladería Daniel', 'Helados Daniel'], tags: ['amenity=ice_cream', 'shop=ice_cream'] },
  { name: 'Rapanui',          tags: ['amenity=ice_cream', 'shop=ice_cream', 'shop=chocolate'] },

  // Mascotas
  { name: 'Puppis',           tags: ['shop=pet', 'shop=veterinary'] },
  { name: 'Petco',            tags: ['shop=pet'] },
  { name: 'Tienda de Mascotas', tags: ['shop=pet'] },
  { name: 'TotalPet',         aliases: ['Total Pet'], tags: ['shop=pet'] },

  // Gastronomía (cafés / restaurants)
  { name: 'Havanna',          tags: ['amenity=cafe', 'amenity=restaurant', 'shop=bakery'] },
  { name: 'Bonafide',         tags: ['amenity=cafe', 'shop=bakery'] },
  { name: 'Café Martínez',    aliases: ['Cafe Martinez'], tags: ['amenity=cafe'] },
  { name: 'Starbucks',        tags: ['amenity=cafe'] },
  { name: 'Kansas',           tags: ['amenity=restaurant'] },
  { name: 'Sushi Club',       tags: ['amenity=restaurant'] },

  // Indumentaria
  { name: 'Adidas',           tags: ['shop=clothes', 'shop=sports'] },
  { name: 'Nike',             tags: ['shop=clothes', 'shop=sports'] },
  { name: 'Puma',             aliases: ['Puma Store'], tags: ['shop=clothes', 'shop=sports'] },
  { name: 'Cheeky',           tags: ['shop=clothes'] },
  { name: 'Kevingston',       tags: ['shop=clothes'] },
  { name: 'Sweet',            tags: ['shop=clothes'] },
  { name: 'Grimoldi',         tags: ['shop=shoes'] },
  { name: 'Hush Puppies',     tags: ['shop=shoes'] },
  { name: 'Macowens',         tags: ['shop=clothes', 'shop=shoes'] },
  { name: 'La Martina',       tags: ['shop=clothes'] },

  // Tecnología
  { name: 'Frávega',          aliases: ['Fravega'], tags: ['shop=electronics'] },
  { name: 'Megatone',         tags: ['shop=electronics'] },
  { name: 'Garbarino',        tags: ['shop=electronics'] },
  { name: 'Coppel',           tags: ['shop=electronics', 'shop=department_store'] },
  { name: 'Cetrogar',         tags: ['shop=electronics'] },

  // Hogar
  { name: 'Easy',             tags: ['shop=doityourself', 'shop=hardware'] },
  { name: 'Sodimac',          tags: ['shop=doityourself', 'shop=hardware', 'shop=department_store'] },
  { name: 'Pinturerías Colorshop', aliases: ['Colorshop'], tags: ['shop=paint'] },

  // Entretenimiento
  { name: 'Cinemark',         tags: ['amenity=cinema'] },
  { name: 'Hoyts',            tags: ['amenity=cinema'] },
  { name: 'Cinépolis',        aliases: ['Cinepolis', 'Cines Multiplex'], tags: ['amenity=cinema'] },

  // Salud y Belleza
  { name: 'Megatlon',         tags: ['leisure=fitness_centre', 'leisure=sports_centre'] },

  // Deportes
  { name: 'Decathlon',        tags: ['shop=sports'] },

  // Jugueterías
  { name: 'Cebra',            tags: ['shop=toys'] },
  { name: 'Giro Didáctico',   aliases: ['Giro Didactico'], tags: ['shop=toys'] },
  { name: 'Carrousel',        tags: ['shop=toys'] },

  // Librerías
  { name: 'El Ateneo',        tags: ['shop=books'] },
  { name: 'Cúspide',          aliases: ['Cuspide'], tags: ['shop=books'] },
  { name: 'Yenny',            tags: ['shop=books'] },

  // Automotores / Combustible
  { name: 'Bridgestone',      tags: ['shop=tyres', 'shop=car_repair'] },
  { name: 'Goodyear',         tags: ['shop=tyres', 'shop=car_repair'] },
  { name: 'Pirelli',          tags: ['shop=tyres'] },
  { name: 'Norauto',          tags: ['shop=car_repair', 'shop=car_parts'] },
  { name: 'Toyota',           tags: ['shop=car', 'amenity=car_dealer'] },
  { name: 'Audi',             tags: ['shop=car', 'amenity=car_dealer'] },
]

async function queryOverpass(def: BranchDef): Promise<{ osmId: string; lat: number; lng: number; name?: string; address?: string; city?: string; province?: string }[]> {
  const allNames = [def.name, ...(def.aliases ?? [])]
  const nameRegex = allNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

  // Generar filtros: para cada tag, buscar nodes con ese tag Y brand/name matching
  const filters = def.tags.flatMap(tag => {
    const [key, val] = tag.split('=')
    return allNames.map(n => {
      const esc = n.replace(/"/g, '\\"')
      return [
        `node["${key}"="${val}"]["brand"~"^(${nameRegex})$",i](${BBOX});`,
        `node["${key}"="${val}"]["name"~"^(${nameRegex})",i](${BBOX});`,
      ]
    }).flat()
  })

  // Deduplicar filtros
  const uniqueFilters = [...new Set(filters)].join('\n  ')

  const query = `[out:json][timeout:60];
(
  ${uniqueFilters}
);
out body;`

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'PromoAR/1.0' },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) continue
      const json = await res.json() as any
      const elements: any[] = json.elements ?? []

      return elements
        .filter(e => e.lat && e.lon)
        .map(e => {
          const tags = e.tags ?? {}
          const street = tags['addr:street'] ?? ''
          const num = tags['addr:housenumber'] ?? ''
          const address = [street, num].filter(Boolean).join(' ') || tags['addr:full'] || undefined
          const city = tags['addr:city'] ?? tags['addr:suburb'] ?? undefined
          const province = tags['addr:province'] ?? tags['addr:state'] ?? undefined
          return {
            osmId: String(e.id),
            lat: e.lat,
            lng: e.lon,
            name: tags.name ?? tags.brand ?? undefined,
            address,
            city,
            province,
          }
        })
    } catch {
      continue
    }
  }
  return []
}

async function main() {
  const args = process.argv.slice(2)
  const commerceFilter = args[args.indexOf('--commerce') + 1]?.toLowerCase()
  const dryRun = args.includes('--dry-run')

  if (dryRun) console.log('⚠️  DRY RUN — sin cambios en DB')

  const defs = commerceFilter
    ? BRANCH_DEFS.filter(d => d.name.toLowerCase().includes(commerceFilter))
    : BRANCH_DEFS

  // Cargar commerces de la DB una sola vez
  const dbCommerces = await prisma.commerce.findMany({ select: { id: true, name: true } })
  const normStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  let totalImported = 0
  let totalSkipped = 0

  for (const def of defs) {
    // Buscar el commerce en DB por nombre exacto o alias
    const allNames = [def.name, ...(def.aliases ?? [])]
    const commerce = dbCommerces.find(c =>
      allNames.some(n => normStr(c.name) === normStr(n))
    )

    if (!commerce) {
      console.log(`⚠️  ${def.name}: no encontrado en DB, saltando`)
      continue
    }

    console.log(`\n📍 ${def.name} (${commerce.id})...`)
    const branches = await queryOverpass(def)
    console.log(`   OSM: ${branches.length} sucursales encontradas`)

    if (branches.length === 0 || dryRun) {
      if (dryRun && branches.length > 0) console.log(`   (dry-run) Se guardarían ${branches.length} sucursales`)
      continue
    }

    // Guardar en DB (upsert por osmId)
    let imported = 0
    let skipped = 0
    for (const b of branches) {
      try {
        await prisma.commerceBranch.upsert({
          where: { source_osmId: { source: 'OSM', osmId: b.osmId } },
          update: { lat: b.lat, lng: b.lng, name: b.name, address: b.address, city: b.city, province: b.province },
          create: {
            commerceId: commerce.id,
            osmId: b.osmId,
            source: 'OSM',
            lat: b.lat,
            lng: b.lng,
            name: b.name,
            address: b.address,
            city: b.city,
            province: b.province,
          },
        })
        imported++
      } catch {
        skipped++
      }
    }

    console.log(`   ✅ ${imported} guardadas, ${skipped} errores`)
    totalImported += imported
    totalSkipped += skipped

    // Rate limit
    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`\n═══════════════════════════`)
  console.log(`Total importadas: ${totalImported}`)
  console.log(`Total errores:    ${totalSkipped}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

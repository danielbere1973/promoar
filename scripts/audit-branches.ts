/**
 * Auditoría de fuentes de sucursales por comercio.
 *
 * Para cada cadena, prueba:
 *   1. Overpass API (OpenStreetMap) — busca por name="..." en Argentina
 *   2. VTEX storeLocator API — si la cadena usa VTEX (subdominio típico)
 *
 * Output: tabla con conteos por fuente. Sirve para decidir estrategia por comercio.
 *
 * Uso: npx tsx scripts/audit-branches.ts
 *      npx tsx scripts/audit-branches.ts --category supermercados
 *      npx tsx scripts/audit-branches.ts --commerce coto
 */

type CommerceEntry = { name: string; aliases?: string[]; vtexHost?: string }

const COMMERCES: Record<string, CommerceEntry[]> = {
  Supermercados: [
    { name: 'Coto' },
    { name: 'Jumbo', vtexHost: 'jumboargentina.vtexcommercestable.com.br' },
    { name: 'Carrefour', vtexHost: 'carrefourar.vtexcommercestable.com.br' },
    { name: 'Disco', vtexHost: 'discoar.vtexcommercestable.com.br' },
    { name: 'Vea', vtexHost: 'veaargentina.vtexcommercestable.com.br' },
    { name: 'Changomas', vtexHost: 'walmartar.vtexcommercestable.com.br' },
    { name: 'Diarco' },
    { name: 'La Anónima', aliases: ['La Anonima', 'Supermercado La Anónima'] },
    { name: 'Toledo', aliases: ['Supermercado Toledo'] },
    { name: 'The Food Market' },
  ],
  Farmacias: [
    { name: 'Farmacity', vtexHost: 'farmacity.vtexcommercestable.com.br' },
    { name: 'Farmahorro' },
    { name: 'Farmaplus' },
    { name: 'Farmaonline' },
    { name: 'Openfarma', aliases: ['Open Farma'] },
  ],
  Combustible: [
    { name: 'YPF' },
    { name: 'Shell' },
    { name: 'Axion' },
    { name: 'Puma' },
  ],
  Comida: [
    { name: "McDonald's", aliases: ['McDonalds'] },
    { name: 'Burger King' },
    { name: 'Mostaza' },
    { name: "Wendy's", aliases: ['Wendys'] },
    { name: 'KFC' },
  ],
  Heladerías: [
    { name: 'Freddo' },
    { name: 'Grido' },
    { name: 'Chungo' },
    { name: 'Daniel', aliases: ['Heladería Daniel'] },
    { name: 'Rapanui' },
  ],
  Mascotas: [
    { name: 'Petco' },
    { name: 'Puppis' },
    { name: 'Nutrican' },
    { name: 'TotalPet', aliases: ['Total Pet'] },
    { name: 'Natural Life' },
    { name: 'Tienda de Mascotas' },
    { name: 'Leocan' },
    { name: 'Catycan' },
    { name: 'Pet Company' },
    { name: 'Animalia' },
  ],
  Gastronomía: [
    { name: 'Kansas' },
    { name: 'Havanna' },
    { name: 'Bonafide' },
    { name: 'Café Martínez', aliases: ['Cafe Martinez'] },
    { name: 'Atalaya' },
    { name: 'Dandy' },
    { name: 'Starbucks' },
    { name: 'Coquitos' },
    { name: 'Tucson' },
    { name: 'Natura' },
    { name: 'Sushi Club' },
    { name: 'Fabric Sushi' },
    { name: 'Churros el Topo' },
  ],
  Indumentaria: [
    { name: 'Adidas' },
    { name: 'Nike' },
    { name: 'Puma' },
    { name: 'Topper' },
    { name: 'Vans' },
    { name: 'The North Face' },
    { name: 'Cheeky' },
    { name: 'Akiabara' },
    { name: 'Yagmour' },
    { name: 'Rapsodia' },
    { name: 'Desiderata' },
    { name: 'Portsaid' },
    { name: 'Paula Cahen D\'Anvers' },
    { name: 'Kevingston' },
    { name: 'Caro Cuore' },
    { name: 'Sweet' },
    { name: 'La Martina' },
    { name: 'Lazaro' },
    { name: 'Cardon' },
    { name: 'Bensimon' },
    { name: 'Grimoldi' },
    { name: 'Hush Puppies' },
    { name: 'Stock Center' },
    { name: 'Open Sports' },
    { name: 'Macowens' },
    { name: 'Devré', aliases: ['Devre'] },
  ],
  Tecnología: [
    { name: 'Frávega', aliases: ['Fravega'] },
    { name: 'Megatone' },
    { name: 'Garbarino' },
    { name: 'Coppel' },
    { name: 'Cetrogar' },
    { name: 'Casa del Audio' },
    { name: 'Bidcom' },
    { name: 'Grupo Márquez', aliases: ['Grupo Marquez'] },
    { name: 'Garmin' },
  ],
  Hogar: [
    { name: 'Sodimac' },
    { name: 'Easy' },
    { name: 'Blaisten' },
    { name: 'Pinturerías Rex', aliases: ['Pinturerias Rex'] },
    { name: 'Pinturerías Colorshop', aliases: ['Colorshop'] },
    { name: 'Arredo' },
    { name: 'La Cardeuse' },
    { name: 'Sommier Center' },
    { name: 'Simmons' },
  ],
  Entretenimiento: [
    { name: 'Cinemark' },
    { name: 'Hoyts' },
    { name: 'Cinépolis', aliases: ['Cinepolis', 'Cines Multiplex'] },
  ],
  'Salud y Belleza': [
    { name: 'Juleriaque' },
    { name: 'Perfumerías Rouge', aliases: ['Perfumeria Rouge'] },
    { name: 'Get the Look' },
    { name: 'Megatlon' },
    { name: 'Fiter' },
  ],
  Deportes: [
    { name: 'Decathlon' },
    { name: 'Onfit' },
  ],
  Jugueterías: [
    { name: 'Cebra' },
    { name: 'Compañía de Juguetes', aliases: ['Compania de Juguetes'] },
    { name: 'Giro Didáctico', aliases: ['Giro Didactico'] },
    { name: 'Carrousel' },
  ],
  Librerías: [
    { name: 'El Ateneo' },
    { name: 'Cúspide', aliases: ['Cuspide'] },
    { name: 'Yenny' },
  ],
  'Viajes y Turismo': [
    { name: 'Despegar' },
    { name: 'Howard Johnson' },
    { name: 'Avis' },
    { name: 'Budget' },
    { name: 'Chevallier' },
    { name: 'Andesmar' },
    { name: 'Flecha Bus', aliases: ['Flechabus'] },
  ],
  Automotores: [
    { name: 'Bridgestone' },
    { name: 'Goodyear' },
    { name: 'Pirelli' },
    { name: 'Norauto' },
    { name: 'Toyota' },
    { name: 'Audi' },
    { name: 'Daytona' },
  ],
}

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function queryOverpass(name: string, aliases: string[] = []): Promise<number> {
  const allNames = [name, ...aliases]
  // Buscar por brand (más confiable, una marca = un valor) y name (fallback)
  // Bbox Argentina (south, west, north, east)
  const BBOX = '-55.1,-73.6,-21.8,-53.6'
  const filters = allNames.flatMap(n => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '\\"')
    return [
      `node["brand"~"^${esc}$",i](${BBOX});`,
      `node["name"~"^${esc}",i](${BBOX});`,
    ]
  }).join('\n  ')

  const query = `[out:json][timeout:60];
(
  ${filters}
);
out tags;`

  for (const url of OVERPASS_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PromoAR-BranchAudit/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) {
        const body = (await res.text()).slice(0, 150)
        console.error(`  [Overpass ${name}] ${url.split('//')[1].split('/')[0]} HTTP ${res.status}: ${body}`)
        continue
      }
      const json = await res.json() as any
      return Array.isArray(json.elements) ? json.elements.length : 0
    } catch (e: any) {
      console.error(`  [Overpass ${name}] ${url.split('//')[1].split('/')[0]} EXC: ${e.message}`)
      continue
    }
  }
  return -1
}

async function queryVtexStores(host: string): Promise<number> {
  try {
    const url = `https://${host}/api/dataentities/store/search?_fields=id,name&_size=1000`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'REST-Range': 'resources=0-999',
      },
    })
    if (!res.ok) {
      console.error(`  [VTEX ${host}] HTTP ${res.status}:`, (await res.text()).slice(0, 200))
      return -1
    }
    const json = await res.json() as any[]
    return Array.isArray(json) ? json.length : 0
  } catch (e: any) {
    console.error(`  [VTEX ${host}] EXCEPTION:`, e.message)
    return -1
  }
}

async function main() {
  const args = process.argv.slice(2)
  const getArg = (flag: string) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1]?.toLowerCase() : undefined
  }
  const catFilter = getArg('--category')
  const commerceFilter = getArg('--commerce')

  console.log('Categoría'.padEnd(20), 'Comercio'.padEnd(30), 'Overpass'.padStart(10), 'VTEX'.padStart(8))
  console.log('─'.repeat(70))

  const results: Array<{ cat: string; name: string; overpass: number; vtex: number }> = []

  for (const [cat, list] of Object.entries(COMMERCES)) {
    if (catFilter && !cat.toLowerCase().includes(catFilter)) continue

    for (const c of list) {
      if (commerceFilter && !c.name.toLowerCase().includes(commerceFilter)) continue

      const overpass = await queryOverpass(c.name, c.aliases)
      const vtex = c.vtexHost ? await queryVtexStores(c.vtexHost) : -2 // -2 = no aplica

      const overpassStr = overpass === -1 ? 'ERROR' : String(overpass)
      const vtexStr = vtex === -2 ? '-' : vtex === -1 ? 'ERROR' : String(vtex)

      console.log(cat.padEnd(20), c.name.padEnd(30), overpassStr.padStart(10), vtexStr.padStart(8))

      results.push({ cat, name: c.name, overpass, vtex })

      // Rate limit Overpass (max ~2 req/s para no banearnos)
      await new Promise(r => setTimeout(r, 600))
    }
  }

  console.log('\n─── Resumen ───')
  const good = results.filter(r => r.overpass >= 10 || r.vtex >= 5)
  const weak = results.filter(r => r.overpass < 10 && r.overpass >= 0 && r.vtex < 5)
  const missing = results.filter(r => r.overpass <= 0 && r.vtex <= 0)
  console.log(`Buena cobertura (Overpass≥10 o VTEX≥5): ${good.length}`)
  console.log(`Débil (datos pero pocos): ${weak.length}`)
  console.log(`Sin datos: ${missing.length}`)

  if (missing.length > 0) {
    console.log('\nSin datos — requieren scraper propio:')
    missing.forEach(r => console.log(`  - ${r.cat} / ${r.name}`))
  }
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })

/**
 * Abre Jumbo, Disco y Vea con Playwright, navega por categorías y subcategorías,
 * intercepta las respuestas de search-promotions y guarda el cache en DB.
 *
 * Uso local:  node scripts/refresh-vtex-sessions.js
 * En CI:      se ejecuta automáticamente via GitHub Actions día por medio.
 */

const { chromium } = require('playwright')

const API_URL = process.env.API_URL || 'http://localhost:3000'
const SECRET = process.env.VTEX_SESSION_SECRET

if (!SECRET) {
  console.error('ERROR: Falta VTEX_SESSION_SECRET')
  process.exit(1)
}

const SITES = [
  { host: 'www.jumbo.com.ar',  baseUrl: 'https://www.jumbo.com.ar' },
  { host: 'www.disco.com.ar',  baseUrl: 'https://www.disco.com.ar' },
  { host: 'www.vea.com.ar',    baseUrl: 'https://www.vea.com.ar' },
]

// Categorías y subcategorías de Cencosud (Jumbo/Disco/Vea comparten estructura VTEX)
const CATEGORIES = [
  // Bebidas
  'bebidas/aguas-sin-gas',
  'bebidas/aguas-con-gas-y-saborizadas',
  'bebidas/gaseosas',
  'bebidas/jugos-y-aguas-saborizadas',
  'bebidas/cervezas',
  'bebidas/vinos',
  'bebidas/espumantes-y-champagnes',
  'bebidas/bebidas-energizantes-e-isotonicas',
  'bebidas/sodas',
  // Almacén
  'almacen/aceites-y-vinagres',
  'almacen/arroces-y-legumbres',
  'almacen/pastas-y-fideos',
  'almacen/salsas-y-conservas',
  'almacen/azucar-y-edulcorantes',
  'almacen/cafe-te-e-infusiones',
  'almacen/yerba-mate',
  'almacen/galletitas-y-bizcochos',
  'almacen/chocolates-y-golosinas',
  'almacen/harinas-y-premezclas',
  'almacen/condimentos-y-aderezos',
  'almacen/snacks-y-papas-fritas',
  'almacen/sopas-caldos-y-pure',
  // Lácteos y frescos
  'lacteos-y-frescos/leches',
  'lacteos-y-frescos/yogures',
  'lacteos-y-frescos/quesos',
  'lacteos-y-frescos/mantecas-y-margarinas',
  'lacteos-y-frescos/cremas',
  'lacteos-y-frescos/huevos',
  'lacteos-y-frescos/fiambres',
  // Carnes
  'carnes-y-pescados/carnes-rojas',
  'carnes-y-pescados/pollo-y-aves',
  'carnes-y-pescados/embutidos-y-salchichas',
  'carnes-y-pescados/pescados-y-mariscos',
  // Panadería y congelados
  'panaderia-y-reposteria',
  'congelados/comidas-listas',
  'congelados/helados',
  'congelados/papas-y-vegetales',
  // Limpieza
  'limpieza/limpieza-del-hogar',
  'limpieza/lavandinas-y-desinfectantes',
  'limpieza/detergentes-y-jabon-en-polvo',
  'limpieza/suavizantes',
  'limpieza/papeles-y-descartables',
  'limpieza/bolsas-de-residuos',
  // Higiene personal
  'perfumeria-e-higiene/higiene-personal',
  'perfumeria-e-higiene/shampoo-y-acondicionador',
  'perfumeria-e-higiene/desodorantes',
  'perfumeria-e-higiene/jabones',
  'perfumeria-e-higiene/cremas-y-humectantes',
  // Bebés y mascotas
  'bebes/panales-y-toallitas',
  'bebes/alimentacion',
  'mascotas/perros',
  'mascotas/gatos',
]

async function collectPromosForSite({ host, baseUrl }) {
  const promos = {}
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
    })
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
    })
    const page = await context.newPage()

    // Interceptar todas las respuestas de search-promotions
    const pending = []
    page.on('response', (response) => {
      if (!response.url().includes('search-promotions')) return
      const p = response.json().then(data => {
        const allBuckets = data?.promotions || {}
        for (const bucket of Object.values(allBuckets)) {
          for (const [skuId, promo] of Object.entries(bucket?.promotions || {})) {
            if (promo?.effectiveDiscount && promo?.code) {
              promos[skuId] = {
                promoCode: promo.code.trim(),
                effectiveDiscount: parseFloat(promo.effectiveDiscount),
              }
            }
          }
        }
      }).catch(() => {})
      pending.push(p)
    })

    // Visitar la home primero para establecer la sesión
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Navegar por cada categoría/subcategoría
    for (const cat of CATEGORIES) {
      try {
        await page.goto(`${baseUrl}/${cat}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        })
        await page.waitForTimeout(6000)
        // Esperar que todos los handlers async terminen antes de navegar
        await Promise.all(pending.splice(0))
      } catch {
        // Timeout o error en una categoría — continuar con la siguiente
      }
    }

    console.log(`[${host}] ${Object.keys(promos).length} promos recolectadas`)
  } finally {
    await browser.close()
  }

  return promos
}

async function savePromos(site, promos) {
  const count = Object.keys(promos).length
  if (count === 0) return

  const res = await fetch(`${API_URL}/api/internal/vtex-promos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ site, promos }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[${site}] Error guardando promos: ${res.status} ${text}`)
  } else {
    const data = await res.json()
    console.log(`[${site}] Guardadas ${data.saved} promos en DB`)
  }
}

async function main() {
  console.log(`Recolectando promos de ${SITES.length} sitios (${SEARCH_TERMS.length} términos cada uno)...`)
  console.log('Esto puede tardar ~10 minutos.\n')

  for (const site of SITES) {
    console.log(`\n--- ${site.host} ---`)
    const promos = await collectPromosForSite(site)
    await savePromos(site.host, promos)
  }

  console.log('\n✅ Listo.')
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

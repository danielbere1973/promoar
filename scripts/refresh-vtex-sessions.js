/**
 * Abre Jumbo, Disco y Vea con Playwright, busca términos comunes,
 * intercepta las respuestas de search-promotions y guarda el cache en DB.
 *
 * Uso local:  node scripts/refresh-vtex-sessions.js
 * En CI:      se ejecuta automáticamente via GitHub Actions cada 4 horas.
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

// Términos que cubren los productos más buscados en supermercados
const SEARCH_TERMS = [
  'agua', 'soda', 'gaseosa', 'jugo', 'cerveza', 'vino', 'leche',
  'yogur', 'queso', 'manteca', 'crema', 'huevos',
  'yerba', 'cafe', 'aceite', 'arroz', 'azucar', 'fideos', 'harina',
  'galletitas', 'chocolate', 'helado', 'mermelada',
  'jamon', 'salchicha', 'pan', 'facturas',
  'detergente', 'lavandina', 'suavizante', 'papel higienico',
  'shampoo', 'jabon', 'desodorante',
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
    page.on('response', async (response) => {
      if (!response.url().includes('search-promotions')) return
      try {
        const data = await response.json()
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
      } catch {}
    })

    // Visitar la home primero para establecer la sesión
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    // Buscar cada término y esperar que el JS cargue las promos
    for (const term of SEARCH_TERMS) {
      try {
        await page.goto(`${baseUrl}/${encodeURIComponent(term)}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        })
        await page.waitForTimeout(6000)
      } catch {
        // Timeout o error en un término — continuar con el siguiente
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

/**
 * Intercepta las llamadas reales que hace el JS de Jumbo a search-promotions.
 * Uso: node scripts/test-vtex-promo.js
 */
const { chromium } = require('playwright')

const BASE_URL = 'https://www.jumbo.com.ar'
const SEARCH_QUERY = 'soda'

async function main() {
  console.log(`Abriendo Jumbo y buscando "${SEARCH_QUERY}"...`)
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  // Interceptar responses de search-promotions
  const captured = []
  page.on('response', async (response) => {
    if (response.url().includes('search-promotions')) {
      try {
        const body = await response.json()
        captured.push({ url: response.url(), body })
        console.log(`\n[Interceptado] ${response.url()}`)
        console.log(JSON.stringify(body).slice(0, 500))
      } catch {}
    }
  })

  await page.goto(`${BASE_URL}/${SEARCH_QUERY}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  console.log('Esperando que el JS cargue las promos...')
  await page.waitForTimeout(8000)

  if (captured.length === 0) {
    console.log('\nNo se interceptó ninguna llamada a search-promotions.')
    console.log('El sitio puede no llamar search-promotions en la página de búsqueda.')
  } else {
    console.log(`\nTotal interceptadas: ${captured.length} llamadas`)
  }

  await browser.close()
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

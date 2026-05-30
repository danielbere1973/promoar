/**
 * Corre un scraper Playwright localmente y envía las promos a la API de Vercel.
 * Uso: node scripts/run-playwright-scraper.js <scraper-id>
 * Ej:  node scripts/run-playwright-scraper.js santander
 */

const API_URL = process.env.API_URL || 'http://localhost:3000'
const SECRET = process.env.VTEX_SESSION_SECRET

if (!SECRET) {
  console.error('ERROR: Falta VTEX_SESSION_SECRET')
  process.exit(1)
}

const scraperId = process.argv[2]
if (!scraperId) {
  console.error('ERROR: Falta scraper ID. Uso: node run-playwright-scraper.js <scraper-id>')
  process.exit(1)
}

async function main() {
  // Importar dinámicamente el índice de scrapers compilado
  const { scrapers } = require('../.next/server/chunks/scrapers.js').catch
    ? require('../lib/scrapers')
    : require('../.next/server/chunks/scrapers.js')

  // Fallback: importar directo desde TypeScript compilado
  const scraperMap = scrapers || {}
  const scraper = scraperMap[scraperId.toLowerCase()]

  if (!scraper) {
    // Intentar importar el scraper directamente
    console.error(`Scraper "${scraperId}" no encontrado en el mapa`)
    process.exit(1)
  }

  console.log(`[${scraperId}] Corriendo scraper...`)
  const promos = await scraper.run()
  console.log(`[${scraperId}] ${promos.length} promos encontradas`)

  if (promos.length === 0) {
    console.log(`[${scraperId}] Sin promos, saliendo`)
    return
  }

  console.log(`[${scraperId}] Enviando a API...`)
  const res = await fetch(`${API_URL}/api/internal/save-promos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ scraperId: scraperId.toLowerCase(), promos }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[${scraperId}] Error: ${res.status} ${text}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`[${scraperId}] Guardadas ${data.processed}/${data.found} promos`)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

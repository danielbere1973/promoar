/**
 * Corre un scraper Playwright localmente y envía las promos a la API de Vercel.
 * Uso: npx tsx scripts/run-playwright-scraper.ts <scraper-id>
 * Ej:  npx tsx scripts/run-playwright-scraper.ts santander
 */

import { scrapers } from '../lib/scrapers'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const SECRET = process.env.VTEX_SESSION_SECRET

if (!SECRET) {
  console.error('ERROR: Falta VTEX_SESSION_SECRET')
  process.exit(1)
}

const scraperId = process.argv[2]?.toLowerCase()
if (!scraperId) {
  console.error('ERROR: Falta scraper ID. Uso: npx tsx scripts/run-playwright-scraper.ts <scraper-id>')
  process.exit(1)
}

const scraper = scrapers[scraperId]
if (!scraper) {
  console.error(`ERROR: Scraper "${scraperId}" no encontrado. Disponibles: ${Object.keys(scrapers).join(', ')}`)
  process.exit(1)
}

async function main() {
  console.log(`[${scraperId}] Corriendo scraper...`)
  const promos = await scraper.run()
  console.log(`[${scraperId}] ${promos.length} promos encontradas`)

  if (promos.length === 0) {
    console.log(`[${scraperId}] Sin promos, saliendo`)
    return
  }

  const BATCH_SIZE = 500
  let totalProcessed = 0
  let totalFound = 0
  const batches = Math.ceil(promos.length / BATCH_SIZE)

  for (let i = 0; i < promos.length; i += BATCH_SIZE) {
    const batch = promos.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`[${scraperId}] Enviando batch ${batchNum}/${batches} (${batch.length} promos)...`)

    const res = await fetch(`${API_URL}/api/internal/save-promos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ scraperId, promos: batch }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[${scraperId}] Error batch ${batchNum}: ${res.status} ${text}`)
      process.exit(1)
    }

    const data = await res.json()
    totalProcessed += data.processed ?? 0
    totalFound += data.found ?? batch.length
    console.log(`[${scraperId}] Batch ${batchNum}: ${data.processed}/${data.found} guardadas`)
  }

  console.log(`[${scraperId}] Total: ${totalProcessed}/${totalFound} promos guardadas`)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

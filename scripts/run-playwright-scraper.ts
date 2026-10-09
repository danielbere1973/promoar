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

// Reintenta en 429 (rate limit) y también en 500 (ej. timeout de pool de conexiones
// de Neon bajo carga — ver resumen-scrapers.md 9/10/2026) para que un error puntual
// de un batch no aborte toda la corrida y pierda los batches restantes ya scrapeados.
async function fetchWithRetry(url: string, options: RequestInit, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options)
    if ((res.status !== 429 && res.status !== 500) || i === retries - 1) return res
    console.log(`[${scraperId}] HTTP ${res.status} en ${url}, reintentando en ${Math.pow(2, i + 1)}s...`)
    await new Promise(r => setTimeout(r, Math.pow(2, i + 1) * 1000))
  }
  return fetch(url, options) // fallback to return a Response even if it fails
}

async function main() {
  console.log(`[${scraperId}] Corriendo scraper...`)
  
  // Registrar el inicio de la corrida
  const startRes = await fetchWithRetry(`${API_URL}/api/internal/scraper-runs/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
    body: JSON.stringify({ action: 'start', scraperId })
  })
  
  if (!startRes.ok) {
    console.error(`[${scraperId}] Error al registrar inicio de corrida: ${startRes.status}`)
    process.exit(1)
  }
  
  const { runId } = await startRes.json()
  
  let totalProcessed = 0
  let totalFound = 0
  let errorMsg = undefined

  try {
    const promos = await scraper.run()
    console.log(`[${scraperId}] ${promos.length} promos encontradas`)
    totalFound = promos.length

    if (promos.length > 0) {
      // Bajado de 500 a 200 (9/10/2026): cada batch grande mantiene la instancia
      // serverless de /api/admin/scrape viva más tiempo sosteniendo sus conexiones
      // de Prisma abiertas (hasta 10, ver DATABASE_URL connection_limit) — con 22
      // batches de 500 en una corrida de Macro, el pool terminaba saturado y
      // tirando "Timed out fetching a new connection from the connection pool" a
      // mitad de corrida (batch 15/22). Batches más chicos sueltan las conexiones
      // más seguido entre llamadas.
      const BATCH_SIZE = 200
      const batches = Math.ceil(promos.length / BATCH_SIZE)

      for (let i = 0; i < promos.length; i += BATCH_SIZE) {
        const batch = promos.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        console.log(`[${scraperId}] Enviando batch ${batchNum}/${batches} (${batch.length} promos)...`)

        const res = await fetchWithRetry(`${API_URL}/api/internal/save-promos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SECRET}`,
          },
          // Envía promos como están
          body: JSON.stringify({ scraperId, promos: batch }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(`Error batch ${batchNum}: ${res.status} ${text}`)
        }

        const data = await res.json()
        totalProcessed += data.processed ?? 0
        console.log(`[${scraperId}] Batch ${batchNum}: ${data.processed}/${data.found ?? batch.length} guardadas`)
      }
    } else {
      console.log(`[${scraperId}] Sin promos, finalizando corrida de todas formas.`)
    }
  } catch (e: any) {
    errorMsg = e.message
    console.error(`[${scraperId}] ERROR en la ejecución:`, errorMsg)
  }

  // Registrar el fin de la corrida (y disparar email)
  console.log(`[${scraperId}] Registrando fin de corrida y enviando reporte...`)
  await fetchWithRetry(`${API_URL}/api/internal/scraper-runs/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SECRET}` },
    body: JSON.stringify({ action: 'finish', runId, scraperId, found: totalFound, processed: totalProcessed, error: errorMsg })
  })

  console.log(`[${scraperId}] Total final: ${totalProcessed}/${totalFound} promos guardadas`)
  if (errorMsg) process.exit(1)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })

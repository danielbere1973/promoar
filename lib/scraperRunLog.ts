import fs from 'fs'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), 'scraper-runs.log')

export interface ScraperRunSummary {
  scraper: string
  found: number
  processed: number
  skippedUnchanged: number
  skippedNoCategory: number
  skippedNoCommerce: number
}

export function logScraperRun(summary: ScraperRunSummary) {
  try {
    const line = JSON.stringify({ date: new Date().toISOString(), ...summary })
    fs.appendFileSync(LOG_PATH, line + '\n')
  } catch (e) {
    console.error('[scraperRunLog] Error escribiendo log:', e)
  }
}

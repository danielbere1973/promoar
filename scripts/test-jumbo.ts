import { JumboScraper } from '../lib/scrapers/jumbo'

async function main() {
  console.log('Probando Jumbo scraper...')
  const promos = await JumboScraper.run()
  console.log(`\nTotal promos: ${promos.length}`)
  if (promos.length > 0) console.log('Primera promo:', JSON.stringify(promos[0], null, 2))
}

main().catch(console.error)

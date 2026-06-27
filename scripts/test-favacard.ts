import { FavacardScraper } from '../lib/scrapers/favacard'

async function main() {
  const promos = await FavacardScraper.run()
  console.log('\n=== RESULTADO ===')
  console.log('Total promos:', promos.length)

  if (promos[0]) {
    console.log('\nEjemplo promo #1:')
    console.log(JSON.stringify(promos[0], null, 2))
  }

  if (promos[50]) {
    console.log('\nEjemplo promo #50:')
    console.log(JSON.stringify(promos[50], null, 2))
  }

  const types = [...new Set(promos.map(p => p.discountType))].sort()
  const cats  = [...new Set(promos.map(p => p.categoria))].sort()
  const days  = [...new Set(promos.map(p => p.validDays))].sort((a, b) => (a ?? 0) - (b ?? 0))

  console.log('\nTipos de descuento:', types)
  console.log('Categorías:', cats)
  console.log('validDays encontrados:', days)
  console.log('Con cap:', promos.filter(p => p.cap).length)
}

main().catch(console.error)

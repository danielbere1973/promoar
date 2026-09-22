import { SantanderScraper } from '../lib/scrapers/santander';

async function run() {
  console.log('Testeando SANTANDER...');
  const promos = await SantanderScraper.run();
  console.log(`\nEncontradas ${promos.length} promos. Mostrando 10 primeras:\n`);
  for (const p of promos.slice(0, 10)) {
    console.log(`[${p.bankNames?.[0]}] ${p.discountType} ${p.discount} | "${p.title?.slice(0, 70)}" | dias=${p.validDays} | cap=${p.cap} | cat=${p.categoria} | sourceUrl=${p.sourceUrl}`);
  }
}

run().catch(console.error);

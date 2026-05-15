import { JumboScraper } from './jumbo';

async function run() {
  console.log('Testeando JUMBO...');
  const promos = await JumboScraper.run();
  console.log(`\nEncontradas ${promos.length} promos. Mostrando todas:\n`);
  for (const p of promos) {
    console.log(`[${p.bankNames?.[0]}] ${p.discountType} ${p.discount} | "${p.title?.slice(0, 70)}" | dias=${p.validDays} | cap=${p.cap} capTarget=${p.capTarget} | cardType=${p.cardType} | channel=${p.paymentChannel} | account=${p.accountType}`);
  }
}

run().catch(console.error);

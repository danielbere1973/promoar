// npx tsx scripts/test-cabal.ts
import { CabalScraper } from '../lib/scrapers/cabal';

(async () => {
  const promos = await CabalScraper.run();
  console.log('\n═══ RESULTADO ═══');
  console.log(`Total promos: ${promos.length}`);
  promos.forEach((p, i) => {
    console.log(`\n[${i + 1}] ${p.title}`);
    console.log(`    storeName:  ${p.storeName}`);
    console.log(`    discount:   ${p.discount} (${p.discountType})`);
    console.log(`    validDays:  ${p.validDays} (${p.validDays === 127 ? 'todos' : 'específicos'})`);
    console.log(`    networks:   ${p.cardNetworks?.map(n => n.network).join(', ')}`);
    console.log(`    wallets:    ${p.walletNames?.join(', ') ?? '—'}`);
    console.log(`    categoria:  ${p.categoria}`);
  });
})();

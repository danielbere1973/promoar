// npx tsx scripts/test-amex.ts
import { AmexScraper } from '../lib/scrapers/amex';

(async () => {
  const promos = await AmexScraper.run();
  console.log('\n═══ RESULTADO ═══');
  console.log(`Total promos: ${promos.length}`);
  promos.forEach((p, i) => {
    console.log(`\n[${i + 1}] ${p.title}`);
    console.log(`    storeName:  ${p.storeName}`);
    console.log(`    discount:   ${p.discount} (${p.discountType})`);
    console.log(`    cardTier:   ${p.cardTier ?? 'null (todas)'}`);
    console.log(`    validDays:  ${p.validDays} (${p.validDays === 127 ? 'todos' : 'específicos'})`);
    console.log(`    categoria:  ${p.categoria}`);
  });
})();

// npx tsx scripts/test-naranjax.ts
import { NaranjaXScraper } from '../lib/scrapers/naranjax';

(async () => {
  const promos = await NaranjaXScraper.run();
  console.log('\n═══ RESULTADO ═══');
  console.log(`Total promos: ${promos.length}`);
  promos.forEach((p, i) => {
    console.log(`\n[${i + 1}] ${p.title}`);
    console.log(`    storeName:  ${p.storeName}`);
    console.log(`    discount:   ${p.discount} (${p.discountType})`);
    console.log(`    cardType:   ${p.cardType ?? 'null (ambos)'}`);
    console.log(`    validDays:  ${p.validDays} (${p.validDays === 127 ? 'todos' : 'específicos'})`);
    console.log(`    categoria:  ${p.categoria}`);
    if (p.cap) console.log(`    cap:        $${p.cap} ${p.capPeriod}`);
  });
})();

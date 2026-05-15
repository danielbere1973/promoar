// Corre con: npx tsx scripts/test-visa.ts
import { VisaScraper } from '../lib/scrapers/visa';

(async () => {
  const promos = await VisaScraper.run();
  console.log('\n═══ RESULTADO ═══');
  console.log(`Total promos: ${promos.length}`);
  if (promos.length > 0) {
    console.log('\nPrimeras 10:');
    promos.slice(0, 10).forEach((p, i) => {
      console.log(`\n[${i + 1}] ${p.title}`);
      console.log(`    storeName:   ${p.storeName}`);
      console.log(`    discount:    ${p.discount} (${p.discountType})`);
      console.log(`    cardTier:    ${p.cardTier ?? 'null (todos)'}`);
      console.log(`    categoria:   ${p.categoria}`);
      console.log(`    validFrom:   ${p.validFrom ?? '—'} → ${p.validUntil ?? '—'}`);
    });
    const tiers = Array.from(new Set(promos.map(p => p.cardTier ?? 'null')));
    console.log(`\nTiers encontrados: ${tiers.join(', ')}`);
    const stores = Array.from(new Set(promos.map(p => p.storeName))).slice(0, 20);
    console.log(`\nPrimeros 20 comercios: ${stores.join(', ')}`);
  } else {
    console.log('\n⚠ Sin promos. Ver logs arriba para diagnóstico.');
  }
})();

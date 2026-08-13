// npx tsx scripts/test-clublanacion-ypf.ts
// Test puntual: extrae los benefit-cards de la página YPF (A10677) y arma los
// ScrapedPromo resultantes, SIN escribir a la DB — solo para validar la extracción
// y clasificación antes de correr el scraper completo contra /api/admin/scrape.
import { fetchDetailWithCards, buildPromosForItem } from '../lib/scrapers/clublanacion';

const YPF_SLUG = '/automovil/combustible/descuentos-en-ypf-A10677';

(async () => {
  const { detail, cards } = await fetchDetailWithCards(YPF_SLUG);
  console.log(`\n═══ CARDS EXTRAÍDAS: ${cards.length} ═══`);
  cards.forEach((c, i) => {
    console.log(`\n[card ${i + 1}] id=${c.benefitId}`);
    console.log(`  benefitType: ${c.benefitType}`);
    console.log(`  benefitTitle: ${c.benefitTitle}`);
    console.log(`  scopedText: ${c.scopedText.slice(0, 150)}`);
    console.log(`  validDays: ${c.validDays}`);
  });

  const item = {
    slug: YPF_SLUG,
    name: 'YPF',
    discountType: cards[0]?.benefitType || '0%',
    logoUrl: undefined,
    categorySlug: 'combustible',
    ecommerce: false,
  };

  const promos = buildPromosForItem(item, detail, cards);
  console.log(`\n═══ SCRAPEDPROMOS RESULTANTES: ${promos.length} ═══`);
  promos.forEach((p, i) => {
    console.log(`\n[${i + 1}] ${p.title}`);
    console.log(`    categoria:   ${p.categoria}`);
    console.log(`    discount:    ${p.discount} (${p.discountType})`);
    console.log(`    source:      ${p.source}`);
    console.log(`    externalId:  ${p.externalId}`);
    console.log(`    sourceUrl:   ${p.sourceUrl}`);
    console.log(`    validDays:   ${p.validDays}`);
  });
})();

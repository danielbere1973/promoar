// npx tsx scripts/run-clublanacion-ypf.ts
// Corre el pipeline real de guardado (POST /api/admin/scrape con preScrapedPromos) para
// las 3 promos YPF (A10677) de Club La Nación, llamando directamente al handler exportado
// (sin pasar por HTTP/middleware — el handler no tiene auth check propio).
import { fetchDetailWithCards, buildPromosForItem } from '../lib/scrapers/clublanacion';
import { POST } from '../app/api/admin/scrape/route';
import { NextRequest } from 'next/server';

const YPF_SLUG = '/automovil/combustible/descuentos-en-ypf-A10677';

(async () => {
  const { detail, cards } = await fetchDetailWithCards(YPF_SLUG);
  const item = {
    slug: YPF_SLUG,
    name: 'YPF',
    discountType: cards[0]?.benefitType || '0%',
    logoUrl: undefined,
    categorySlug: 'combustible',
    ecommerce: false,
  };
  const promos = buildPromosForItem(item, detail, cards);
  console.log(`Enviando ${promos.length} promos al handler...`);

  const req = new NextRequest('http://localhost/api/admin/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promos }),
  });

  const res = await POST(req);
  const json = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
})();

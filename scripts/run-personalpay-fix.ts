// npx tsx scripts/run-personalpay-fix.ts
// Corre el scraper de Personal Pay completo y lo envía al pipeline real de guardado
// (POST /api/admin/scrape), llamando directamente al handler exportado (sin HTTP/middleware).
// Motivo: fix del 1/9/2026 en lib/scrapers/personalpay.ts — el título no incluía item.name
// (variante de producto/porción), lo que colisionaba beneficios distintos del mismo comercio
// bajo el mismo título y perdía silenciosamente ~28 promos (Freddo, McDonald's, Mostaza, etc.)
import { PersonalPayScraper } from '../lib/scrapers/personalpay';
import { POST } from '../app/api/admin/scrape/route';
import { NextRequest } from 'next/server';

(async () => {
  const promos = await PersonalPayScraper.run();
  console.log(`Enviando ${promos.length} promos al handler...`);

  const req = new NextRequest('http://localhost/api/admin/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ promos, scraper: 'Personal Pay' }),
  });

  const res = await POST(req);
  const json = await res.json();
  console.log(`Status: ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
})();

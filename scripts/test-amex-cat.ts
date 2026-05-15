// npx tsx scripts/test-amex-cat.ts
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());
  await page.goto('https://www.americanexpress.com/es-ar/beneficios/promociones/categoria/restaurantes/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  const info = await page.evaluate(() => {
    const counts: Record<string, number> = {};
    for (const sel of ['[class*="promo"]', '[class*="benefit"]', '[class*="card"]', '[class*="tile"]', 'article', '[class*="oferta"]', '[class*="deal"]']) {
      counts[sel] = document.querySelectorAll(sel).length;
    }
    const contenedor = Array.from(document.querySelectorAll('.contenedor-promociones'))
      .map(e => (e as HTMLElement).innerText.slice(0, 150));

    // Buscar elementos con texto de descuento que sean hojas
    const withDiscount = Array.from(document.querySelectorAll('*'))
      .filter(e => /\d+%|reintegro|cuotas\s+sin/i.test((e as HTMLElement).innerText ?? '') && (e as HTMLElement).children.length < 5)
      .slice(0, 8)
      .map(e => ({ tag: e.tagName, cls: e.className?.toString().slice(0, 70), text: (e as HTMLElement).innerText.slice(0, 200) }));

    const bodySlice = document.body.innerText.slice(0, 2000);
    return { counts, contenedor, withDiscount, bodySlice };
  });

  console.log('Counts:', info.counts);
  console.log('\ncontenedor-promociones:', info.contenedor);
  console.log('\nElements with discount:', JSON.stringify(info.withDiscount, null, 2));
  console.log('\nBody (2000):\n', info.bodySlice);
  await browser.close();
})();

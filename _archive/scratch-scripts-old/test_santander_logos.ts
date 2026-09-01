import { chromium } from 'playwright';

const PAGE_URL = `https://www.santander.com.ar/personas/beneficios#/results?category-code=SUP`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('bff-benefits/brands')) {
        try {
            const json = await res.json();
            console.log('--- BFF RESPONSE ---');
            if (json.items) {
                json.items.forEach((item: any) => {
                    const brand = item.brands?.[0] || item;
                    console.log(`Name: ${brand.name}`);
                    console.log(`- Images:`, item.images || brand.images);
                });
            }
        } catch (e) {}
    }
  });

  console.log('Navigating...');
  await page.goto(PAGE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await browser.close();
}

main();

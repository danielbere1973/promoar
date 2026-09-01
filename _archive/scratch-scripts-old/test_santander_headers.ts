import { chromium } from 'playwright';

const PAGE_URL = `https://www.santander.com.ar/personas/beneficios#/results?category-code=SUP`;

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let captured = false;
  page.on('request', req => {
    if (req.url().includes('bff-benefits/brands') && !captured) {
      captured = true;
      console.log('HEADERS:', req.headers());
    }
  });

  await page.goto(PAGE_URL);
  await page.waitForTimeout(5000);
  await browser.close();
}

main();

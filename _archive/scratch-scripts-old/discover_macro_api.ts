
import { chromium } from 'playwright';

async function discover() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navegando a Macro...');
  
  page.on('request', req => {
    const url = req.url();
    if (url.includes('macro.com.ar') && url.includes('api')) {
      console.log(`[REQ] ${req.method()} ${url}`);
      // console.log('Headers:', JSON.stringify(req.headers(), null, 2));
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('macro.com.ar') && url.includes('api')) {
      console.log(`[RES] ${res.status()} ${url}`);
      try {
        const json = await res.json();
        console.log(`[DATA] Keys: ${Object.keys(json).join(', ')}`);
        if (json.promotions) console.log(`[DATA] Promociones encontradas: ${json.promotions.length}`);
      } catch (e) {
        // console.log('[DATA] No es JSON');
      }
    }
  });

  await page.goto('https://www.macro.com.ar/beneficios', { waitUntil: 'networkidle' });
  
  // Esperar un poco para ver si hay carga diferida
  await page.waitForTimeout(5000);
  
  await browser.close();
}

discover().catch(console.error);

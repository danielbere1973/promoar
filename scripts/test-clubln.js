// Test more detail structure
const cheerio = require('cheerio');

fetch('https://club.lanacion.com.ar/beneficios/deco-y-hogar/tiendas/descuentos-en-pewen-A05426258', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}).then(r => r.text()).then(html => {
  const $ = cheerio.load(html);

  // Find the discount
  const discountEl = $('[class*="benefit-type"]').first();
  console.log('benefit-type:', discountEl.text().trim());

  // Find the title and description
  const titleEl = $('[class*="benefit-title"]').first();
  console.log('benefit-title children:');
  titleEl.children().each((i, el) => {
    const tag = el.tagName;
    const text = $(el).text().trim();
    console.log(`  [${i}] <${tag}>: ${text.substring(0, 100)}`);
  });

  // Parse condition items - take only unique labels (avoid desktop+mobile duplication)
  const conditions = {};
  $('[class*="condition-item"]').each((i, el) => {
    const full = $(el).text().replace(/\s+/g, ' ').trim();
    // Known labels - extract them
    const labels = ['credenciales que aplica', '¿Qué necesito?', 'Días que aplica', 'Modalidad de compra', 'Sucursales adheridas', 'Vigencia', 'Legales'];
    for (const label of labels) {
      if (full.toLowerCase().startsWith(label.toLowerCase()) && !conditions[label]) {
        conditions[label] = full.substring(label.length).trim();
      }
    }
  });
  console.log('\n=== Parsed conditions ===');
  console.log(JSON.stringify(conditions, null, 2));

  // Check for __PRELOADED_STATE__
  const stateMatch = html.match(/__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (stateMatch) {
    console.log('\n=== PRELOADED_STATE snippet ===');
    console.log(stateMatch[1].substring(0, 500));
  }

  // API list test
  return fetch('https://api-clubv2.lanacion.com.ar/v2/accounts?includeFilters=true&sort=relevance&size=5&page=1', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
}).then(r => r.json()).then(data => {
  console.log('\n=== API structure ===');
  console.log('Total:', data.meta?.total);
  console.log('First item:', JSON.stringify(data.data?.[0], null, 2));
}).catch(e => console.error(e.message));

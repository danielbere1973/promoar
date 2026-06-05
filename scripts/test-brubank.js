const cheerio = require('cheerio');

async function test() {
  const html = await fetch('https://www.brubank.com/beneficios', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }).then(r => r.text());

  const $ = cheerio.load(html);

  // Test the exact same logic as the scraper on first card-promo-dark
  const firstCard = $('.card-promo-dark').not('[class*="wrapper"]').first();
  console.log('First card class:', firstCard.attr('class'));
  console.log('First card HTML (500):', firstCard.html()?.substring(0, 500));

  // Test wrapper selector
  const wrapper = firstCard.find('[class*="card-promo-wrapper"]');
  console.log('\nWrapper found:', wrapper.length, '| class:', wrapper.attr('class'));
  console.log('Wrapper HTML (300):', wrapper.html()?.substring(0, 300));

  // Try direct children of card
  console.log('\nDirect children of card:');
  firstCard.children().each((i, el) => {
    const cls = $(el).attr('class') || '';
    const text = $(el).text().replace(/‍/g, '').trim().replace(/\s+/g, ' ').substring(0, 100);
    console.log(`  [${i}] <${el.tagName} class="${cls}">: ${text}`);
  });

  // Try getting all text leaf nodes
  console.log('\nAll leaf text nodes in first card:');
  firstCard.find('*').each((i, el) => {
    const t = $(el).clone().children().remove().end().text().replace(/‍/g, '').trim().replace(/\s+/g, ' ');
    if (t && t.length > 1 && t !== '›') {
      console.log(`  [${i}] <${el.tagName} class="${$(el).attr('class') || ''}">: ${t}`);
    }
  });
}
test().catch(console.error);

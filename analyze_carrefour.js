const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('carrefour_dump.html', 'utf8');
const $ = cheerio.load(html);

const el = $('*:contains("20% de descuento en un pago con")').last();
// Print path of classes
console.log(el.parents().map((i, e) => e.tagName + '.' + ($(e).attr('class') || '').replace(/\s+/g, '.')).get().join('\n'));

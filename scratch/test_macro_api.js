
const fetch = require('node-fetch');

async function testMacroAPI() {
  const listCode = 'beneficios-mb';
  const baseUrl = 'https://apipublic.macro.com.ar/v1/card-benefits/provinces/AR-0';
  
  console.log('Fetching Macro promos...');
  
  try {
    const url = `${baseUrl}?list-code=${listCode}&offset=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.macro.com.ar/'
      }
    });
    
    if (!res.ok) {
      console.log('Error HTTP:', res.status);
      return;
    }
    
    const json = await res.json();
    console.log('Total Records:', json.pagination?.['total-records']);
    console.log('First promo sample:', JSON.stringify(json.promotions?.[0], null, 2));
    
  } catch (err) {
    console.error('Error:', err);
  }
}

testMacroAPI();

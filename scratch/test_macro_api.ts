import axios from 'axios';

async function testMacro() {
  const url = 'https://apipublic.macro.com.ar/v1/card-benefits/provinces/AR-0?list-code=beneficios-mb&offset=1';
  const headers = {
    'x-client-id': 'xoQHgmQk50pnZtGXLOxHowzjBEl4z0E7677knlgnD4iEL6sm',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  };

  try {
    const res = await axios.get(url, { headers });
    console.log('Status:', res.status);
    console.log('Data (first 2 items):', JSON.stringify(res.data.promotions?.slice(0, 2), null, 2));
    console.log('Total items reported:', res.data.total);
  } catch (e: any) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}

testMacro();

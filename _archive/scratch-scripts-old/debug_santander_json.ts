import axios from 'axios';

async function debugSantander() {
  const brandId = 2680; // Decathlon
  const url = `https://www.santander.com.ar/bff-benefits/brands/${brandId}`;
  
  try {
    const res = await axios.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      }
    });
    
    console.log('Brand Data:', JSON.stringify(res.data, null, 2));
  } catch (e: any) {
    console.error('Error:', e.response?.status, e.message);
  }
}

debugSantander();

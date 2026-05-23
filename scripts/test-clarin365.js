async function test() {
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://365.clarin.com/buscar' };
  const base = 'https://365.clarin.com/api/v1';

  // Test pagination params
  const tests = [
    `${base}/search/companies?limit=5&offset=5`,
    `${base}/search/companies?limit=5&from=5`,
    `${base}/search/companies?limit=5&skip=5`,
    `${base}/search/companies?limit=5&start=5`,
    `${base}/search/companies?limit=1000`,
  ];

  for (const url of tests) {
    const res = await fetch(url, { headers });
    const data = await res.json().catch(() => ({}));
    const firstId = data.items?.[0]?.id;
    const total = data.total;
    const count = data.items?.length;
    console.log(`${res.status} | ${url.split('?')[1]} → total:${total} count:${count} firstId:${firstId}`);
  }
}
test().catch(console.error);

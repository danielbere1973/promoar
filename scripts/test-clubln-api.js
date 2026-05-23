async function test() {
  // Base URL works
  const base = await fetch('https://api-clubv2.lanacion.com.ar/v2/accounts?includeFilters=true&sort=relevance&size=3&page=1', {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  }).then(r => r.json());
  console.log('Base total:', base.meta?.total, '| First:', base.data?.[0]?.slug?.split('/')[1]);
  console.log('Available filters:', JSON.stringify(base.meta?.appliedFilters || base.filters || base.meta).substring(0, 300));

  // Test category filter
  const params = ['category=gastronomia', 'categories=gastronomia', 'filter=gastronomia', 'categorySlug=gastronomia'];
  for (const p of params) {
    const d = await fetch(`https://api-clubv2.lanacion.com.ar/v2/accounts?includeFilters=true&sort=relevance&size=3&page=1&${p}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }).then(r => r.json()).catch(e => ({ error: e.message }));
    const firstCat = d.data?.[0]?.slug?.split('/')[1];
    console.log(`${p} → total: ${d.meta?.total ?? d.error}, first cat: ${firstCat}`);
  }
}
test().catch(console.error);

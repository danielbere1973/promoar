const { GaliciaScraper } = require('../lib/scrapers/galicia');

async function testGaliciaLogos() {
  const promos = await GaliciaScraper.run();
  console.log('--- Sample Promos with Logos ---');
  promos.slice(0, 10).forEach((p: any) => {
    console.log(`Promo: ${p.title}`);
    console.log(`Store: ${p.storeName}`);
    console.log(`Logo: ${p.storeLogoUrl}`);
    console.log('---');
  });
}

testGaliciaLogos();

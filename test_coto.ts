import { CotoScraper } from './lib/scrapers/coto';

async function test() {
  console.log("Testing Coto Scraper...");
  try {
    const promos = await CotoScraper.run();
    const withMin = promos.filter(p => p.minPurchase !== undefined);
    console.log(`Found ${promos.length} promos.`);
    console.log(`Found ${withMin.length} promos with minPurchase.`);
    
    withMin.slice(0, 5).forEach(p => {
      console.log(`- ${p.title}: Min $${p.minPurchase}`);
    });
    
    // Check specific Wednesday case if possible
    const wednesdays = promos.filter(p => p.validDays !== undefined && (p.validDays & (1 << 3)));
    console.log(`Found ${wednesdays.length} Wednesday promos.`);
    wednesdays.forEach(p => {
        if (p.minPurchase) {
            console.log(`  [WED] ${p.title}: Min $${p.minPurchase}`);
        }
    });

  } catch (err) {
    console.error(err);
  }
}

test();

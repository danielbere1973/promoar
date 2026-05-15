import { SantanderScraper } from '../lib/scrapers/santander';

async function test() {
    const promos = await SantanderScraper.run();
    console.log(`Total promos: ${promos.length}`);
    const withLogo = promos.filter(p => p.storeLogoUrl);
    console.log(`Promos with logo: ${withLogo.length}`);
    
    console.log('Sample Logos:');
    withLogo.slice(0, 10).forEach(p => {
        console.log(`- ${p.storeName}: ${p.storeLogoUrl}`);
    });
}

test();

import { ModoScraper } from './lib/scrapers/modo';

async function main() {
  console.log('Scrapeando MODO (supermercados)...\n');
  const promos = await ModoScraper.run('Supermercados');

  promos.forEach((p, i) => {
    const bancos = Array.isArray(p.bankNames)
      ? (p.bankNames as any[]).map((b: any) => typeof b === 'string' ? b : `${b.name} (BCRA:${b.bcraCode})`).join(', ')
      : '(ninguno)';

    const redes = Array.isArray(p.cardNetworks)
      ? (p.cardNetworks as any[]).map((cn: any) => `${cn.network} ${cn.type ?? ''}`).join(', ')
      : '(ninguna)';

    console.log(`─── [${i + 1}] ${p.title}`);
    console.log(`    Comercio    : ${p.storeName}`);
    console.log(`    Bancos      : ${bancos}`);
    console.log(`    Redes       : ${redes}`);
    console.log(`    Canal       : ${p.paymentChannel}`);
    console.log(`    Descuento   : ${p.discount}% (${p.discountType})`);
    console.log();
  });

  const sinBanco = promos.filter(p => !p.bankNames || (p.bankNames as any[]).length === 0);
  const sinRed   = promos.filter(p => !p.cardNetworks || (p.cardNetworks as any[]).length === 0);

  console.log('═══ RESUMEN ═══');
  console.log(`Total promos    : ${promos.length}`);
  console.log(`Sin banco       : ${sinBanco.length}`);
  console.log(`Sin red tarjeta : ${sinRed.length}`);
  if (sinBanco.length) {
    console.log('\n── Sin banco:');
    sinBanco.forEach(p => console.log(`  • ${p.title}`));
  }
}

main().catch(console.error);

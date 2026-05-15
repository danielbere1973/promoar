require('ts-node').register({
  compilerOptions: {
    module: 'CommonJS',
    target: 'ES2020',
    esModuleInterop: true
  }
});

// Importamos el scraper directamente
const { BancoCiudadScraper } = require('./lib/scrapers/bancociudad');
const { prisma } = require('./lib/prisma');
const { buildPromos } = require('./lib/scrapers/bank-helpers');

async function run() {
  console.log("Corriendo scraper de Banco Ciudad (Modo Fix)...");
  const promos = await BancoCiudadScraper.run();
  console.log(`Scraper terminó. ${promos.length} encontradas.`);

  const categories = await prisma.category.findMany();
  const banks = await prisma.bank.findMany();
  const wallets = await prisma.wallet.findMany();
  const commerces = await prisma.commerce.findMany();

  let processedCount = 0;

  for (const p of promos) {
    if (!p.title || !p.discount) continue;

    const catMatch = categories.find(c => c.name.toLowerCase() === p.categoria?.toLowerCase());
    if (!catMatch) continue;

    const comMatch = commerces.find(cl => cl.name.toLowerCase() === p.storeName?.toLowerCase());
    if (!comMatch) continue;

    const walletNamesArr = p.walletNames || [];
    const resolvedWalletIds = walletNamesArr.map(wn => {
      const match = wallets.find(w => w.name.toLowerCase() === wn.toLowerCase());
      return match ? match.id : null;
    }).filter(Boolean);
    if (resolvedWalletIds.length === 0) resolvedWalletIds.push(null);

    const bankId = banks.find(b => b.name === 'Banco Ciudad')?.id;

    // Redes de tarjetas
    const networks = p.cardNetworks && p.cardNetworks.length > 0 
      ? p.cardNetworks 
      : [{ network: null, type: p.cardType || null }];

    // Si hay nombres de tarjetas en walletNames (error común de la API del Ciudad), los sumamos a networks
    walletNamesArr.forEach(wn => {
      const w = wn.toUpperCase();
      if (w.includes('VISA') || w.includes('MAESTRO') || w.includes('MASTER')) {
        let netName = w.includes('VISA') ? 'Visa' : w.includes('MAESTRO') ? 'Maestro' : 'Mastercard';
        if (!networks.find(n => n.network === netName)) {
          networks.push({ network: netName, type: w.includes('DEBITO') || w.includes('MAESTRO') ? 'DEBIT' : null });
        }
      }
    });

    console.log(`  - Procesando ${resolvedWalletIds.length} wallets y ${networks.length} redes de tarjetas para "${p.title}"`);

    const reqData = [];
    for (const wId of resolvedWalletIds) {
      for (const netInfo of networks) {
        let cardNetworkId = null;
        if (netInfo.network) {
          const typeSuffix = netInfo.type === 'CREDIT' ? ' crédito' : netInfo.type === 'DEBIT' ? ' débito' : netInfo.type === 'PREPAID' ? ' prepaga' : '';
          const fullName = (netInfo.network + typeSuffix).toLowerCase();
          const netMatch = await prisma.cardNetwork.findFirst({ 
            where: { name: { equals: fullName, mode: 'insensitive' } } 
          }) ?? await prisma.cardNetwork.findFirst({ 
            where: { name: { equals: netInfo.network, mode: 'insensitive' } } 
          });
          cardNetworkId = netMatch?.id || null;
          if (netMatch) console.log(`    - Tarjeta detectada: ${netMatch.name}`);
        }

        reqData.push({
          bankId,
          walletId: wId,
          cardNetworkId,
          cardType: netInfo.type ?? null,
          paymentChannel: p.paymentChannel || 'ANY',
          discountType: p.discountType || 'PERCENTAGE_REINTEGRO',
          discountValue: parseFloat(p.discount),
        });
      }
    }

    const promoData = {
      title: p.title,
      description: p.description || '',
      validFrom: p.validFrom ? new Date(p.validFrom) : new Date(),
      validUntil: p.validUntil ? new Date(p.validUntil) : null,
      categoryId: catMatch.id,
      commerceId: comMatch.id,
      status: 'ACTIVE',
      sourceUrl: p.sourceUrl || '',
    };

    const existing = await prisma.promo.findFirst({ where: { title: p.title, commerceId: comMatch.id } });

    if (existing) {
      await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
      await prisma.promo.update({
        where: { id: existing.id },
        data: { ...promoData, requirements: { create: reqData } },
      });
    } else {
      await prisma.promo.create({
        data: { ...promoData, requirements: { create: reqData } },
      });
    }
    processedCount++;
  }
  console.log(`Ingesta finalizada: ${processedCount} promos guardadas.`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

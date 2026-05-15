const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugCebra() {
  const promo = await prisma.promo.findFirst({
    where: { title: { contains: 'Cebra' }, bankId: undefined }, // Buscamos la de Ciudad
    include: { commerce: true }
  });

  if (!promo) {
    console.log("No se encontró la promo de Cebra.");
    return;
  }

  console.log(`Promo encontrada: ${promo.title} (ID: ${promo.id})`);
  console.log(`Descripción: ${promo.description}`);

  // Simulamos la extracción
  const { extractCardNetworks, extractWallets } = require('./lib/scrapers/bank-helpers');
  const networks = extractCardNetworks(promo.description);
  const wallets = extractWallets(promo.description);

  console.log("Redes detectadas:", JSON.stringify(networks));
  console.log("Wallets detectadas:", JSON.stringify(wallets));

  for (const netInfo of networks) {
    const netMatch = netInfo.network 
      ? (await prisma.cardNetwork.findFirst({ where: { name: { contains: netInfo.network, mode: 'insensitive' } } }))
      : null;
    console.log(`Buscando red "${netInfo.network}" -> Resultado: ${netMatch ? netMatch.name : 'NO ENCONTRADA'}`);
  }
}

debugCebra().finally(() => prisma.$disconnect());

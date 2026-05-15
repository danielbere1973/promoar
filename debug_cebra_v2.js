const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normStr(s) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractCardNetworks(text) {
  const t = normStr(text);
  const isCredit = /CREDITO/.test(t);
  const isDebit  = /DEBITO/.test(t);
  const cardType = isCredit && !isDebit ? 'CREDIT' : isDebit && !isCredit ? 'DEBIT' : null;

  const networks = [];
  if (/VISA/.test(t)) networks.push({ network: 'Visa', type: cardType });
  if (/MASTER/.test(t)) networks.push({ network: 'Mastercard', type: cardType });
  if (/AMEX|AMERICAN/.test(t)) networks.push({ network: 'American Express', type: cardType });
  if (/NARANJA/.test(t)) networks.push({ network: 'Naranja', type: cardType });
  if (/CABAL/.test(t)) networks.push({ network: 'Cabal', type: cardType });
  if (/MAESTRO/.test(t)) networks.push({ network: 'Maestro', type: 'DEBIT' });
  return networks;
}

async function debugCebra() {
  const promo = await prisma.promo.findFirst({
    where: { title: { contains: 'Cebra' }, sourceUrl: { contains: 'bancociudad' } },
    include: { commerce: true }
  });

  if (!promo) {
    console.log("No se encontró la promo de Cebra del Ciudad.");
    return;
  }

  console.log(`Promo encontrada: ${promo.title} (ID: ${promo.id})`);
  const networks = extractCardNetworks(promo.description);
  console.log("Redes detectadas:", JSON.stringify(networks));

  for (const netInfo of networks) {
    const netMatch = await prisma.cardNetwork.findFirst({ 
      where: { name: { contains: netInfo.network, mode: 'insensitive' } } 
    });
    console.log(`Buscando red "${netInfo.network}" -> Resultado: ${netMatch ? netMatch.name : 'NO ENCONTRADA'}`);
  }
}

debugCebra().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.promoRequirement.findMany({
    where: { paymentChannel: 'NFC' },
    include: { promo: true }
  });
  const re = /NFC|CONTACTLESS|SIN\s+CONTACTO|APPLE\s+PAY|GOOGLE\s+PAY|\bTAP\b/g;
  reqs.slice(0, 5).forEach(r => {
    const t = r.promo.sourceText.toUpperCase();
    const match = t.match(re);
    console.log(`Promo ID: ${r.promoId}, Matches: ${match}`);
  });
}

main().finally(() => prisma.$disconnect());

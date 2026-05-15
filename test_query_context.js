const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promo = await prisma.promoRequirement.findFirst({
    where: { paymentChannel: 'NFC' },
    include: { promo: true }
  });
  const text = promo.promo.sourceText.toUpperCase();
  const index = text.indexOf('NFC');
  console.log("Context:", text.substring(index - 30, index + 30).replace(/\n/g, ' '));
}

main().finally(() => prisma.$disconnect());

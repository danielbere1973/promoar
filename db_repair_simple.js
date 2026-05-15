const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cotoReqs = await prisma.promoRequirement.updateMany({
    where: { paymentChannel: 'NFC' },
    data: { paymentChannel: 'ANY' }
  });
  console.log('Restablecidos', cotoReqs.count, 'requerimientos NFC a ANY.');
}

main().finally(() => prisma.$disconnect());

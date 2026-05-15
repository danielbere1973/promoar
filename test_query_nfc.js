const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.promoRequirement.findMany({
    where: { paymentChannel: 'NFC' },
    include: { promo: true }
  });
  console.log("Promos with NFC format:");
  reqs.slice(0, 5).forEach(r => {
    console.log(`Promo ID: ${r.promoId}, Title: ${r.promo.title}, Channel: ${r.paymentChannel}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

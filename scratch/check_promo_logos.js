const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPromoLogos() {
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    include: {
      requirements: {
        include: {
          bank: true,
          wallet: true
        }
      }
    },
    take: 50
  });

  const uniqueBanks = new Map();
  promos.forEach(p => {
    p.requirements.forEach(r => {
      if (r.bank) uniqueBanks.set(r.bank.id, r.bank);
    });
  });

  console.log('--- Banks in active promos ---');
  uniqueBanks.forEach(b => {
    console.log(`- ${b.name} (${b.slug}): ${b.logoUrl}`);
  });

  await prisma.$disconnect();
}

checkPromoLogos();

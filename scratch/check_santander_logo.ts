import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const bank = await prisma.bank.findUnique({
    where: { slug: 'santander' }
  });
  console.log('Santander Bank:', bank);

  const promos = await prisma.promo.findMany({
    where: {
      requirements: {
        some: {
          bank: { slug: 'santander' }
        }
      }
    },
    include: {
      commerce: true
    },
    take: 10
  });
  console.log('Sample Santander Promos Commerces:');
  promos.forEach(p => {
    console.log(`- ${p.commerce.name}: ${p.commerce.logoUrl ? 'HAS LOGO' : 'NO LOGO'} (${p.commerce.logoUrl})`);
  });

  await prisma.$disconnect();
}

run();

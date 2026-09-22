const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    where: { 
      commerce: { name: 'Coto' }
    },
    include: { requirements: true }
  });
  promos.forEach(p => {
    console.log(`ID: ${p.id} | TITLE: ${p.title} | DISCOUNTS: ${p.requirements.map(r => r.discountValue).join(', ')}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

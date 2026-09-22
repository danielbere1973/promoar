const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMacroPromos() {
  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      requirements: {
        some: {
          bank: {
            name: { contains: 'Macro', mode: 'insensitive' }
          }
        }
      }
    },
    include: {
      requirements: {
        include: {
          bank: true
        }
      }
    },
    take: 10
  });

  console.log(`Found ${promos.length} active Macro promos.`);
  promos.forEach(p => {
    console.log(`Promo: ${p.title}`);
    p.requirements.forEach(r => {
      if (r.bank && r.bank.name.includes('Macro')) {
        console.log(`  Bank: ${r.bank.name} (${r.bank.id}) - Logo: ${r.bank.logoUrl}`);
      }
    });
  });

  await prisma.$disconnect();
}

findMacroPromos();

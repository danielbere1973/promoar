const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMissingLogos() {
  const banks = await prisma.bank.findMany({
    where: { logoUrl: null },
    select: { name: true, slug: true }
  });

  const wallets = await prisma.wallet.findMany({
    where: { logoUrl: null },
    select: { name: true, slug: true }
  });

  const commerces = await prisma.commerce.findMany({
    where: { logoUrl: null },
    include: {
      _count: {
        select: { promos: true }
      }
    },
    orderBy: {
      promos: {
        _count: 'desc'
      }
    },
    take: 30
  });

  console.log('--- Banks Missing Logos ---');
  banks.forEach(b => console.log(`- ${b.name} (${b.slug})`));

  console.log('\n--- Wallets Missing Logos ---');
  wallets.forEach(w => console.log(`- ${w.name} (${w.slug})`));

  console.log('\n--- Popular Commerces Missing Logos ---');
  commerces.forEach(c => console.log(`- ${c.name} (${c.slug}) [${c._count.promos} promos]`));

  await prisma.$disconnect();
}

checkMissingLogos();

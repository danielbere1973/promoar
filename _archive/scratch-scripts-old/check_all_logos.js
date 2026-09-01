const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAllLogos() {
  const banks = await prisma.bank.findMany({ where: { logoUrl: { not: null } } });
  const wallets = await prisma.wallet.findMany({ where: { logoUrl: { not: null } } });
  const commerces = await prisma.commerce.findMany({ where: { logoUrl: { not: null } }, take: 100 });

  console.log('--- Banks ---');
  banks.forEach(b => console.log(`${b.name}: ${b.logoUrl}`));
  console.log('--- Wallets ---');
  wallets.forEach(w => console.log(`${w.name}: ${w.logoUrl}`));
  console.log('--- Commerces (sample) ---');
  commerces.forEach(c => console.log(`${c.name}: ${c.logoUrl}`));

  await prisma.$disconnect();
}

checkAllLogos();

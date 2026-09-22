const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMacroEntities() {
  const banks = await prisma.bank.findMany({
    where: { name: { contains: 'Macro', mode: 'insensitive' } }
  });
  const wallets = await prisma.wallet.findMany({
    where: { name: { contains: 'Macro', mode: 'insensitive' } }
  });
  console.log('Banks:', JSON.stringify(banks, null, 2));
  console.log('Wallets:', JSON.stringify(wallets, null, 2));
  await prisma.$disconnect();
}

findMacroEntities();

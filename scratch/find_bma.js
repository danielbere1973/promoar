const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findBMA() {
  const banks = await prisma.bank.findMany({
    where: { name: { contains: 'BMA', mode: 'insensitive' } }
  });
  console.log('Banks BMA:', JSON.stringify(banks, null, 2));
  await prisma.$disconnect();
}

findBMA();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMacroCommerces() {
  const commerces = await prisma.commerce.findMany({
    where: { name: { contains: 'Macro', mode: 'insensitive' } }
  });
  console.log('Commerces:', JSON.stringify(commerces, null, 2));
  await prisma.$disconnect();
}

findMacroCommerces();

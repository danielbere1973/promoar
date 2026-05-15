const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMacroFinal() {
  const macro = await prisma.bank.findUnique({
    where: { slug: 'macro' }
  });
  console.log('Banco Macro database record:');
  console.log(JSON.stringify(macro, null, 2));
  await prisma.$disconnect();
}

checkMacroFinal();

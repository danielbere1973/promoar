const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMacro() {
  const macro = await prisma.bank.findUnique({
    where: { slug: 'macro' }
  });
  console.log(JSON.stringify(macro, null, 2));
  await prisma.$disconnect();
}

checkMacro();

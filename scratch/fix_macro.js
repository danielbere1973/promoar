const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMacro() {
  await prisma.bank.update({
    where: { slug: 'macro' },
    data: { logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Logo_Macro.svg/1024px-Logo_Macro.svg.png' }
  });
  console.log('Banco Macro logo fixed.');
  await prisma.$disconnect();
}

fixMacro();

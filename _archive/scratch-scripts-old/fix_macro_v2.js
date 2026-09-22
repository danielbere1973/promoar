const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMacroAgain() {
  await prisma.bank.update({
    where: { slug: 'macro' },
    data: { logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' }
  });
  console.log('Banco Macro logo fixed with Google Favicon service.');
  await prisma.$disconnect();
}

fixMacroAgain();

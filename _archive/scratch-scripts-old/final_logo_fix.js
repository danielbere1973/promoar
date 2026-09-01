const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalLogoFix() {
  // Banco Macro
  await prisma.bank.update({
    where: { slug: 'macro' },
    data: { logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=macro.com.ar' }
  });

  // Akiabara
  await prisma.commerce.update({
    where: { slug: 'akiabara' },
    data: { logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=akiabara.com' }
  });

  // Paruolo
  await prisma.commerce.update({
    where: { slug: 'paruolo' },
    data: { logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=paruolo.com.ar' }
  });

  // Simplicity
  await prisma.commerce.update({
    where: { slug: 'www-simplicity-com-ar' },
    data: { logoUrl: 'https://www.google.com/s2/favicons?sz=128&domain=simplicity.com.ar' }
  });

  console.log('Final logo fixes applied using Google Favicon service.');
  await prisma.$disconnect();
}

finalLogoFix();

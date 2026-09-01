import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  await prisma.bank.update({
    where: { slug: 'santander' },
    data: { logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/1024px-Banco_Santander_Logotipo.svg.png' }
  });
  console.log('Santander bank logo updated to high-res.');
  await prisma.$disconnect();
}

run();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.promo.findFirst({ 
    where: { title: 'JUBILADOS' },
    select: { sourceText: true } 
  });
  console.log(p.sourceText);
}

main().finally(() => prisma.$disconnect());

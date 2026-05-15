const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({ 
    where: { 
      title: { contains: 'jubilad' },
    },
    select: { title: true, sourceText: true, validDays: true, specificDates: true } 
  });
  
  for (const p of promos) {
    console.log(`\nTitle: ${p.title}`);
    console.log(`validDays: ${p.validDays}`);
    console.log(`Snippet: ${p.sourceText ? p.sourceText.substring(0, 300) : ''}`);
  }
}

main().finally(() => prisma.$disconnect());

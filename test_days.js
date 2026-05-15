const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    orderBy: { createdAt: 'desc' },
    select: { title: true, validDays: true, specificDates: true, sourceText: true },
    take: 15
  });

  for (const p of promos) {
    if (p.validDays !== 127 || p.specificDates !== null) {
      console.log(`\nTitle: ${p.title}`);
      console.log(`ValidDays (mask): ${p.validDays}, specificDates: ${p.specificDates}`);
      console.log(`Snippet: ${p.sourceText ? p.sourceText.substring(0, 150) : ''}`);
    }
  }
}

main().finally(() => prisma.$disconnect());

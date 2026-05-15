const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    where: {
      OR: [
        { title: { contains: 'CIUDADANIA PORTEÑA' } },
        { title: { contains: 'CREDICOOP – MODO' } }
      ]
    },
    select: { title: true, validDays: true, specificDates: true, sourceText: true }
  });

  for (const p of promos) {
    console.log(`\nTitle: ${p.title}`);
    console.log(`ValidDays: ${p.validDays}, specificDates: ${p.specificDates}`);
    console.log(`Snippet: ${p.sourceText}`);
  }
}

main().finally(() => prisma.$disconnect());

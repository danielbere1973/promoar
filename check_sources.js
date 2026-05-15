const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const samples = await prisma.promo.findMany({
    where: {
      OR: [
        { sourceUrl: { not: null } },
        { sourceNote: { not: null } }
      ]
    },
    select: {
      sourceUrl: true,
      sourceNote: true,
      commerce: { select: { name: true } }
    },
    take: 20
  });

  console.log(JSON.stringify(samples, null, 2));
}

main().finally(() => prisma.$disconnect());

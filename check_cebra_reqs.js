const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.promoRequirement.findMany({
    where: { promoId: 'cmokwemnb001i79w8zmkirehg' },
    include: { cardNetwork: true, wallet: true }
  });

  console.log(JSON.stringify(reqs, null, 2));
}

main().finally(() => prisma.$disconnect());

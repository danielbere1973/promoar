const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    where: {
      OR: [
        { title: { contains: 'Coto' } },
        { commerce: { name: { contains: 'Coto' } } }
      ]
    },
    include: { commerce: true }
  });
  console.log(JSON.stringify(promos, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

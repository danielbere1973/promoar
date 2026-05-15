const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promo = await prisma.promo.findUnique({
    where: { id: 'cmokweapq000k79w8an14y29c' },
    include: {
      requirements: {
        include: {
          bank: true,
          wallet: true,
          cardNetwork: true
        }
      },
      commerce: true
    }
  });

  console.log(JSON.stringify(promo, null, 2));
}

main().finally(() => prisma.$disconnect());

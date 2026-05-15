const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const commerces = await prisma.commerce.findMany({
    where: {
      name: { contains: 'Topo', mode: 'insensitive' }
    },
    include: {
      promos: {
        include: {
          requirements: {
            include: {
              bank: true,
              wallet: true
            }
          }
        }
      }
    }
  });

  console.log(JSON.stringify(commerces, null, 2));
}

main().finally(() => prisma.$disconnect());

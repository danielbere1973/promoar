const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const networks = await prisma.cardNetwork.findMany();
  console.log(networks);
}

main().finally(() => prisma.$disconnect());

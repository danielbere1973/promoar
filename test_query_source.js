const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promo = await prisma.promo.findFirst({
    where: { title: 'BANCO ICBC – JUEVES' }
  });
  console.log("Source Text for ICBC:", promo.sourceText);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

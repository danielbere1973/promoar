const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promo = await prisma.promo.findFirst({
    where: { 
      OR: [
        { title: { contains: 'Jubilados' } },
        { description: { contains: 'Jubilados' } }
      ],
      commerce: { name: 'Coto' }
    },
    include: { requirements: true }
  });
  if (promo) {
    console.log("TITLE:", promo.title);
    console.log("DESCRIPTION:", promo.description);
    console.log("REQUIREMENTS:", JSON.stringify(promo.requirements, null, 2));
  } else {
    console.log("No se encontró la promo de jubilados de Coto");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

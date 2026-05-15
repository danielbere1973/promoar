const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.promo.findFirst({
    where: {
      AND: [
        { description: { contains: 'modo', mode: 'insensitive' } },
        { description: { contains: 'buepp', mode: 'insensitive' } }
      ]
    },
    include: { commerce: true }
  });

  if (p) {
    console.log(`Comercio: ${p.commerce?.name}`);
    console.log(`ID: ${p.id}`);
    console.log(`Titulo: ${p.title}`);
    console.log(`Descripción: ${p.description}`);
  } else {
    console.log("No se encontró ninguna promo con ambos términos.");
  }
}

main().finally(() => prisma.$disconnect());

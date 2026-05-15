const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    where: {
      AND: [
        { OR: [ { title: { contains: 'modo', mode: 'insensitive' } }, { description: { contains: 'modo', mode: 'insensitive' } } ] },
        { OR: [ { title: { contains: 'buepp', mode: 'insensitive' } }, { description: { contains: 'buepp', mode: 'insensitive' } } ] }
      ]
    },
    include: {
      commerce: true,
      requirements: {
        include: { wallet: true }
      }
    }
  });

  console.log(`Se encontraron ${promos.length} promos que mencionan ambos.`);
  
  promos.slice(0, 5).forEach(p => {
    console.log(`\nPromo: "${p.title}" en ${p.commerce?.name}`);
    console.log(`Requisitos (${p.requirements.length}):`);
    p.requirements.forEach(r => {
      console.log(` - Billetera: ${r.wallet?.name || 'Desconocida'}`);
    });
  });
}

main().finally(() => prisma.$disconnect());

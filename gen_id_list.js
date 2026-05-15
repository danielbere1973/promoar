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
      commerce: true
    }
  });

  let content = "ID;Comercio;Titulo\n";
  promos.forEach(p => {
    content += `${p.id};${p.commerce?.name || 'S/D'};${p.title}\n`;
  });

  const fs = require('fs');
  fs.writeFileSync('lista_ids_modo_buepp.txt', content);
}

main().finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promos = await prisma.promo.findMany({
    include: {
      _count: { select: { requirements: true } },
      commerce: true,
      requirements: { include: { wallet: true, bank: true } }
    },
    take: 1000
  });

  const multi = promos.filter(p => p._count.requirements > 1);
  console.log(`Se encontraron ${multi.length} promos con múltiples requisitos de las primeras 1000.`);

  if (multi.length > 0) {
    const example = multi[0];
    console.log(`\nEjemplo: "${example.title}" en ${example.commerce?.name}`);
    console.log(`Requisitos (${example.requirements.length}):`);
    example.requirements.forEach((r, i) => {
      console.log(`  ${i+1}. Billetera: ${r.wallet?.name || 'Ninguna'}, Banco: ${r.bank?.name || 'Ninguno'}`);
    });
  }
}

main().finally(() => prisma.$disconnect());

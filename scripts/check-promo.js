const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.promo.findFirst({
    where: { slug: 'ruta-gastronomica-cuyo-35pct-reintegro-patagonia' },
    include: { requirements: { select: { accountType: true, bankId: true, cardNetworkId: true } } }
  });
  if (!p) { console.log('No encontrada'); return; }
  console.log('Promo:', p.title);
  console.log('Requirements:', JSON.stringify(p.requirements, null, 2));
}

main().finally(() => prisma.$disconnect());

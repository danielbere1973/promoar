const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("====================================================");
  console.log("   REPORTE ESTADÍSTICO FINAL - PROMOAR");
  console.log("====================================================\n");

  const totalPromos = await prisma.promo.count();
  if (totalPromos === 0) {
    console.log("[!] No hay promociones en la base de datos.");
    return;
  }

  console.log(`TOTAL DE PROMOS ÚNICAS: ${totalPromos}\n`);

  // 1. POR COMERCIO
  const byCommerce = await prisma.promo.groupBy({
    by: ['commerceId'],
    _count: { id: true },
  });
  const commerces = await prisma.commerce.findMany();
  console.log("--- CANTIDAD Y % POR COMERCIO ---");
  byCommerce.sort((a,b) => b._count.id - a._count.id).forEach(stat => {
    const name = commerces.find(c => c.id === stat.commerceId)?.name || 'Desconocido';
    const count = stat._count.id;
    const percent = ((count / totalPromos) * 100).toFixed(1);
    console.log(`> ${name.padEnd(25)}: ${count.toString().padStart(4)} (${percent}%)`);
  });

  // 2. POR RUBRO (CATEGORÍA)
  const byCategory = await prisma.promo.groupBy({
    by: ['categoryId'],
    _count: { id: true },
  });
  const categories = await prisma.category.findMany();
  console.log("\n--- CANTIDAD Y % POR RUBRO ---");
  byCategory.sort((a,b) => b._count.id - a._count.id).forEach(stat => {
    const name = categories.find(c => c.id === stat.categoryId)?.name || 'Sin Categoría';
    const count = stat._count.id;
    const percent = ((count / totalPromos) * 100).toFixed(1);
    console.log(`> ${name.padEnd(25)}: ${count.toString().padStart(4)} (${percent}%)`);
  });

  // 3. POR BANCO (Contando promos únicas)
  const promosConBanco = await prisma.promo.findMany({
    where: { requirements: { some: { bankId: { not: null } } } },
    include: { requirements: { select: { bankId: true } } }
  });

  const bankStats = {};
  promosConBanco.forEach(p => {
    const uniqueBanksInPromo = new Set(p.requirements.map(r => r.bankId).filter(Boolean));
    uniqueBanksInPromo.forEach(bid => {
      bankStats[bid] = (bankStats[bid] || 0) + 1;
    });
  });

  const banks = await prisma.bank.findMany();
  console.log("\n--- CANTIDAD Y % POR BANCO ---");
  Object.entries(bankStats)
    .sort((a,b) => b[1] - a[1])
    .forEach(([bid, count]) => {
      const name = banks.find(b => b.id === bid)?.name || 'Otro';
      const percent = ((count / totalPromos) * 100).toFixed(1);
      console.log(`> ${name.padEnd(25)}: ${count.toString().padStart(4)} (${percent}%)`);
    });

  // 4. POR SEGMENTO (Banco Galicia mayormente ahora)
  const bySegment = await prisma.promoRequirement.groupBy({
    by: ['segmentId'],
    where: { NOT: { segmentId: null } },
    _count: { promoId: true },
  });
  const segments = await prisma.bankSegment.findMany();
  console.log("\n--- CANTIDAD POR SEGMENTO ---");
  if (bySegment.length === 0) {
    console.log("  (No hay datos de segmentos todavía. Corre el scraper de nuevo para que se mapeen)");
  } else {
    bySegment.sort((a,b) => b._count.promoId - a._count.promoId).forEach(stat => {
      const segment = segments.find(s => s.id === stat.segmentId);
      const bank = banks.find(b => b.id === segment?.bankId);
      const name = segment ? `${bank?.name || ''} - ${segment.name}` : 'General';
      console.log(`> ${name.padEnd(30)}: ${stat._count.promoId.toString().padStart(4)}`);
    });
  }

  // 5. POR TIPO DE TARJETA
  const byCardType = await prisma.promoRequirement.groupBy({
    by: ['cardType'],
    where: { NOT: { cardType: null } },
    _count: { promoId: true },
  });
  console.log("\n--- CANTIDAD POR TIPO DE TARJETA ---");
  byCardType.forEach(stat => {
    console.log(`> ${stat.cardType.padEnd(25)}: ${stat._count.promoId.toString().padStart(4)}`);
  });

  console.log("\n====================================================");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

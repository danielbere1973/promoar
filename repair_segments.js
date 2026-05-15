const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== REPARANDO SEGMENTOS EN DB ===");

  // 1. Obtener los IDs de los segmentos de Galicia para mapear
  const galiciaSegments = await prisma.bankSegment.findMany({
    where: { bank: { name: { contains: 'Galicia' } } }
  });
  
  const eminent = galiciaSegments.find(s => s.name.toLowerCase().includes('eminent'));
  const plus = galiciaSegments.find(s => s.name.toLowerCase().includes('plus'));
  const move = galiciaSegments.find(s => s.name.toLowerCase().includes('move'));

  if (!eminent) {
    console.log("[!] No se encontró el segmento Eminent en la DB.");
    return;
  }

  // 2. Buscar promos que mencionen Eminent en la descripción o título
  const promosEminent = await prisma.promo.findMany({
    where: {
      OR: [
        { title: { contains: 'Eminent', mode: 'insensitive' } },
        { description: { contains: 'Eminent', mode: 'insensitive' } }
      ]
    },
    select: { id: true, title: true }
  });

  console.log(`Encontradas ${promosEminent.length} promos que mencionan 'Eminent'.`);

  // 3. Actualizar los requisitos de esas promos
  let updatedCount = 0;
  for (const p of promosEminent) {
    const res = await prisma.promoRequirement.updateMany({
      where: { promoId: p.id, bank: { name: { contains: 'Galicia' } } },
      data: { segmentId: eminent.id }
    });
    updatedCount += res.count;
  }

  console.log(`Reparación finalizada. ${updatedCount} requisitos actualizados con el segmento Eminent.`);
}

main().finally(() => prisma.$disconnect());

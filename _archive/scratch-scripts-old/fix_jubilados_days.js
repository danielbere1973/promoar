const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando corrección de días para Jubilados ---');
  
  // Buscar promos de Coto que digan Jubilados o Pensionados
  const promos = await prisma.promo.findMany({
    where: {
      commerce: { name: 'Coto' },
      OR: [
        { title: { contains: 'Jubilados', mode: 'insensitive' } },
        { description: { contains: 'Jubilados', mode: 'insensitive' } },
        { title: { contains: 'Pensionados', mode: 'insensitive' } },
        { description: { contains: 'Pensionados', mode: 'insensitive' } },
      ]
    }
  });

  console.log(`Encontradas ${promos.length} promociones candidatas.`);

  let updatedCount = 0;
  for (const promo of promos) {
    if (promo.validDays !== 16) {
      await prisma.promo.update({
        where: { id: promo.id },
        data: { validDays: 16 } // Jueves
      });
      console.log(`✅ Actualizada: ${promo.title} (ID: ${promo.id})`);
      updatedCount++;
    }
  }

  console.log(`--- Fin del proceso. Actualizadas: ${updatedCount} ---`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

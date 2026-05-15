const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Buscando promociones de Buepp para corregir...");
  
  // Encontramos los requisitos que pertenecen a promos con "buepp" en el título o descripción
  // y que tengan el canal de pago en ANY
  const requirements = await prisma.promoRequirement.findMany({
    where: {
      paymentChannel: 'ANY',
      OR: [
        { promo: { title: { contains: 'buepp', mode: 'insensitive' } } },
        { promo: { description: { contains: 'buepp', mode: 'insensitive' } } }
      ]
    },
    include: {
      promo: {
        select: { title: true }
      }
    }
  });

  console.log(`Se encontraron ${requirements.length} requisitos para corregir.`);

  let updated = 0;
  for (const req of requirements) {
    await prisma.promoRequirement.update({
      where: { id: req.id },
      data: { paymentChannel: 'QR' }
    });
    updated++;
  }

  console.log(`Proceso finalizado. Se actualizaron ${updated} registros a canal QR.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

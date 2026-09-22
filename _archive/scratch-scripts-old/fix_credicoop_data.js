const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Iniciando Reparación de Promos de Credicoop...');

  // 1. Promo Vencida (Marzo)
  // Buscamos promos de Credicoop que mencionen marzo o tengan fechas de marzo
  const expiredPromos = await prisma.promo.findMany({
    where: {
      commerce: { name: 'Coto' },
      title: { contains: 'CREDICOOP', mode: 'insensitive' },
      sourceText: { contains: '30/03', mode: 'insensitive' }
    }
  });

  for (const promo of expiredPromos) {
    await prisma.promo.update({
      where: { id: promo.id },
      data: { status: 'EXPIRED' }
    });
    console.log(`📌 Marcada como EXPIRADA: ${promo.title}`);
  }

  // 2. Promo Lunes (Abril) - Fechas Especiales y Topes
  const mondayPromo = await prisma.promo.findFirst({
    where: {
      commerce: { name: 'Coto' },
      title: { contains: 'BANCO CREDICOOP – MODO', mode: 'insensitive' },
      sourceText: { contains: 'LUNES', mode: 'insensitive' }
    },
    include: { requirements: true }
  });

  if (mondayPromo) {
    // Corregir fechas específicas según pedido: 6, 13 y 20 de abril
    const specificDates = ["2026-04-06", "2026-04-13", "2026-04-20"];
    
    await prisma.promo.update({
      where: { id: mondayPromo.id },
      data: {
        specificDates: JSON.stringify(specificDates),
        validUntil: new Date('2026-04-21T03:00:00Z') // Fin de la promo tras el último lunes
      }
    });

    // Corregir tope de reintegro en los requerimientos
    for (const req of mondayPromo.requirements) {
      await prisma.promoRequirement.update({
        where: { id: req.id },
        data: {
          cap: 15000,
          capPeriod: 'WEEKLY',
          capTarget: 'USER'
        }
      });
    }
    console.log(`📌 Corregida Promo Lunes Credicoop: Fechas [${specificDates}] y Tope $15.000 (Semanal/Usuario)`);
  }

  console.log('✅ Reparación de Credicoop finalizada.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

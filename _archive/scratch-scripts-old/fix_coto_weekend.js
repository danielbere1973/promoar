const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promoId = 'cmnw01m5q000113el4drvdb25';
  
  // Fix validUntil to end of day local (23:59:59 UTC-3 => 02:59:59 + 1 day UTC)
  // Actually, let's just set it to 2026-04-13T02:59:59Z to cover April 12 fully.
  const validUntil = new Date('2026-04-13T02:59:59.999Z');
  
  console.log('--- Corrigiendo Promo Coto fin de semana ---');
  
  await prisma.promo.update({
    where: { id: promoId },
    data: {
      status: 'ACTIVE',
      validUntil: validUntil,
      requirements: {
        create: {
          discountType: 'PERCENTAGE_REINTEGRO',
          discountValue: 30,
          paymentChannel: 'ANY',
          accountType: 'ANY',
          note: 'Reintegro fin de semana'
        }
      }
    }
  });

  console.log('✅ Promo corregida: Vigencia extendida y requisito de 30% creado.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

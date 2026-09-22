const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const promoId = 'cmnuujvmq0001gij5ig9wd855'; // MP Sáb y Dom
  const provinces = [
    'Buenos Aires',
    'CABA',
    'Entre Ríos',
    'Mendoza',
    'Neuquén',
    'Santa Fe'
  ];
  
  console.log('--- Corrigiendo Provincias para Promo Mercado Pago ---');
  
  await prisma.promo.update({
    where: { id: promoId },
    data: {
      provinces: provinces
    }
  });

  console.log('✅ Provincias actualizadas para Mercado Pago.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

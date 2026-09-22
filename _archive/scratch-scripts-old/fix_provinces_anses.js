const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ansersId = 'cmnuuk0sl000lgij56iul27xh';
  const provinces = ['Buenos Aires', 'CABA', 'Entre Ríos', 'La Rioja', 'Mendoza', 'Neuquén', 'Salta', 'Santa Fe'];
  
  console.log('--- Corrigiendo Provincias para Promo ANSES ---');
  
  await prisma.promo.update({
    where: { id: ansersId },
    data: { provinces: provinces }
  });

  console.log('✅ Provincias actualizadas para ANSES.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

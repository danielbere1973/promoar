const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ansersId = 'cmnuuk0sl000lgij56iul27xh';
  
  console.log('--- Corrigiendo Promo ANSES (Rango Lunes a Jueves) ---');
  
  await prisma.promo.update({
    where: { id: ansersId },
    data: {
      validDays: 30 // 2+4+8+16 (Lun+Mar+Mie+Jue)
    }
  });

  console.log('✅ Promo ANSES corregida a bitmask 30 (Lunes a Jueves).');
}

main().catch(console.error).finally(() => prisma.$disconnect());

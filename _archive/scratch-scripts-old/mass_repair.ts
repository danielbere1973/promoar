import { prisma } from '../lib/prisma';

async function main() {
  const bankNames = ['Supervielle', 'Galicia', 'Santander', 'Macro', 'Patagonia', 'Ciudad', 'Provincia', 'ICBC', 'Credicoop', 'Hipotecario', 'BBVA'];
  
  // Buscar promociones que mencionen un banco pero tengan al menos un requirement con bankId = null
  const promosToFix = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      OR: bankNames.flatMap(name => [
        { title: { contains: name, mode: 'insensitive' } },
        { description: { contains: name, mode: 'insensitive' } }
      ]),
      requirements: {
        some: { bankId: null }
      }
    },
    include: { requirements: true }
  });

  console.log(`Se encontraron ${promosToFix.length} promociones con datos incompletos.`);

  if (promosToFix.length === 0) {
    console.log('Nada que limpiar.');
    return;
  }

  const ids = promosToFix.map(p => p.id);
  
  await prisma.promo.updateMany({
    where: { id: { in: ids } },
    data: { status: 'DRAFT' }
  });

  console.log(`✅ ${ids.length} promociones movidas a DRAFT.`);
  
  // Opcional: limpiar los requirements que no tienen ni banco ni wallet 
  // (aunque ya no matcheen por la nueva lógica de route.ts, mejor tener la DB limpia)
  const deletedReqs = await prisma.promoRequirement.deleteMany({
    where: { 
      bankId: null, 
      walletId: null, 
      cardNetworkId: null,
      NOT: { cardType: null } // Si solo tiene cardType y nada más, es sospechoso
    }
  });
  console.log(`✅ ${deletedReqs.count} requisitos huerfanos eliminados.`);
}

main().catch(console.error).finally(() => process.exit(0));

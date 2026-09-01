import { prisma } from '../lib/prisma';

/**
 * Script de reparación one-shot.
 * Elimina requirements con bank=null, wallet=null, net=null
 * SOLO cuando la promo tiene OTROS requirements con banco específico.
 * 
 * Esto limpia los requirements "huérfanos" creados cuando run_scraper
 * no pudo resolver el bankId pero igualmente guardó una fila vacía.
 */
async function main() {
  // Traer todas las promos con sus requirements
  const promos = await prisma.promo.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      title: true,
      requirements: {
        select: {
          id: true,
          bankId: true,
          walletId: true,
          cardNetworkId: true,
          cardType: true,
          accountType: true,
          discountValue: true,
        }
      }
    }
  });

  const toDelete: string[] = [];
  const toReport: string[] = [];

  for (const promo of promos) {
    const reqs = promo.requirements;
    if (reqs.length === 0) continue;

    // Detectar requirements que tienen banco específico
    const hasSpecificBank = reqs.some(r => r.bankId !== null);
    const hasSpecificWallet = reqs.some(r => r.walletId !== null);

    if (!hasSpecificBank && !hasSpecificWallet) continue; // Todo es genérico, no tocar

    // Identificar requirements "fantasma": ningún identificador de entidad
    const phantomReqs = reqs.filter(r =>
      r.bankId === null &&
      r.walletId === null &&
      r.cardNetworkId === null // sin red de tarjeta tampoco
    );

    if (phantomReqs.length > 0) {
      toReport.push(`  "${promo.title}" — borrando ${phantomReqs.length} req(s) fantasma`);
      phantomReqs.forEach(r => toDelete.push(r.id));
    }
  }

  console.log(`=== REPARACIÓN DE REQUIREMENTS ===`);
  console.log(`Promos analizadas: ${promos.length}`);
  console.log(`Requirements fantasma a eliminar: ${toDelete.length}`);
  console.log('');
  toReport.forEach(r => console.log(r));

  if (toDelete.length === 0) {
    console.log('\nNada que reparar.');
    return;
  }

  console.log('\n¿Ejecutar eliminación? (dejar correr para confirmar...)');
  
  const result = await prisma.promoRequirement.deleteMany({
    where: { id: { in: toDelete } }
  });

  console.log(`\n✅ Eliminados ${result.count} requirements fantasma.`);
  console.log('Reiniciá el servidor para ver los cambios.');
}

main().catch(console.error).finally(() => process.exit(0));

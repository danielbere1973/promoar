import { prisma } from '../lib/prisma';

async function main() {
  // 1. Desactivar TODO lo que diga Supervielle o Galicia (que el usuario no tiene)
  const toDraft = await prisma.promo.updateMany({
    where: {
      OR: [
        { title: { contains: 'Supervielle', mode: 'insensitive' } },
        { description: { contains: 'Supervielle', mode: 'insensitive' } }
      ]
    },
    data: { status: 'DRAFT' }
  });
  console.log(`✅ ${toDraft.count} promociones de Supervielle movidas a DRAFT.`);

  // 2. Reactivar BBVA y COTO (que son las que el usuario quiere ver)
  // Solo reactivamos si el titulo menciona BBVA o COTO
  const toActive = await prisma.promo.updateMany({
    where: {
      status: 'DRAFT',
      OR: [
        { title: { contains: 'BBVA', mode: 'insensitive' } },
        { title: { contains: 'COTO', mode: 'insensitive' } }
      ]
    },
    data: { status: 'ACTIVE' }
  });
  console.log(`✅ ${toActive.count} promociones de BBVA/COTO reactivadas a ACTIVE.`);

  // 3. Pequeño chequeo de integridad: promos de BBVA que tengan requirements con bankId = null
  // Intentar asignarles el banco BBVA si el titulo es claro
  const bbvaBank = await prisma.bank.findFirst({ where: { name: { contains: 'BBVA' } } });
  if (bbvaBank) {
    const updatedReqs = await prisma.promoRequirement.updateMany({
      where: {
        bankId: null,
        promo: { title: { contains: 'BBVA', mode: 'insensitive' } }
      },
      data: { bankId: bbvaBank.id }
    });
    console.log(`✅ ${updatedReqs.count} requisitos de BBVA vinculados correctamente al banco.`);
  }
}

main().catch(console.error).finally(() => process.exit(0));

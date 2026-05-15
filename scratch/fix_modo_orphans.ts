import { prisma } from '../lib/prisma';

async function main() {
  const modo = await prisma.wallet.findFirst({ where: { name: { contains: 'MODO', mode: 'insensitive' } } });
  if (!modo) { console.log('MODO wallet no encontrado'); return; }

  // Buscar promos donde TODOS los requirements tienen wallet=MODO y bank=null
  // Estas son promos donde el scraper detectó MODO pero no pudo resolver el banco
  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      requirements: {
        some: { walletId: modo.id }  // tiene al menos un req con MODO
      }
    },
    include: {
      requirements: { include: { bank: true, wallet: true } },
      commerce: { select: { name: true } }
    }
  });

  const toMarkDraft: string[] = [];

  console.log('=== PROMOS CON MODO ===\n');
  for (const promo of promos) {
    const modoReqs = promo.requirements.filter(r => r.walletId === modo.id);
    const modoReqsWithoutBank = modoReqs.filter(r => r.bankId === null);
    const hasBankResolved = modoReqs.some(r => r.bankId !== null);

    if (modoReqsWithoutBank.length > 0 && !hasBankResolved) {
      // TODOS los reqs de MODO no tienen banco → datos incompletos
      toMarkDraft.push(promo.id);
      console.log(`❌ DRAFT: "${promo.commerce.name} / ${promo.title}"`);
      modoReqs.forEach(r => console.log(`   bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name}`));
    } else {
      console.log(`✅ OK:    "${promo.commerce.name} / ${promo.title}"`);
      modoReqs.forEach(r => console.log(`   bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name}`));
    }
  }

  if (toMarkDraft.length === 0) {
    console.log('\nNada que marcar como DRAFT.');
    return;
  }

  console.log(`\n→ Marcando ${toMarkDraft.length} promos como DRAFT...`);
  const result = await prisma.promo.updateMany({
    where: { id: { in: toMarkDraft } },
    data: { status: 'DRAFT' }
  });
  console.log(`✅ ${result.count} promos → DRAFT`);
}

main().catch(console.error).finally(() => process.exit(0));

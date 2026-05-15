import { prisma } from '../lib/prisma';

async function main() {
  // 1. Ver el requirement que hace pasar "PROGRAMA DE CIUDADANIA PORTEÑA"
  const ciudadana = await prisma.promo.findFirst({
    where: { title: { contains: 'CIUDADANIA', mode: 'insensitive' } },
    include: { requirements: { include: { bank: true, wallet: true, cardNetwork: true } } }
  });
  console.log('=== CIUDADANÍA PORTEÑA ===');
  ciudadana?.requirements.forEach((r, i) => {
    console.log(`  [${i}] bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name ?? 'null'} net=${r.cardNetwork?.name ?? 'null'} type=${r.cardType ?? 'null'} accountType=${r.accountType} discount=${r.discountValue}`);
  });

  // 2. Ver si hay promos de COTO con BBVA (las que desaparecieron)
  const bbva = await prisma.bank.findUnique({ where: { slug: 'bbva' } });
  const visaNet = await prisma.cardNetwork.findFirst({ where: { name: { contains: 'Visa', mode: 'insensitive' } } });
  console.log('\n=== PROMOS COTO con BBVA o Visa ===');
  const cotoBbva = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      commerce: { name: { contains: 'Coto', mode: 'insensitive' } },
      requirements: {
        some: {
          OR: [
            { bankId: bbva?.id },
            { cardNetworkId: visaNet?.id }
          ]
        }
      }
    },
    include: { requirements: { include: { bank: true, wallet: true, cardNetwork: true } } }
  });
  console.log(`Total: ${cotoBbva.length}`);
  cotoBbva.forEach(p => {
    console.log(`\n  "${p.title}"`);
    p.requirements.forEach((r, i) => {
      console.log(`    [${i}] bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name ?? 'null'} net=${r.cardNetwork?.name ?? 'null'} type=${r.cardType ?? 'null'} accountType=${r.accountType} discount=${r.discountValue}`);
    });
  });

  // 3. Ver cómo están configuradas las wallets MODO en la DB
  const modo = await prisma.wallet.findFirst({ where: { name: { contains: 'MODO', mode: 'insensitive' } } });
  console.log('\n=== REQUIREMENTS CON WALLET=MODO ===');
  const modoReqs = await prisma.promoRequirement.findMany({
    where: { walletId: modo?.id },
    include: { bank: true, wallet: true, cardNetwork: true, promo: { select: { title: true, commerce: { select: { name: true } } } } },
    take: 20
  });
  modoReqs.forEach(r => {
    console.log(`  "${r.promo.commerce.name} / ${r.promo.title}"`);
    console.log(`    bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name ?? 'null'} net=${r.cardNetwork?.name ?? 'null'} type=${r.cardType ?? 'null'} accountType=${r.accountType}`);
  });
}

main().catch(console.error).finally(() => process.exit(0));

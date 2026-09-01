import { prisma } from '../lib/prisma';

// Verificar qué bancos existen en la DB y cuáles faltan para ICBC, Columbia, etc.
async function main() {
  const banks = await prisma.bank.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' }
  });
  console.log('=== BANCOS EN DB ===');
  banks.forEach(b => console.log(`  "${b.name}" (slug: ${b.slug})`));

  // Ver cuáles promos problemáticas tienen bank=null como único req
  const problematic = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      requirements: {
        every: { bankId: null, walletId: null }
      }
    },
    select: {
      id: true,
      title: true,
      requirements: {
        select: {
          bankId: true,
          walletId: true,
          cardType: true,
          accountType: true,
          cardNetworkId: true,
        }
      }
    },
    orderBy: { title: 'asc' }
  });
  
  console.log(`\n=== PROMOS CON TODOS LOS REQS SIN BANCO/WALLET (${problematic.length}) ===`);
  problematic.forEach(p => {
    console.log(`  "${p.title}" — ${p.requirements.length} req(s)`);
    p.requirements.forEach(r => {
      console.log(`    type=${r.cardType ?? 'null'} accountType=${r.accountType} net=${r.cardNetworkId ?? 'null'}`);
    });
  });
}

main().catch(console.error).finally(() => process.exit(0));

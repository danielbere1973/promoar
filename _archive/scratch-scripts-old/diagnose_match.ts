import { prisma } from '../lib/prisma';

async function main() {
  // 1. Buscar promos de COTO con Supervielle
  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      commerce: { name: { contains: 'Coto', mode: 'insensitive' } },
    },
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
          paymentChannel: true,
          accountType: true,
          segmentId: true,
          discountType: true,
          discountValue: true,
          bank: { select: { name: true } },
          wallet: { select: { name: true } },
          cardNetwork: { select: { name: true } },
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`Total promos de COTO: ${promos.length}`);
  for (const p of promos) {
    const hasSup = p.requirements.some(r => r.bank?.name?.toLowerCase().includes('supervielle'));
    const marker = hasSup ? '<<< SUPERVIELLE' : '';
    console.log(`\n[${p.id.slice(0,8)}] ${p.title} ${marker}`);
    for (const r of p.requirements) {
      console.log(`  REQ: bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name ?? 'null'} net=${r.cardNetwork?.name ?? 'null'} type=${r.cardType ?? 'null'} channel=${r.paymentChannel} accountType=${r.accountType} segment=${r.segmentId ?? 'null'} discount=${r.discountValue}${r.discountType}`);
    }
  }

  // 2. Ver el perfil del primer usuario no-admin
  const user = await prisma.user.findFirst({
    where: { role: 'USER' },
    select: {
      email: true,
      financialProfile: {
        select: {
          banks: { select: { bankId: true, bank: { select: { name: true } } } },
          wallets: { select: { walletId: true, wallet: { select: { name: true } } } },
          cards: {
            select: {
              bankId: true,
              walletId: true,
              cardNetworkId: true,
              cardType: true,
              segmentId: true,
              isPayroll: true,
              isPensioner: true,
              bank: { select: { name: true } },
              wallet: { select: { name: true } },
              cardNetwork: { select: { name: true } },
            }
          }
        }
      }
    }
  });

  console.log('\n\n=== PERFIL USUARIO ===');
  console.log('Email:', user?.email);
  console.log('Banks:', user?.financialProfile?.banks.map(b => b.bank.name));
  console.log('Wallets:', user?.financialProfile?.wallets.map(w => w.wallet.name));
  console.log('Cards:');
  user?.financialProfile?.cards.forEach(c => {
    console.log(`  bank=${c.bank?.name} wallet=${c.wallet?.name} net=${c.cardNetwork?.name} type=${c.cardType} segment=${c.segmentId} payroll=${c.isPayroll} pensioner=${c.isPensioner}`);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));

import { prisma } from '../lib/prisma';

// ─── Simulación EXACTA del match engine de route.ts ───────────────────────────
const USER_EMAIL = 'litadescuentos@gmail.com';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    include: {
      financialProfile: { include: { banks: true, wallets: true, cards: true } },
      savedPromos: true,
    }
  });

  if (!user?.financialProfile) {
    console.log('No se encontró el usuario o no tiene perfil financiero.');
    console.log('Usuarios disponibles:');
    const users = await prisma.user.findMany({ select: { email: true, role: true } });
    users.forEach(u => console.log(' -', u.email, u.role));
    return;
  }

  const userProfile = user.financialProfile;
  const userBankIds = new Set(userProfile.banks.map(b => b.bankId));
  const userWalletIds = new Set(userProfile.wallets.map(w => w.walletId));
  const userCards = userProfile.cards;
  const savedSet = new Set(user.savedPromos.map(sp => sp.promoId));

  console.log('=== PERFIL ===');
  console.log('Banks IDs:', [...userBankIds]);
  console.log('Wallet IDs:', [...userWalletIds]);
  console.log('Cards:');
  for (const c of userCards) {
    const bank = c.bankId ? await prisma.bank.findUnique({ where: { id: c.bankId }, select: { name: true } }) : null;
    const wallet = c.walletId ? await prisma.wallet.findUnique({ where: { id: c.walletId }, select: { name: true } }) : null;
    const net = c.cardNetworkId ? await prisma.cardNetwork.findUnique({ where: { id: c.cardNetworkId }, select: { name: true } }) : null;
    console.log(`  bank=${bank?.name ?? 'null'} wallet=${wallet?.name ?? 'null'} net=${net?.name ?? 'null'} type=${c.cardType} payroll=${c.isPayroll} pensioner=${c.isPensioner} segmentId=${c.segmentId ?? 'null'}`);
  }

  // Traer todas las promos de COTO activas
  const promos = await prisma.promo.findMany({
    where: {
      status: 'ACTIVE',
      commerce: { name: { contains: 'Coto', mode: 'insensitive' } }
    },
    include: {
      requirements: {
        include: {
          bank: { select: { name: true } },
          wallet: { select: { name: true } },
          cardNetwork: { select: { name: true } },
        }
      }
    }
  });

  console.log(`\n=== PROMOS COTO (${promos.length}) — evaluando match para ${USER_EMAIL} ===\n`);

  for (const promo of promos) {
    if (savedSet.has(promo.id)) {
      console.log(`✅ [SAVED] ${promo.title}`);
      continue;
    }
    if (!promo.requirements.length) {
      console.log(`⚠️  [SIN REQS] ${promo.title}`);
      continue;
    }

    // Simular el match engine actual (código de route.ts)
    let passes = false;
    let passingReq: any = null;

    for (const req of promo.requirements) {
      const needsCard = req.cardNetworkId || req.cardType;
      let reqPasses = false;

      if (needsCard) {
        for (const card of userCards) {
          let cardMatches = true;
          if (req.bankId && card.bankId !== req.bankId) { cardMatches = false; }
          if (req.walletId && card.walletId !== req.walletId) { cardMatches = false; }
          if (req.cardNetworkId && card.cardNetworkId !== req.cardNetworkId) { cardMatches = false; }
          if (req.cardType && card.cardType !== req.cardType) { cardMatches = false; }
          if (cardMatches) { reqPasses = true; break; }
        }
      } else {
        const bankOk = !req.bankId || userBankIds.has(req.bankId) || userCards.some(c => c.bankId === req.bankId);
        const walletOk = !req.walletId || userWalletIds.has(req.walletId) || userCards.some(c => c.walletId === req.walletId);
        reqPasses = bankOk && walletOk;
      }

      if (reqPasses) {
        passes = true;
        passingReq = req;
        break;
      }
    }

    if (passes) {
      console.log(`❌ FALSO POSITIVO: "${promo.title}"`);
      console.log(`   Requirement que lo pasa:`);
      console.log(`     bank=${passingReq.bank?.name ?? 'null'} wallet=${passingReq.wallet?.name ?? 'null'} net=${passingReq.cardNetwork?.name ?? 'null'} type=${passingReq.cardType ?? 'null'} channel=${passingReq.paymentChannel} accountType=${passingReq.accountType}`);
      console.log(`   Todos sus requirements:`);
      promo.requirements.forEach((r, i) => {
        console.log(`     [${i}] bank=${r.bank?.name ?? 'null'} wallet=${r.wallet?.name ?? 'null'} net=${r.cardNetwork?.name ?? 'null'} type=${r.cardType ?? 'null'} channel=${r.paymentChannel} accountType=${r.accountType} discount=${r.discountValue}`);
      });
    } else {
      console.log(`✅ OK (filtrada): "${promo.title}"`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));

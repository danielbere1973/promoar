import { prisma } from './lib/prisma';
import { ALL_SCRAPERS } from './lib/scrapers';

async function run() {
  console.log("Corriendo scrapers...");
  const results = await Promise.all(ALL_SCRAPERS.map(s => s.run()));
  const flatPromos = results.flat();
  console.log(`Scrapers terminados. ${flatPromos.length} encontradas.`);

  const categories = await prisma.category.findMany();
  const banks = await prisma.bank.findMany();
  const wallets = await prisma.wallet.findMany();
  const commerces = await prisma.commerce.findMany();
  const cardNetworks = await prisma.cardNetwork.findMany();
  const bankSegments = await prisma.bankSegment.findMany();

  let processedCount = 0;

  for (const p of flatPromos) {
    if (!p.title || !p.discount) continue;

    const catMatch = categories.find((c: any) => c.name.toLowerCase() === p.categoria?.toLowerCase());
    if (!catMatch) continue;

    const comMatch = commerces.find((cl: any) => cl.name.toLowerCase() === p.storeName?.toLowerCase());
    if (!comMatch) continue;

    // Si el scraper trajo un logo y el comercio en DB no tiene, o queremos actualizarlo
    if (p.storeLogoUrl && !comMatch.logoUrl) {
      await prisma.commerce.update({
        where: { id: comMatch.id },
        data: { logoUrl: p.storeLogoUrl }
      });
      comMatch.logoUrl = p.storeLogoUrl; // Actualizar en memoria para esta corrida
      console.log(`  [LOGO] Actualizado logo para ${comMatch.name}`);
    }

    // Normalización de nombre para matching más robusto
    const normName = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();

    const resolvedBankIds: (string | null)[] = [];
    if (p.bankNames && p.bankNames.length > 0) {
      for (const bankName of p.bankNames) {
        const nameToNorm = typeof bankName === 'string' ? bankName : (bankName as any).name;
        const normBank = normName(nameToNorm);
        const bankMatch = banks.find((b: any) => {
          const normDb = normName(b.name);
          return normDb.includes(normBank) || normBank.includes(normDb);
        });
        resolvedBankIds.push(bankMatch?.id ?? null);
      }
    } else {
      resolvedBankIds.push(null);
    }

    // Mapeo de Segmentos
    const segmentMatch = (() => {
      if (!p.cardTier) return null;
      // Buscar segmento que coincida con el cardTier del scraper para este banco
      const firstBankId = resolvedBankIds[0];
      if (!firstBankId) return null;
      
      const tierNorm = normName(p.cardTier);
      return bankSegments.find(s => 
        s.bankId === firstBankId && 
        (normName(s.name).includes(tierNorm) || tierNorm.includes(normName(s.name)))
      );
    })();

    // Soporte para walletNames
    const walletNamesArr: string[] = (p as any).walletNames ?? ((p as any).walletName ? [(p as any).walletName] : []);
    const resolvedWalletIds: (string | null)[] = walletNamesArr.length > 0
      ? walletNamesArr.map(wn => wallets.find((w: any) => normName(w.name) === normName(wn))?.id ?? null)
      : [null];

    // Producto cartesiano bancos × wallets
    const reqPairs: { bankId: string | null; walletId: string | null }[] = [];
    for (const bankId of resolvedBankIds) {
      for (const walletId of resolvedWalletIds) {
        reqPairs.push({ bankId, walletId });
      }
    }

    const hasResolved = reqPairs.some(r => r.bankId !== null || r.walletId !== null);
    const hasWalletDetected = walletNamesArr.length > 0;
    if (hasWalletDetected && !reqPairs.some(r => r.bankId !== null)) {
      console.log(`  [SKIP] "${p.title}" — wallet sin banco resuelto`);
      continue;
    }

    const finalPairs = hasResolved
      ? reqPairs.filter(r => r.bankId !== null || r.walletId !== null)
      : reqPairs;

    const numericDiscount = parseFloat(p.discount || '0');
    const existing = await prisma.promo.findFirst({ where: { title: p.title, commerceId: comMatch.id } });

    const networks = p.cardNetworks && p.cardNetworks.length > 0 
      ? p.cardNetworks 
      : [{ network: null, type: (p as any).cardType || null }];

    const reqData: any[] = [];
    for (const { bankId, walletId } of finalPairs) {
      for (const netInfo of networks) {
        const netMatch = (() => {
          if (!netInfo.network) return null;
          const typeSuffix = netInfo.type === 'CREDIT' ? ' crédito' : netInfo.type === 'DEBIT' ? ' débito' : netInfo.type === 'PREPAID' ? ' prepaga' : '';
          const fullName = (netInfo.network + typeSuffix).toLowerCase();
          return cardNetworks.find((cn: any) => cn.name.toLowerCase() === fullName)
              ?? cardNetworks.find((cn: any) => cn.name.toLowerCase() === netInfo.network!.toLowerCase());
        })();

        reqData.push({
          bankId,
          walletId,
          cardNetworkId: netMatch?.id ?? null,
          cardType: netInfo.type ?? null,
          segmentId: segmentMatch?.id ?? null, // <--- Vincular el segmento aquí
          paymentChannel: (p.paymentChannel as any) ?? 'ANY',
          accountType: (p.accountType as any) ?? 'ANY',
          discountType: (p.discountType as any) || 'PERCENTAGE_REINTEGRO',
          discountValue: numericDiscount,
          cap: p.cap ?? null,
          capPeriod: (p.capPeriod as any) ?? null,
          capTarget: (p.capTarget as any) ?? (p.cap ? 'USER' : null),
          minPurchase: p.minPurchase ?? null,
        });
      }
    }

    const promoData = {
      title: p.title,
      description: p.description || '',
      stackable: p.stackable ?? false,
      validFrom: p.validFrom ? new Date(p.validFrom) : new Date(),
      validUntil: p.validUntil ? new Date(p.validUntil) : null,
      validDays: p.validDays ?? 127,
      specificDates: p.specificDates ? JSON.stringify(p.specificDates) : null,
      categoryId: catMatch.id,
      commerceId: comMatch.id,
      status: 'ACTIVE' as const,
      sourceUrl: p.sourceUrl ?? null,
      sourceText: p.sourceText ?? null,
    };

    if (existing) {
      await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
      await prisma.promo.update({
        where: { id: existing.id },
        data: { ...promoData, requirements: { create: reqData } },
      });
    } else {
      await prisma.promo.create({
        data: { ...promoData, requirements: { create: reqData } },
      });
    }
    processedCount++;
  }
  console.log(`Ingesta finalizada: ${processedCount} promos guardadas.`);
}

run();

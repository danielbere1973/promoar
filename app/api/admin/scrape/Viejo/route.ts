import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ALL_SCRAPERS } from '@/lib/scrapers';

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toSlug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    let scraperFilter: string | undefined;
    let categoriaFilter: string | undefined;
    try {
      const body = await req.json();
      scraperFilter = body.scraper;
      categoriaFilter = body.categoria;
    } catch { /* body vacío */ }

    const scrapersToRun = ALL_SCRAPERS.filter(s =>
      !scraperFilter || s.name.toLowerCase() === scraperFilter.toLowerCase()
    );

    console.log(`[Scrape] Corriendo: ${scrapersToRun.map(s => s.name).join(', ')}${categoriaFilter ? ` | Categoría: ${categoriaFilter}` : ''}`);

    const flatPromos: any[] = [];
    for (const scraper of scrapersToRun) {
      const result = await (scraper as any).run(categoriaFilter);
      flatPromos.push(...result);
    }
    console.log(`[Scrape] Total promos encontradas: ${flatPromos.length}`);

    const categories = await prisma.category.findMany();
    const banks = await prisma.bank.findMany();
    const wallets = await prisma.wallet.findMany();
    let commerces = await prisma.commerce.findMany();
    const cardNetworks = await prisma.cardNetwork.findMany();

    let processedCount = 0;
    let skippedNoCategory = 0;
    let skippedNoCommerce = 0;

    for (const p of flatPromos) {
      console.log(`[Route DEBUG ALL] "${p.title}" → discount: ${p.discount}, bankNames: ${p.bankNames?.length || 0}`);
      if (!p.title || !p.discount) continue;

      const catMatch = categories.find(c =>
        normalizeStr(c.name) === normalizeStr(p.categoria ?? '')
      );
      if (!catMatch) {
        skippedNoCategory++;
        continue;
      }

      let comMatch = commerces.find(c =>
        normalizeStr(c.name) === normalizeStr(p.storeName ?? '')
      );
      if (!comMatch && p.storeName) {
        comMatch = commerces.find(c =>
          normalizeStr(c.name).includes(normalizeStr(p.storeName!)) ||
          normalizeStr(p.storeName!).includes(normalizeStr(c.name))
        );
      }
      if (!comMatch && p.storeName) {
        const slug = toSlug(p.storeName);
        comMatch = await prisma.commerce.upsert({
          where: { slug },
          update: { name: p.storeName },
          create: { name: p.storeName, slug, active: true },
        });
        commerces = [...commerces, comMatch];
      }
      if (!comMatch) {
        skippedNoCommerce++;
        continue;
      }

      // ── NUEVO: Redes de tarjeta (plural, array) ────────────────────────────────
      const resolvedCardNetworkIds: (string | null)[] = [];
      if (p.cardNetworks && p.cardNetworks.length > 0) {
        for (const networkName of p.cardNetworks) {
          const netMatch = cardNetworks.find(cn =>
            normalizeStr(cn.name).includes(normalizeStr(networkName)) ||
            normalizeStr(networkName).includes(normalizeStr(cn.name))
          );
          resolvedCardNetworkIds.push(netMatch?.id ?? null);
        }
      } else {
        // Si no hay redes, usar null para crear un requirement sin red específica
        resolvedCardNetworkIds.push(null);
      }

      // Bancos
      const resolvedBankIds: (string | null)[] = [];
      if (p.bankNames && p.bankNames.length > 0) {
        for (const bankItem of p.bankNames) {
          const bankName = typeof bankItem === 'string' ? bankItem : (bankItem?.name || '');
          // SI NO HAY NOMBRE PERO HAY bcraCode, buscar por código
          const bankMatch = banks.find(b =>
            (bankName && (normalizeStr(b.name).includes(normalizeStr(bankName)) || normalizeStr(bankName).includes(normalizeStr(b.name)))) ||
            (bankItem?.bcraCode && b.bcraCode === bankItem.bcraCode)
          );
          resolvedBankIds.push(bankMatch?.id ?? null);
        }
      } else {
        resolvedBankIds.push(null);
      }

      // Wallets
      const resolvedWalletIds: (string | null)[] = [];
      if (p.walletNames && p.walletNames.length > 0) {
        for (const walletName of p.walletNames) {
          const walletMatch = wallets.find(w =>
            normalizeStr(w.name) === normalizeStr(walletName) ||
            normalizeStr(walletName).includes(normalizeStr(w.name))
          );
          resolvedWalletIds.push(walletMatch?.id ?? null);
        }
      } else {
        resolvedWalletIds.push(null);
      }

      const numericDiscount = parseFloat(p.discount || '0');
      console.log(`[Route DEBUG] "${p.title}" → discount: "${p.discount}" → numericDiscount: ${numericDiscount}`);
      const discountType = (p.discountType as any) || 'PERCENTAGE_REINTEGRO';

      // ── NUEVO: Requirements (banco × wallet × red) ─────────────────────────────
      const reqData: any[] = [];
      for (const bankId of resolvedBankIds) {
        for (const walletId of resolvedWalletIds) {
          for (const cardNetworkId of resolvedCardNetworkIds) {
            reqData.push({
              bankId,
              walletId,
              cardNetworkId,
              cardType: (p.cardType as any) ?? null,
              paymentChannel: (['ANY', 'QR', 'NFC', 'TARJETA_FISICA', 'TRANSFERENCIA', 'DINERO_EN_CUENTA'].includes(p.paymentChannel) ? p.paymentChannel : 'ANY') as any,
              accountType: (p.accountType as any) ?? 'ANY',
              discountType,
              discountValue: numericDiscount,
              cap: p.cap ?? null,
              capPeriod: (p.capPeriod as any) ?? null,
              capTarget: (p.capTarget as any) ?? (p.cap ? 'USER' : null),
              minPurchase: p.minPurchase ?? null,
              note: null,
            });
          }
        }
      }

      if (p.title.includes('5% adicional')) {
        console.log(`[Route DEBUG] reqData para "5% adicional en Shell":`, JSON.stringify(reqData[0], null, 2));
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

      const existing = p.sourceUrl
        ? await prisma.promo.findFirst({ where: { sourceUrl: p.sourceUrl } })
        : await prisma.promo.findFirst({ where: { title: p.title, commerceId: comMatch.id } });

      if (existing) {
        await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
        const updated = await prisma.promo.update({
          where: { id: existing.id },
          data: { ...promoData, requirements: { create: reqData } },
        });
        console.log(`[Route DEBUG UPDATED] "${p.title}" → promoId: ${updated.id}, reqData.length: ${reqData.length}`);
      } else {
        const created = await prisma.promo.create({
          data: { ...promoData, requirements: { create: reqData } },
        });
        console.log(`[Route DEBUG CREATED] "${p.title}" → promoId: ${created.id}, reqData.length: ${reqData.length}`);
      }

      processedCount++;
    }

    console.log(`[Scrape] ✅ Procesadas: ${processedCount} | Sin categoría: ${skippedNoCategory} | Sin comercio: ${skippedNoCommerce}`);

    return NextResponse.json({
      message: 'Scraping completado con éxito',
      totalFound: flatPromos.length,
      processed: processedCount,
      skippedNoCategory,
      skippedNoCommerce,
    });

  } catch (error) {
    console.error('Error scrapeando:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

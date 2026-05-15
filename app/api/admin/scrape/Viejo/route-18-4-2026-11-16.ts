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

interface CardNetworkWithType {
  network: string;
  type: 'CREDIT' | 'DEBIT' | null;
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

    // ── AGRUPACIÓN: title + sourceUrl → 1 Promo con N Requirements ───────────
    // Permite que "30% reintegro + 6 CSI" del mismo comercio genere
    // una sola Promo con dos PromoRequirements distintos.
    const grouped = new Map<string, any[]>();
    for (const p of flatPromos) {
      const key = `${p.title}|||${p.sourceUrl || p.storeName || 'NO_URL'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    }
    console.log(`[Scrape] ${flatPromos.length} promos → ${grouped.size} promos únicas agrupadas`);

    // ── Fetch masivo de entidades (una sola vez) ───────────────────────────
    const categories = await prisma.category.findMany();
    const banks = await prisma.bank.findMany();
    const wallets = await prisma.wallet.findMany();
    let commerces = await prisma.commerce.findMany();
    const cardNetworks = await prisma.cardNetwork.findMany();

    let processedCount = 0;
    let skippedNoCategory = 0;
    let skippedNoCommerce = 0;

    for (const [, group] of grouped) {
      const p = group[0]; // base para datos de la promo y matching de entidades

      console.log(`[Route DEBUG ALL] "${p.title}" → discounts: ${group.length}, bankNames: ${p.bankNames?.length || 0}`);
      if (!p.title) continue;

      // Validar que al menos un item del grupo tenga descuento
      const hasDiscount = group.some(g => g.discount);
      if (!hasDiscount) continue;

      // ── Categoría ─────────────────────────────────────────────────────────
      const catMatch = categories.find(c =>
        normalizeStr(c.name) === normalizeStr(p.categoria ?? '')
      );
      if (!catMatch) {
        skippedNoCategory++;
        continue;
      }

      // ── Comercio ──────────────────────────────────────────────────────────
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

      // ── Redes de tarjeta con tipo (crédito/débito) ────────────────────────
      const resolvedCardNetworks: Array<{ cardNetworkId: string | null; cardType: 'CREDIT' | 'DEBIT' | null }> = [];

      if (p.cardNetworks && p.cardNetworks.length > 0) {
        for (const item of p.cardNetworks as CardNetworkWithType[]) {
          const netMatch = cardNetworks.find(cn =>
            normalizeStr(cn.name).includes(normalizeStr(item.network)) ||
            normalizeStr(item.network).includes(normalizeStr(cn.name)) ||
            (normalizeStr(item.network) === 'american express' && normalizeStr(cn.name).includes('american'))
          );
          resolvedCardNetworks.push({
            cardNetworkId: netMatch?.id ?? null,
            cardType: item.type,
          });
        }
      } else {
        resolvedCardNetworks.push({ cardNetworkId: null, cardType: null });
      }

      // ── Bancos ────────────────────────────────────────────────────────────
      const resolvedBankIds: (string | null)[] = [];
      if (p.bankNames && p.bankNames.length > 0) {
        for (const bankItem of p.bankNames) {
          const bankName = typeof bankItem === 'string' ? bankItem : (bankItem?.name || '');
          const bankMatch = banks.find(b =>
            (bankName && (normalizeStr(b.name).includes(normalizeStr(bankName)) || normalizeStr(bankName).includes(normalizeStr(b.name)))) ||
            (bankItem?.bcraCode && (b.bcraCode === bankItem.bcraCode || b.codigoModo === bankItem.bcraCode))
          );
          resolvedBankIds.push(bankMatch?.id ?? null);
        }
      } else {
        resolvedBankIds.push(null);
      }

      // ── Wallets ───────────────────────────────────────────────────────────
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

      // ── Descuentos únicos del grupo (30% reintegro + 6 CSI, etc.) ─────────
      const uniqueDiscounts = Array.from(
        new Map(
          group
            .filter(g => g.discount)
            .map(g => {
              const val = parseFloat(String(g.discount || '0'));
              const type = g.discountType || 'PERCENTAGE_REINTEGRO';
              return [`${val}-${type}`, { discountValue: val, discountType: type as any }];
            })
        ).values()
      );
      console.log(`[Route DEBUG] "${p.title}" → ${uniqueDiscounts.length} descuento(s):`, uniqueDiscounts);

      // ── Requirements: banco × wallet × red × descuento ────────────────────
      const reqData: any[] = [];
      for (const bankId of resolvedBankIds) {
        for (const walletId of resolvedWalletIds) {
          for (const networkWithType of resolvedCardNetworks) {
            for (const discount of uniqueDiscounts) {
              reqData.push({
                bankId,
                walletId,
                cardNetworkId: networkWithType.cardNetworkId,
                cardType: networkWithType.cardType,
                paymentChannel: (['ANY', 'QR', 'NFC', 'TARJETA_FISICA', 'TRANSFERENCIA', 'DINERO_EN_CUENTA'].includes(p.paymentChannel) ? p.paymentChannel : 'ANY') as any,
                accountType: (p.accountType as any) ?? 'ANY',
                discountType: discount.discountType,
                discountValue: discount.discountValue,
                cap: p.cap != null ? parseFloat(String(p.cap)) : null,
                capPeriod: (p.capPeriod as any) ?? null,
                capTarget: (p.capTarget as any) ?? (p.cap ? 'USER' : null),
                minPurchase: p.minPurchase != null ? parseFloat(String(p.minPurchase)) : null,
                note: null,
              });
            }
          }
        }
      }

      if (p.title.includes('40%')) {
        console.log(`[Route DEBUG] reqData para "${p.title}":`, JSON.stringify(reqData.slice(0, 3), null, 2));
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

      // ── Upsert de la promo ────────────────────────────────────────────────
      const existing = p.sourceUrl
        ? await prisma.promo.findFirst({ where: { sourceUrl: p.sourceUrl } })
        : await prisma.promo.findFirst({ where: { title: p.title, commerceId: comMatch.id } });

      if (existing) {
        await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
        const updated = await prisma.promo.update({
          where: { id: existing.id },
          data: { ...promoData, requirements: { create: reqData } },
        });
        console.log(`[Route DEBUG UPDATED] "${p.title}" → promoId: ${updated.id}, requirements: ${reqData.length}`);
      } else {
        const created = await prisma.promo.create({
          data: { ...promoData, requirements: { create: reqData } },
        });
        console.log(`[Route DEBUG CREATED] "${p.title}" → promoId: ${created.id}, requirements: ${reqData.length}`);
      }

      processedCount++;
    }

    console.log(`[Scrape] ✅ Procesadas: ${processedCount} | Sin categoría: ${skippedNoCategory} | Sin comercio: ${skippedNoCommerce}`);

    return NextResponse.json({
      message: 'Scraping completado con éxito',
      totalFound: flatPromos.length,
      totalGrouped: grouped.size,
      processed: processedCount,
      skippedNoCategory,
      skippedNoCommerce,
    });

  } catch (error) {
    console.error('Error scrapeando:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

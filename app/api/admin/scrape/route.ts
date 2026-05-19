export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ALL_SCRAPERS } from '@/lib/scrapers';
import { generatePromoSlug } from '@/lib/utils/promoSlug';
import { detectCategoria } from '@/lib/scrapers/bank-helpers';

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
  cardNetworkName?: string;
  segmentName?: string;
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
    const sinCategoria = categories.find(c => c.slug === 'sin-categoria');
    const banks = await prisma.bank.findMany({ include: { cardNetworks: { select: { id: true } }, segments: true } });
    const wallets = await prisma.wallet.findMany();
    let commerces = await (prisma.commerce as any).findMany({ select: { id: true, name: true, slug: true, logoUrl: true, active: true, website: true, defaultCategoryId: true } });
    const cardNetworks = await prisma.cardNetwork.findMany();
    const cardSegments = await prisma.cardSegment.findMany({ include: { cardNetwork: true } });

    // Default de fin de mes para promos sin validUntil explícito
    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0)
    endOfMonth.setHours(23, 59, 59, 0)

    let processedCount = 0;
    let skippedNoCategory = 0;
    let skippedNoCommerce = 0;

    // ── FASE 1: Resolver entidades + crear comercios (secuencial) ─────────────
    type ResolvedItem = { promoData: any; reqData: any[]; baseSlug: string; sourceUrl?: string | null; title: string; commerceId: string };
    const resolvedItems: ResolvedItem[] = [];

    for (const [, group] of Array.from(grouped.entries())) {
      const p = group[0]; // base para datos de la promo y matching de entidades

      if (!p.title) continue;

      // Validar que al menos un item del grupo tenga descuento
      const hasDiscount = group.some((g: any) => g.discount);
      if (!hasDiscount) continue;

      // ── Categoría ─────────────────────────────────────────────────────────
      // 1. Categoría del scraper
      let catMatch = categories.find(c =>
        normalizeStr(c.name) === normalizeStr(p.categoria ?? '')
      );
      // 2. defaultCategoryId del comercio (aprendizaje)
      if (!catMatch && p.storeName) {
        const knownCom = (commerces as any[]).find((c: any) => normalizeStr(c.name) === normalizeStr(p.storeName ?? ''));
        if (knownCom?.defaultCategoryId) {
          catMatch = categories.find(c => c.id === knownCom.defaultCategoryId) ?? undefined;
        }
      }
      // 3. detectCategoria como fallback
      if (!catMatch) {
        const detected = detectCategoria(`${p.storeName ?? ''} ${p.title ?? ''}`);
        if (detected) {
          catMatch = categories.find(c => normalizeStr(c.name) === normalizeStr(detected));
        }
      }
      if (!catMatch) {
        if (!sinCategoria) { skippedNoCategory++; continue; }
        catMatch = sinCategoria;
      }

      // ── Comercio ──────────────────────────────────────────────────────────
      let comMatch = commerces.find(c =>
        normalizeStr(c.name) === normalizeStr(p.storeName ?? '')
      );
      if (!comMatch && p.storeName) {
        const normStore = normalizeStr(p.storeName);
        comMatch = commerces.find(c => {
          const normC = normalizeStr(c.name);
          // Requiere mínimo 4 chars y word boundary para evitar falsos positivos ("vea" en "alvear")
          if (normC.length >= 4 && normStore.includes(normC) && new RegExp(`\\b${normC}\\b`).test(normStore)) return true;
          if (normStore.length >= 4 && normC.includes(normStore) && new RegExp(`\\b${normStore}\\b`).test(normC)) return true;
        });
      }

      if (comMatch && !comMatch.logoUrl && p.storeLogoUrl) {
        comMatch = await prisma.commerce.update({
          where: { id: comMatch.id },
          data: { logoUrl: p.storeLogoUrl }
        });
        // Actualizar en la lista local para siguientes promos del mismo scrape
        const idx = commerces.findIndex(c => c.id === comMatch!.id);
        if (idx !== -1) commerces[idx] = comMatch;
      }

      if (!comMatch && p.storeName) {
        const slug = toSlug(p.storeName);
        comMatch = await prisma.commerce.upsert({
          where: { slug },
          update: { 
            name: p.storeName,
            ...(p.storeLogoUrl ? { logoUrl: p.storeLogoUrl } : {})
          },
          create: { 
            name: p.storeName, 
            slug, 
            active: true,
            ...(p.storeLogoUrl ? { logoUrl: p.storeLogoUrl } : {})
          },
        });
        commerces = [...commerces, comMatch];
      }
      if (!comMatch) {
        skippedNoCommerce++;
        continue;
      }

      // ── Redes de tarjeta con tipo (crédito/débito) ────────────────────────
      // Mergear redes de todos los items del grupo (distintas redes pueden venir
      // en ScrapedPromos separadas con mismo title+sourceUrl, ej: Macro AmEx + Mastercard + Visa)
      const allGroupNetworks: CardNetworkWithType[] = group.flatMap((g: any) =>
        Array.isArray(g.cardNetworks) ? g.cardNetworks : []
      );

      const resolvedCardNetworks: Array<{ cardNetworkId: string | null; cardType: 'CREDIT' | 'DEBIT' | null; cardSegmentId: string | null }> = [];

      if (allGroupNetworks.length > 0) {
        const seen = new Set<string>();
        for (const item of allGroupNetworks) {
          // Si viene con nombre exacto de red y segmento (ej: Macro), buscar cardSegment directo
          let segmentId: string | null = null;
          let networkId: string | null = null;

          if (item.cardNetworkName && item.segmentName) {
            const segMatch = cardSegments.find(cs =>
              normalizeStr(cs.cardNetwork.name) === normalizeStr(item.cardNetworkName!) &&
              normalizeStr(cs.name) === normalizeStr(item.segmentName!)
            );
            segmentId = segMatch?.id ?? null;
            networkId = segMatch?.cardNetworkId ?? null;
          }

          // Fallback: buscar por nombre genérico de red
          if (!networkId) {
            const netMatch = cardNetworks.find(cn =>
              normalizeStr(cn.name).includes(normalizeStr(item.network)) ||
              normalizeStr(item.network).includes(normalizeStr(cn.name)) ||
              (normalizeStr(item.network) === 'american express' && normalizeStr(cn.name).includes('american'))
            );
            networkId = netMatch?.id ?? null;
          }

          const key = segmentId ? `seg:${segmentId}` : `net:${networkId ?? 'null'}|${item.type}`;
          if (seen.has(key)) continue;
          seen.add(key);
          resolvedCardNetworks.push({ cardNetworkId: networkId, cardType: item.type, cardSegmentId: segmentId });
        }
      } else {
        resolvedCardNetworks.push({ cardNetworkId: null, cardType: null, cardSegmentId: null });
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
          console.log(`[WALLET MATCH] buscando: "${walletName}" → encontrado: ${walletMatch?.name ?? 'null'}`);
          resolvedWalletIds.push(walletMatch?.id ?? null);
        }
      } else {

        resolvedWalletIds.push(null);
      }

      // ── Descuentos únicos del grupo (30% reintegro + 6 CSI, etc.) ─────────
      const uniqueDiscounts: Array<{ discountValue: number; discountType: string }> = Array.from(
        new Map<string, { discountValue: number; discountType: string }>(
          group
            .filter((g: any) => g.discount)
            .map((g: any): [string, { discountValue: number; discountType: string }] => {
              const val = parseFloat(String(g.discount || '0'));
              const type: string = g.discountType || 'PERCENTAGE_REINTEGRO';
              return [`${val}-${type}`, { discountValue: val, discountType: type }];
            })
        ).values()
      );
      console.log(`[Route DEBUG] "${p.title}" → ${uniqueDiscounts.length} descuento(s):`, uniqueDiscounts);

      // ── Requirements: banco × wallet × red × descuento ────────────────────
      // Cuando hay wallet, no asignar cardNetwork (la billetera define el pago).
      // Solo agregar entrada null si hay wallet para que wallet-only no quede sin requirement.
      // Si no hay wallet y ya hay redes específicas, NO agregar null (evita matchear cualquier tarjeta).
      const hasWallet = resolvedWalletIds.some(w => w !== null)
      const hasSpecificNetworks = resolvedCardNetworks.some(n => n.cardNetworkId !== null)
      // Si hay wallets Y redes específicas, agregar null wallet para crear requirements de tarjeta también
      const walletIdsForLoop = hasWallet && hasSpecificNetworks && !resolvedWalletIds.includes(null)
        ? [...resolvedWalletIds, null]
        : resolvedWalletIds;
      const networksForLoop = resolvedCardNetworks.some(n => n.cardNetworkId === null)
        ? resolvedCardNetworks
        : hasWallet
          ? [...resolvedCardNetworks, { cardNetworkId: null, cardType: null, cardSegmentId: null }]
          : resolvedCardNetworks;

      const reqData: any[] = [];
      for (const bankId of resolvedBankIds) {
        for (const walletId of walletIdsForLoop) {
          for (const networkWithType of networksForLoop) {
            // Evitar combinaciones imposibles: wallet + red de tarjeta específica
            if (walletId && networkWithType.cardNetworkId) continue;
            for (const discount of uniqueDiscounts) {
              let segmentId = null;
              if (bankId && p.segment) {
                const bankObj = banks.find(b => b.id === bankId);
                if (bankObj && bankObj.segments) {
                  const segMatch = bankObj.segments.find(s => normalizeStr(s.name) === normalizeStr(p.segment));
                  if (segMatch) segmentId = segMatch.id;
                }
              }

              reqData.push({
                bankId,
                walletId,
                cardNetworkId: networkWithType.cardNetworkId,
                cardSegmentId: (networkWithType as any).cardSegmentId ?? null,
                cardType: networkWithType.cardType,
                paymentChannel: (['ANY', 'QR', 'NFC', 'TARJETA_FISICA', 'TRANSFERENCIA', 'DINERO_EN_CUENTA'].includes(p.paymentChannel) ? p.paymentChannel : 'ANY') as any,
                accountType: (p.accountType as any) ?? 'ANY',
                discountType: discount.discountType,
                discountValue: discount.discountValue,
                cap: p.cap != null ? parseFloat(String(p.cap)) : null,
                capPeriod: (p.capPeriod as any) ?? null,
                capTarget: (p.capTarget as any) ?? (p.cap ? 'USER' : null),
                minPurchase: p.minPurchase != null ? parseFloat(String(p.minPurchase)) : null,
                cardTier: (p.cardTier as any) ?? null,
                segment: p.segment ?? null,
                segmentId: segmentId,
                note: p.note ?? null,
              });
            }
          }
        }
      }

      if (p.title.includes('40%')) {
        console.log(`[Route DEBUG] reqData para "${p.title}":`, JSON.stringify(reqData.slice(0, 3), null, 2));
      }

      // Generar slug descriptivo para SEO
      const firstDiscount = uniqueDiscounts[0]
      const firstBank = resolvedBankIds[0] ? banks.find(b => b.id === resolvedBankIds[0])?.name : null
      const firstWallet = resolvedWalletIds[0] ? wallets.find(w => w.id === resolvedWalletIds[0])?.name : null
      const baseSlug = generatePromoSlug({
        storeName: p.storeName || comMatch.name,
        discountValue: firstDiscount?.discountValue ?? 0,
        discountType: firstDiscount?.discountType ?? 'PERCENTAGE_DESCUENTO',
        bankName: firstBank,
        walletName: firstWallet,
        validDays: p.validDays,
        title: p.title,
      })

      const promoData = {
        title: p.title,
        description: p.description || '',
        stackable: p.stackable ?? false,
        validFrom: p.validFrom ? new Date(p.validFrom) : new Date(),
        validUntil: p.validUntil ? new Date(p.validUntil) : endOfMonth,
        validDays: p.validDays ?? 127,
        specificDates: p.specificDates ? JSON.stringify(p.specificDates) : null,
        categoryId: catMatch.id,
        commerceId: comMatch.id,
        status: 'ACTIVE' as const,
        sourceUrl: p.sourceUrl ?? null,
        sourceText: p.sourceText ?? null,
      };

      // ── Upsert de la promo ────────────────────────────────────────────────



      resolvedItems.push({ promoData, reqData, baseSlug, sourceUrl: p.sourceUrl, title: p.title, commerceId: comMatch.id });
    }

    // ── FASE 2: Pre-cargar promos existentes ──────────────────────────────────
    const existingPromos = await prisma.promo.findMany({
      where: {
        OR: [
          { sourceUrl: { in: resolvedItems.map(i => i.sourceUrl).filter(Boolean) as string[] } },
          ...resolvedItems.map(i => ({ title: i.title, commerceId: i.commerceId }))
        ]
      },
      select: { id: true, title: true, commerceId: true, sourceUrl: true, slug: true }
    });
    const byUrl = new Map(existingPromos.filter(p => p.sourceUrl?.includes('#')).map(p => [p.sourceUrl!, p]));
    const byKey = new Map(existingPromos.map(p => [`${p.title}|${p.commerceId}`, p]));
    const existingSlugs = new Set((await prisma.promo.findMany({ select: { slug: true } })).map(p => p.slug).filter(Boolean));

    // ── FASE 3: Guardar en batches paralelos de 10 ────────────────────────────
    const savePromo = async (item: ResolvedItem) => {
      const { promoData, reqData, baseSlug, sourceUrl, title, commerceId } = item;
      const hasUniqueUrl = sourceUrl?.includes('#');
      const existing = hasUniqueUrl
        ? byUrl.get(sourceUrl!)
        : byKey.get(`${title}|${commerceId}`);

      if (existing) {
        await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
        let slug = baseSlug;
        if (existingSlugs.has(slug) && existing.slug !== slug) slug = `${baseSlug}-${existing.id.slice(-4)}`;
        await prisma.promo.update({ where: { id: existing.id }, data: { ...promoData, slug, requirements: { create: reqData } } });
      } else {
        let slug = baseSlug;
        if (existingSlugs.has(slug)) slug = `${baseSlug}-${Date.now().toString(36)}`;
        existingSlugs.add(slug);
        try {
          await prisma.promo.create({ data: { ...promoData, slug, requirements: { create: reqData } } });
        } catch (e: any) {
          if (e?.code === 'P2002') {
            slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
            await prisma.promo.create({ data: { ...promoData, slug, requirements: { create: reqData } } });
          } else throw e;
        }
      }
      processedCount++;
    };

    const BATCH = 5;
    for (let i = 0; i < resolvedItems.length; i += BATCH) {
      await Promise.all(resolvedItems.slice(i, i + BATCH).map(savePromo));
      console.log(`[Scrape] Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(resolvedItems.length / BATCH)} — ${Math.min(i + BATCH, resolvedItems.length)}/${resolvedItems.length}`);
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

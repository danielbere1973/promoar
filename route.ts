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
    // ── Leer parámetros del body ──────────────────────────────────────────────
    let scraperFilter: string | undefined;
    let categoriaFilter: string | undefined;
    try {
      const body = await req.json();
      scraperFilter = body.scraper;
      categoriaFilter = body.categoria;
    } catch { /* body vacío, correr todos */ }

    // ── Seleccionar scrapers ──────────────────────────────────────────────────
    const scrapersToRun = ALL_SCRAPERS.filter(s =>
      !scraperFilter || s.name.toLowerCase() === scraperFilter.toLowerCase()
    );

    console.log(`[Scrape] Corriendo: ${scrapersToRun.map(s => s.name).join(', ')}${categoriaFilter ? ` | Categoría: ${categoriaFilter}` : ''}`);

    // ── Correr scrapers secuencialmente ──────────────────────────────────────
    const flatPromos: any[] = [];
    for (const scraper of scrapersToRun) {
      const result = await (scraper as any).run(categoriaFilter);
      flatPromos.push(...result);
    }
    console.log(`[Scrape] Total promos encontradas: ${flatPromos.length}`);

    // ── Cargar entidades de la DB ─────────────────────────────────────────────
    const categories = await prisma.category.findMany();
    const banks = await prisma.bank.findMany();
    const wallets = await prisma.wallet.findMany();
    let commerces = await prisma.commerce.findMany();
    const cardNetworks = await prisma.cardNetwork.findMany();
    console.log(`[Scrape] CardNetworks cargadas de DB:`, cardNetworks.map(cn => ({ id: cn.id, name: cn.name, type: typeof cn.name })));

    let processedCount = 0;
    let skippedNoCategory = 0;
    let skippedNoCommerce = 0;

    for (const p of flatPromos) {
      if (!p.title || !p.discount) continue;

      // ── Categoría (comparación sin tildes) ───────────────────────────────────
      const catMatch = categories.find(c =>
        normalizeStr(c.name) === normalizeStr(p.categoria ?? '')
      );
      if (!catMatch) {
        skippedNoCategory++;
        console.log(`[Scrape] Sin categoría: "${p.title}" (categoria scraper: "${p.categoria}")`);
        continue;
      }

      // ── Comercio — match exacto, luego parcial, luego auto-crear ─────────────
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
        console.log(`[Scrape] Upsert comercio: "${p.storeName}" → slug: "${slug}"`);
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

      // ── Redes de tarjeta (array) ─────────────────────────────────────────────
      const resolvedNetworkIds: (string | null)[] = [];
      if (p.cardNetworks && p.cardNetworks.length > 0) {
        console.log(`[Scrape] cardNetworks para "${p.title}":`, JSON.stringify(p.cardNetworks));
        for (const networkName of p.cardNetworks) {
          // Asegurar que networkName es un string
          if (!networkName || typeof networkName !== 'string') {
            console.log(`[Scrape] ⚠️  Skipping invalid network:`, networkName, typeof networkName);
            continue;
          }
          
          const netMatch = cardNetworks.find(cn =>
            cn.name && typeof cn.name === 'string' && (
              normalizeStr(cn.name).includes(normalizeStr(networkName)) ||
              normalizeStr(networkName).includes(normalizeStr(cn.name))
            )
          );
          if (netMatch) {
            resolvedNetworkIds.push(netMatch.id);
            console.log(`[Scrape] ✅ Red matched: ${networkName} → ${netMatch.name}`);
          } else {
            console.log(`[Scrape] ⚠️  Red no encontrada en DB: ${networkName}`);
          }
        }
      }
      // Si no hay redes, poner null
      if (resolvedNetworkIds.length === 0) {
        resolvedNetworkIds.push(null);
      }

      // ── Bancos ───────────────────────────────────────────────────────────────
      const resolvedBankIds: (string | null)[] = [];
      if (p.bankNames && p.bankNames.length > 0) {
        for (const bankItem of p.bankNames) {
          // bankItem puede ser string o {name, bcraCode}
          const bankName = typeof bankItem === 'string' ? bankItem : bankItem?.name;
          if (!bankName || typeof bankName !== 'string') continue;
          
          const bankMatch = banks.find(b =>
            normalizeStr(b.name).includes(normalizeStr(bankName)) ||
            normalizeStr(bankName).includes(normalizeStr(b.name))
          );
          resolvedBankIds.push(bankMatch?.id ?? null);
        }
      } else {
        resolvedBankIds.push(null);
      }

      // ── Wallets ──────────────────────────────────────────────────────────────
      const resolvedWalletIds: (string | null)[] = [];
      if (p.walletNames && p.walletNames.length > 0) {
        for (const walletItem of p.walletNames) {
          // walletItem puede ser string o objeto
          const walletName = typeof walletItem === 'string' ? walletItem : walletItem?.name;
          if (!walletName || typeof walletName !== 'string') continue;
          
          const walletMatch = wallets.find(w =>
            normalizeStr(w.name) === normalizeStr(walletName) ||
            normalizeStr(walletName).includes(normalizeStr(w.name))
          );
          resolvedWalletIds.push(walletMatch?.id ?? null);
        }
      } else {
        resolvedWalletIds.push(null);
      }

      // ── Descuento ────────────────────────────────────────────────────────────
      const numericDiscount = parseFloat(p.discount || '0');
      const discountType = (p.discountType as any) || 'PERCENTAGE_REINTEGRO';

      // ── Requirements (banco × wallet × red) ──────────────────────────────────
      const reqData: any[] = [];
      for (const bankId of resolvedBankIds) {
        for (const walletId of resolvedWalletIds) {
          for (const networkId of resolvedNetworkIds) {
            reqData.push({
              bankId,
              walletId,
              cardNetworkId: networkId,
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

      // ── Datos de la promo ────────────────────────────────────────────────────
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

      // ── Upsert ───────────────────────────────────────────────────────────────
      const existing = p.sourceUrl
        ? await prisma.promo.findFirst({ where: { sourceUrl: p.sourceUrl } })
        : await prisma.promo.findFirst({ where: { title: p.title, commerceId: comMatch.id } });

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

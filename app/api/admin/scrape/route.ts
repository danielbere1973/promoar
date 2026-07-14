export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ALL_SCRAPERS } from '@/lib/scrapers';
import { generatePromoSlug } from '@/lib/utils/promoSlug';
import { detectCategoria, detectSalesChannel } from '@/lib/scrapers/bank-helpers';

function normalizeStr(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toSlug(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Nombres genéricos de "Cencosud" que los scrapers traen como storeName pero
// no son comercios reales — se reparten entre Jumbo/Disco/Vea (ver CLAUDE.md punto 4).
const CENCOSUD_GENERIC_NAMES = new Set([
  'cencosud productos seleccionados',
  'especial cencosud',
]);

// Palabras gen\u00e9ricas que pueden preceder el nombre de un comercio sin ser parte de su identidad
// (ej. "Supermercados Disco" \u2192 comercio "Disco"; pero "Morena Disco" \u2192 comercio distinto)
const GENERIC_PREFIXES = new Set(['super', 'supermercado', 'supermercados', 'hipermercado', 'hipermercados', 'farmacia', 'farmacias', 'tienda', 'tiendas', 'mercado', 'mercados', 'local', 'locales'])

function hasOnlyGenericPrefix(fullNorm: string, commerceNorm: string): boolean {
  const idx = fullNorm.indexOf(commerceNorm)
  if (idx === 0) return true
  const prefix = fullNorm.slice(0, idx).trim()
  return prefix.split(/\s+/).every(w => GENERIC_PREFIXES.has(w))
}

// Busca un comercio existente por nombre exacto, substring (con word boundary,
// m\u00ednimo 4 chars) o alias conocido (CommerceAlias).
function matchCommerceByName(name: string, commerces: any[], aliases: any[]): any | undefined {
  const norm = normalizeStr(name);
  let match = commerces.find((c: any) => normalizeStr(c.name) === norm);
  if (!match) {
    match = commerces.find((c: any) => {
      const normC = normalizeStr(c.name);
      // Requiere m\u00ednimo 4 chars y word boundary para evitar falsos positivos ("vea" en "alvear")
      // Adem\u00e1s, si el nombre entrante tiene palabras ANTES del comercio, deben ser solo gen\u00e9ricas
      // (evita "Morena Disco" \u2192 "Disco", pero permite "Supermercados Disco" \u2192 "Disco")
      if (normC.length >= 4 && norm.includes(normC) && new RegExp(`\\b${normC}\\b`).test(norm) && hasOnlyGenericPrefix(norm, normC)) return true;
      // Igual para el caso inverso: "disco" no debe matchear "Morena Disco" (nombre propio antes)
      if (norm.length >= 4 && normC.includes(norm) && new RegExp(`\\b${norm}\\b`).test(normC) && hasOnlyGenericPrefix(normC, norm)) return true;
      return false;
    });
  }
  if (!match) {
    const aliasMatch = aliases.find((a: any) => normalizeStr(a.alias) === norm);
    if (aliasMatch) match = commerces.find((c: any) => c.id === aliasMatch.commerceId);
  }
  return match;
}

// Evita guardar placeholders de lazy-loading (data: URIs gigantes) u otras URLs
// inv\u00e1lidas como logoUrl de un comercio.
function isUsableLogoUrl(url?: string | null): url is string {
  if (!url) return false;
  if (url.length > 500) return false;
  return /^https?:\/\//i.test(url);
}

// Detecta logos "rotos": favicons genéricos de Google o data URIs que quedaron
// guardados de scrapes anteriores. Estos deben poder reemplazarse por un logo
// real cuando el scraper lo encuentre, a diferencia de un logoUrl ya bueno.
function isBrokenLogo(url?: string | null): boolean {
  if (!url) return true;
  return url.startsWith('data:') || url.includes('google.com/s2/favicons');
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface CardNetworkWithType {
  network: string;
  type: 'CREDIT' | 'DEBIT' | null;
  cardNetworkName?: string;
  segmentName?: string;
}

// Fingerprint de promo: serializa los campos que el scraper puede cambiar.
// Si el fingerprint coincide con el existente en DB, se skippea el write.
// - validFrom se excluye: defaultea a new Date() cuando el scraper no lo provee → siempre difiere
// - validUntil se redondea a semana (÷7 días) para tolerar el default "fin de mes" que cambia cada mes
function promoFingerprint(data: any, reqs: any[]): string {
  const sortedReqs = [...new Set([...reqs]
    .map(r => [r.bankId ?? '', r.walletId ?? '', r.cardNetworkId ?? '',
               r.discountType, r.discountValue, r.paymentChannel ?? '', r.cardType ?? '',
               r.cap ?? '', r.capPeriod ?? '', r.minPurchase ?? ''].join('|'))
  )].sort()
  const validUntilMs = data.validUntil instanceof Date ? data.validUntil.getTime() : (data.validUntil ? new Date(data.validUntil).getTime() : 0)
  const validUntilWeek = validUntilMs ? String(Math.floor(validUntilMs / (7 * 24 * 3600 * 1000))) : ''
  return [
    validUntilWeek,
    String(data.validDays ?? ''),
    String(data.maxDiscountPct ?? ''),
    String(data.isCSIOnly ?? ''),
    String(data.salesChannel ?? ''),
    sortedReqs.join(';'),
  ].join('||')
}

export async function POST(req: NextRequest) {
  try {
    let scraperFilter: string | undefined;
    let categoriaFilter: string | undefined;
    let preScrapedPromos: any[] | undefined;
    let forceLocal = false;
    try {
      const body = await req.json();
      scraperFilter = body.scraper;
      categoriaFilter = body.categoria;
      preScrapedPromos = body.promos; // promos pre-scrapeadas desde GitHub Actions
      forceLocal = !!body.forceLocal; // solapa "Local" del admin — saltea guard Playwright
    } catch { /* body vacío */ }

    // Scrapers que requieren Playwright — no pueden correr en Vercel (Chromium no disponible)
    const PLAYWRIGHT_SCRAPER_NAMES = new Set([
      'jumbo', 'disco', 'vea', 'amex', 'cabal', 'changomas',
      'banco galicia', 'icbc', 'banco macro', 'naranjax', 'banco provincia',
      'banco santander', 'banco supervielle', 'banco ciudad', 'visa', 'banco patagonia',
      // BNA: digiventures.la bloquea IPs de datacenter de AWS/Vercel
      'banco nación argentina',
    ])

    const flatPromos: any[] = [];

    if (preScrapedPromos?.length) {
      // Promos enviadas externamente (scrapers Playwright desde GitHub Actions)
      flatPromos.push(...preScrapedPromos);
      console.log(`[Scrape] Procesando ${flatPromos.length} promos pre-scrapeadas`);
    } else {
      // Bloquear scrapers Playwright si no es ejecución local explícita
      if (!forceLocal && scraperFilter && PLAYWRIGHT_SCRAPER_NAMES.has(scraperFilter.toLowerCase())) {
        return NextResponse.json({ error: `Scraper "${scraperFilter}" requiere Playwright — usar GitHub Actions` }, { status: 400 })
      }
      const scrapersToRun = ALL_SCRAPERS.filter(s =>
        !scraperFilter || s.name.toLowerCase() === scraperFilter.toLowerCase()
      );
      console.log(`[Scrape] Corriendo: ${scrapersToRun.map(s => s.name).join(', ')}${categoriaFilter ? ` | Categoría: ${categoriaFilter}` : ''}`);
      for (const scraper of scrapersToRun) {
        const result = await (scraper as any).run(categoriaFilter);
        flatPromos.push(...result);
      }
      console.log(`[Scrape] Total promos encontradas: ${flatPromos.length}`);
    }

    // ── Separar promos marcadas para revisión manual ──────────────────────────
    const flaggedPromos = flatPromos.filter((p: any) => p.discountType === 'PENDIENTE_REVISION');
    const processablePromos = flatPromos.filter((p: any) => p.discountType !== 'PENDIENTE_REVISION');
    if (flaggedPromos.length > 0) {
      console.log(`[Scrape] ⚠️ ${flaggedPromos.length} promo(s) sin descuento detectado: ${flaggedPromos.map((p: any) => p.title).join(', ')}`);
    }

    // ── PRE-PROCESAMIENTO: combinar % + CSI del mismo item de API ────────────
    // Cuando un scraper genera 2 ScrapedPromos del mismo item (misma sourceUrl
    // única) con distinto discountType (ej: 20% + 3 CSI), las renombra con un
    // título combinado para que el agrupador las fusione en una sola promo DB.
    const isUniqueSourceUrl = (url?: string) =>
      !!url && (url.includes('#') || /\/detalle\/\d+/.test(url));
    const bySourceUrl = new Map<string, any[]>();
    for (const p of processablePromos) {
      if (!isUniqueSourceUrl(p.sourceUrl)) continue;
      if (!bySourceUrl.has(p.sourceUrl!)) bySourceUrl.set(p.sourceUrl!, []);
      bySourceUrl.get(p.sourceUrl!)!.push(p);
    }
    for (const [, grp] of bySourceUrl) {
      if (grp.length < 2) continue;
      const types = new Set(grp.map((g: any) => g.discountType));
      const hasCSI = types.has('CUOTAS_SIN_INTERES');
      const hasPct = types.has('PERCENTAGE_DESCUENTO') || types.has('PERCENTAGE_REINTEGRO');
      if (!hasCSI || !hasPct) continue;
      const pctItem = grp.find((g: any) => g.discountType !== 'CUOTAS_SIN_INTERES');
      const csiItem = grp.find((g: any) => g.discountType === 'CUOTAS_SIN_INTERES');
      if (!pctItem || !csiItem) continue;
      // Extraer la parte del título después del " – " (nombre del comercio + sufijos)
      const storePart = pctItem.title.split(' – ').slice(1).join(' – ');
      const pctLabel = pctItem.discountType === 'PERCENTAGE_REINTEGRO' ? 'reintegro' : 'descuento';
      const combinedTitle = `${parseFloat(pctItem.discount)}% ${pctLabel} + ${parseFloat(csiItem.discount)} cuotas sin interés – ${storePart}`;
      for (const p of grp) p.title = combinedTitle;
    }

    // ── AGRUPACIÓN: title + sourceUrl → 1 Promo con N Requirements ───────────
    // Permite que "30% reintegro + 6 CSI" del mismo comercio genere
    // una sola Promo con dos PromoRequirements distintos.
    const grouped = new Map<string, any[]>();
    for (const p of processablePromos) {
      const key = `${p.title}|||${p.sourceUrl || p.storeName || 'NO_URL'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    }
    console.log(`[Scrape] ${processablePromos.length} promos → ${grouped.size} promos únicas agrupadas`);

    // ── Fetch masivo de entidades (una sola vez) ───────────────────────────
    const categories = await prisma.category.findMany();
    const sinCategoria = categories.find(c => c.slug === 'sin-categoria');
    const banks = await prisma.bank.findMany({ include: { cardNetworks: { select: { id: true } }, segments: true } });
    const wallets = await prisma.wallet.findMany();
    let commerces = await (prisma.commerce as any).findMany({ select: { id: true, name: true, slug: true, logoUrl: true, active: true, website: true, defaultCategoryId: true } });
    const commerceAliases = await (prisma.commerceAlias as any).findMany({ select: { alias: true, commerceId: true } });
    const cardNetworks = await prisma.cardNetwork.findMany();
    const cardSegments = await prisma.cardSegment.findMany({ include: { cardNetwork: true } });

    // Default de fin de mes para promos sin validUntil explícito
    const endOfMonth = new Date()
    endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0)
    endOfMonth.setHours(23, 59, 59, 0)

    let processedCount = 0;
    let skippedNoCategory = 0;
    let skippedNoCommerce = 0;
    let skippedUnchanged = 0;
    let fpMismatchCount = 0;
    const changedCommerceIds = new Set<string>();

    // Cache de sucursales existentes por comercio (para no repetir queries ni duplicar pines)
    const branchesByCommerce = new Map<string, Array<{ lat: number; lng: number }>>();

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
      // 1. defaultCategoryId del comercio (curado manualmente) — pisa lo que diga el scraper
      let catMatch: typeof categories[number] | undefined;
      if (p.storeName) {
        const knownCom = (commerces as any[]).find((c: any) => normalizeStr(c.name) === normalizeStr(p.storeName ?? ''));
        if (knownCom?.defaultCategoryId) {
          catMatch = categories.find(c => c.id === knownCom.defaultCategoryId) ?? undefined;
        }
      }
      // 2. Categoría del scraper
      if (!catMatch) {
        catMatch = categories.find(c =>
          normalizeStr(c.name) === normalizeStr(p.categoria ?? '')
        );
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
      let comMatch = commerces.find((c: any) =>
        normalizeStr(c.name) === normalizeStr(p.storeName ?? '')
      );

      // ── Promos genéricas "Cencosud" (no son comercios reales) ──────────────
      // Macro/AmEx etc. traen storeName "CENCOSUD PRODUCTOS SELECCIONADOS" o
      // "Especial Cencosud" para promos que aplican a todas las cadenas del
      // grupo → repartir entre Jumbo/Disco/Vea en vez de crear un comercio ficticio.
      let multiComMatches: any[] | undefined;
      if (!comMatch && p.storeName && CENCOSUD_GENERIC_NAMES.has(normalizeStr(p.storeName))) {
        const cencosudTargets = ['jumbo', 'disco', 'vea']
          .map(name => commerces.find((c: any) => normalizeStr(c.name) === name))
          .filter(Boolean) as any[];
        if (cencosudTargets.length === 3) {
          multiComMatches = cencosudTargets;
        }
      }

      // ── Detección de promos multi-comercio ("Disco y Vea", "X & Y") ────────
      // Si el nombre completo no matcheó un comercio exacto y ambas partes
      // separadas por "y"/"&" matchean comercios reales distintos, duplicar
      // la promo en cada uno en vez de crear/usar un comercio combinado ficticio.
      if (!comMatch && !multiComMatches && p.storeName && /\s(y|&)\s/i.test(p.storeName)) {
        const parts = p.storeName.split(/\s+(?:y|&)\s+/i).map((s: string) => s.trim()).filter(Boolean);
        if (parts.length === 2) {
          const matches = parts.map((part: string) => matchCommerceByName(part, commerces, commerceAliases));
          if (matches[0] && matches[1] && matches[0].id !== matches[1].id) {
            multiComMatches = matches;
          }
        }
      }

      if (!comMatch && !multiComMatches && p.storeName) {
        comMatch = matchCommerceByName(p.storeName, commerces, commerceAliases);
      }

      if (comMatch && isBrokenLogo(comMatch.logoUrl) && isUsableLogoUrl(p.storeLogoUrl)) {
        comMatch = await prisma.commerce.update({
          where: { id: comMatch.id },
          data: { logoUrl: p.storeLogoUrl }
        });
        // Actualizar en la lista local para siguientes promos del mismo scrape
        const idx = commerces.findIndex((c: any) => c.id === comMatch!.id);
        if (idx !== -1) commerces[idx] = comMatch;
      }

      if (!comMatch && !multiComMatches && p.storeName) {
        const slug = toSlug(p.storeName);
        comMatch = await prisma.commerce.upsert({
          where: { slug },
          update: {
            name: p.storeName,
            ...(isUsableLogoUrl(p.storeLogoUrl) ? { logoUrl: p.storeLogoUrl } : {})
          },
          create: {
            name: p.storeName,
            slug,
            active: true,
            ...(isUsableLogoUrl(p.storeLogoUrl) ? { logoUrl: p.storeLogoUrl } : {})
          },
        });
        commerces = [...commerces, comMatch];
      }

      const commerceTargets: any[] = multiComMatches ?? (comMatch ? [comMatch] : []);
      if (commerceTargets.length === 0) {
        skippedNoCommerce++;
        continue;
      }
      comMatch = commerceTargets[0];

      // ── Sucursales (ej. BBVA trae canalesVenta.sucursales por promo) ───────
      if (p.branches && p.branches.length > 0) {
        let existing = branchesByCommerce.get(comMatch.id);
        if (!existing) {
          existing = await prisma.commerceBranch.findMany({
            where: { commerceId: comMatch.id },
            select: { lat: true, lng: true },
          });
          branchesByCommerce.set(comMatch.id, existing);
        }
        for (const b of p.branches) {
          // Evitar duplicar un pin ya existente (OSM u otra fuente) a ~100m o menos
          const isDuplicate = existing.some(e => distanceKm(e.lat, e.lng, b.lat, b.lng) < 0.1);
          if (isDuplicate) continue;
          const osmId = `${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
          await prisma.commerceBranch.upsert({
            where: { source_osmId: { source: 'BBVA', osmId } },
            update: { address: b.address, city: b.city, commerceId: comMatch.id },
            create: { commerceId: comMatch.id, address: b.address, city: b.city, lat: b.lat, lng: b.lng, source: 'BBVA', osmId },
          });
          existing.push({ lat: b.lat, lng: b.lng });
        }
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
      const uniqueDiscounts: Array<{ discountValue: number; discountType: string; nxmN?: number | null; nxmM?: number | null }> = Array.from(
        new Map<string, { discountValue: number; discountType: string; nxmN?: number | null; nxmM?: number | null }>(
          group
            .filter((g: any) => g.discount)
            .map((g: any): [string, { discountValue: number; discountType: string; nxmN?: number | null; nxmM?: number | null }] => {
              const type: string = g.discountType || 'PERCENTAGE_REINTEGRO';
              if (type === 'NXM') {
                // "2x1", "3x2", etc. → nxmN compra, nxmM paga
                const m = String(g.discount || '').match(/(\d+)\s*[xX]\s*(\d+)/);
                const nxmN = m ? parseInt(m[1]) : 2;
                const nxmM = m ? parseInt(m[2]) : 1;
                return [`NXM-${nxmN}-${nxmM}`, { discountValue: 0, discountType: type, nxmN, nxmM }];
              }
              const val = parseFloat(String(g.discount || '0'));
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
            // Evitar requirement fantasma: sin banco, sin wallet, sin red
            // Excepción: accountType JUBILADO/HABERES/ANSES es un constraint válido sin entidad bancaria
            const hasAccountConstraint = p.accountType && p.accountType !== 'ANY'
            if (!bankId && !walletId && !networkWithType.cardNetworkId && !hasAccountConstraint) continue;
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
                nxmN: discount.nxmN ?? null,
                nxmM: discount.nxmM ?? null,
                cap: p.cap != null ? parseFloat(String(p.cap)) : null,
                capUnlimited: p.capUnlimited ?? false,
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

      // Deduplicar requirements por combinación única de entidad + descuento
      // (evita duplicados cuando un scraper genera la misma entidad por múltiples variantes de tarjeta)
      {
        const seen = new Set<string>();
        const deduped: any[] = [];
        for (const r of reqData) {
          const key = [r.bankId, r.walletId, r.cardNetworkId, r.cardSegmentId, r.discountType, r.discountValue].join('|');
          if (!seen.has(key)) { seen.add(key); deduped.push(r); }
        }
        reqData.length = 0;
        reqData.push(...deduped);
      }

      // Generar slug descriptivo para SEO
      const firstDiscount = uniqueDiscounts[0]
      const firstBank = resolvedBankIds[0] ? banks.find(b => b.id === resolvedBankIds[0])?.name : null
      const firstWallet = resolvedWalletIds[0] ? wallets.find(w => w.id === resolvedWalletIds[0])?.name : null

      const salesChannel = p.salesChannel
        ?? detectSalesChannel(`${p.title} ${p.description} ${p.sourceText ?? ''}`)

      // ── Generar slug + promoData por cada comercio destino ────────────────
      // (normalmente 1, pero 2 si es una promo multi-comercio "Disco y Vea")
      for (const target of commerceTargets) {
        const baseSlug = generatePromoSlug({
          storeName: multiComMatches ? target.name : (p.storeName || target.name),
          discountValue: firstDiscount?.discountValue ?? 0,
          discountType: firstDiscount?.discountType ?? 'PERCENTAGE_DESCUENTO',
          bankName: firstBank,
          walletName: firstWallet,
          validDays: p.validDays,
          title: p.title,
        })

        // Desnormalizar campos de ordenamiento (mantenidos en sync con la DB)
        const pctReqsForSort = reqData.filter(r =>
          r.discountType !== 'CUOTAS_SIN_INTERES' &&
          r.discountType !== 'NXM' &&
          r.discountType !== 'FIXED_AMOUNT' &&
          (r.discountValue ?? 0) > 0
        )
        const maxDiscountPct = pctReqsForSort.length > 0
          ? Math.round(Math.max(...pctReqsForSort.map((r: any) => r.discountValue ?? 0)))
          : null
        const hasNxmReq = reqData.some((r: any) => r.discountType === 'NXM')
        const isCSIOnly = pctReqsForSort.length === 0 && !hasNxmReq

        const promoData = {
          title: p.title,
          description: p.description || '',
          stackable: p.stackable ?? false,
          validFrom: (() => {
            const d = p.validFrom ? new Date(p.validFrom) : new Date()
            return isNaN(d.getTime()) ? new Date() : d
          })(),
          validUntil: (() => {
            const d = p.validUntil ? new Date(p.validUntil) : endOfMonth
            return isNaN(d.getTime()) ? endOfMonth : d
          })(),
          validDays: p.validDays ?? 127,
          specificDates: p.specificDates ? JSON.stringify(p.specificDates) : null,
          categoryId: target.defaultCategoryId ?? catMatch.id,
          commerceId: target.id,
          status: 'ACTIVE' as const,
          sourceUrl: p.sourceUrl ?? null,
          sourceText: p.sourceText ?? null,
          salesChannel: salesChannel ?? null,
          commerceNote: p.note ?? null,
          maxDiscountPct,
          isCSIOnly,
        };

        resolvedItems.push({ promoData, reqData, baseSlug, sourceUrl: p.sourceUrl, title: p.title, commerceId: target.id });
      }
    }

    // ── FASE 2: Pre-cargar promos existentes con fingerprint ──────────────────
    // Cargamos todas las promos de los comercios involucrados (IN es mucho más eficiente
    // que un OR con 1000+ condiciones individuales que puede truncar o fallar en Neon)
    const involvedCommerceIds = [...new Set(resolvedItems.map(i => i.commerceId))]
    const existingPromos = await prisma.promo.findMany({
      where: {
        commerceId: { in: involvedCommerceIds }
      },
      select: {
        id: true, title: true, commerceId: true, sourceUrl: true, slug: true, status: true,
        validFrom: true, validUntil: true, validDays: true, maxDiscountPct: true, isCSIOnly: true,
        salesChannel: true,
        requirements: {
          select: {
            bankId: true, walletId: true, cardNetworkId: true, cardSegmentId: true,
            discountType: true, discountValue: true, paymentChannel: true, cardType: true,
            cap: true, capPeriod: true, minPurchase: true,
          }
        }
      }
    });

    // Una URL es clave única si tiene # (fragmento) O si contiene /detalle/ con un ID numérico
    const isUniqueUrl = (url?: string | null) =>
      !!url && (url.includes('#') || /\/detalle\/\d+/.test(url));
    const byUrl = new Map(existingPromos.filter(p => isUniqueUrl(p.sourceUrl)).map(p => [p.sourceUrl!, p]));
    const byKey = new Map(existingPromos.map(p => [`${p.title}|${p.commerceId}`, p]));
    const existingSlugs = new Set((await prisma.promo.findMany({ select: { slug: true } })).map(p => p.slug).filter(Boolean));

    // Deduplicar resolvedItems: si el mismo (commerceId, título normalizado) aparece
    // varias veces (distintos slots MODO para el mismo comercio), quedarse con el primero.
    {
      const seen = new Set<string>();
      const deduped: typeof resolvedItems = [];
      for (const item of resolvedItems) {
        const key = `${item.commerceId}|${item.title.toLowerCase().trim()}`;
        if (!seen.has(key)) { seen.add(key); deduped.push(item); }
      }
      resolvedItems.length = 0;
      resolvedItems.push(...deduped);
    }

    // ── FASE 3: Guardar en batches paralelos de 10 ────────────────────────────
    const newPromoIds: string[] = []

    const savePromo = async (item: ResolvedItem) => {
      const { promoData, reqData, baseSlug, sourceUrl, title, commerceId } = item;
      // byUrl puede mapear a una promo con distinto título si el scraper genera
      // múltiples promos del mismo item (misma URL, distinto discountType).
      // En ese caso ignorar byUrl y caer en byKey.
      const byUrlMatch = isUniqueUrl(sourceUrl) ? byUrl.get(sourceUrl!) : undefined;
      const existing = (byUrlMatch && byUrlMatch.title === title)
        ? byUrlMatch
        : byKey.get(`${title}|${commerceId}`);

      if (existing) {
        // Comparar fingerprint — si nada cambió, skip total (0 queries)
        const newFp = promoFingerprint(promoData, reqData);
        const existingFp = promoFingerprint(existing, (existing as any).requirements ?? []);
        if (newFp === existingFp) {
          skippedUnchanged++;
          processedCount++;
          return; // sin cambios, no tocar la DB
        }
        if (fpMismatchCount < 3) {
          console.log(`[FP DIFF] "${title}": new=${newFp} | old=${existingFp}`)
        }
        fpMismatchCount++;
        changedCommerceIds.add(commerceId);
        try {
          await prisma.promoRequirement.deleteMany({ where: { promoId: existing.id } });
          let slug = baseSlug;
          if (existingSlugs.has(slug) && existing.slug !== slug) slug = `${baseSlug}-${existing.id.slice(-4)}`;
          // Si el scraper trae un validUntil nuevo y vigente para una promo que había quedado
          // EXPIRED (venció y el sitio la volvió a publicar con fecha renovada), reactivarla.
          const newValidUntil = promoData.validUntil instanceof Date ? promoData.validUntil : (promoData.validUntil ? new Date(promoData.validUntil) : null)
          const renewedAndValid = existing.status === 'EXPIRED' && (!newValidUntil || newValidUntil >= new Date())
          const nextStatus = renewedAndValid ? 'ACTIVE' : existing.status;
          await prisma.promo.update({ where: { id: existing.id }, data: { ...promoData, slug, status: nextStatus, requirements: { create: reqData } } });
        } catch (e: any) {
          if (e?.code === 'P2002') {
            // Slug duplicado al actualizar — skipear, ya existe una promo con ese slug
          } else throw e;
        }
      } else {
        let slug = baseSlug;
        if (existingSlugs.has(slug)) slug = `${baseSlug}-${Date.now().toString(36)}`;
        existingSlugs.add(slug);
        try {
          const created = await prisma.promo.create({ data: { ...promoData, slug, status: 'DRAFT', requirements: { create: reqData } } });
          newPromoIds.push(created.id);
          changedCommerceIds.add(commerceId);
        } catch (e: any) {
          if (e?.code === 'P2002') {
            // Slug duplicado — skipear silenciosamente, es una promo duplicada
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

    console.log(`[Scrape] ✅ Procesadas: ${processedCount} | Sin cambios (skip): ${skippedUnchanged} | Sin categoría: ${skippedNoCategory} | Sin comercio: ${skippedNoCommerce}`);

    // Actualizar activePromoCount solo en comercios que realmente cambiaron, en batches
    const affectedCommerceIds = Array.from(changedCommerceIds)
    for (let i = 0; i < affectedCommerceIds.length; i += 5) {
      await Promise.all(affectedCommerceIds.slice(i, i + 5).map(async (cid) => {
        const count = await prisma.promo.count({ where: { commerceId: cid, status: 'ACTIVE' } })
        await prisma.commerce.update({ where: { id: cid }, data: { activePromoCount: count } })
      }))
    }

    // Disparar notificaciones push para las promos nuevas (fire-and-forget)
    if (newPromoIds.length > 0) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
      fetch(`${baseUrl}/api/push/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.VTEX_SESSION_SECRET}`,
        },
        body: JSON.stringify({ promoIds: newPromoIds }),
      }).catch((e) => console.error('[push/notify] Error:', e))
    }

    return NextResponse.json({
      message: 'Scraping completado con éxito',
      totalFound: flatPromos.length,
      totalGrouped: grouped.size,
      processed: processedCount,
      skippedUnchanged,
      skippedNoCategory,
      skippedNoCommerce,
      flagged: flaggedPromos.map((p: any) => ({
        title: p.title,
        storeName: p.storeName,
        sourceUrl: p.sourceUrl,
        description: p.description,
      })),
    });

  } catch (error) {
    console.error('Error scrapeando:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

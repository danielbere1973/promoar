export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bankIds = searchParams.getAll('bankId');
    const segmentIds = searchParams.getAll('segmentId');
    const cardNetworkIds = searchParams.getAll('cardNetworkId');
    const cardSegmentIds = searchParams.getAll('cardSegmentId');
    const accountTypes = searchParams.getAll('accountType');
    const categoryIds = searchParams.getAll('categoryId');
    const scrapers = searchParams.getAll('scraper');

    // Construir el filtro base para Promo
    const promoWhere: any = {};
    if (categoryIds.length > 0) {
      promoWhere.categoryId = { in: categoryIds };
    }
    
    // Filtro por scraper
    if (scrapers.length > 0) {
      const scraperDomains: Record<string, string> = {
        'Galicia': 'galicia.ar',
        'Coto': 'coto.com.ar',
        'Jumbo': 'jumbo.com.ar',
        'Disco': 'disco.com.ar',
        'Vea': 'vea.com.ar',
        'Carrefour': 'carrefour.com.ar',
        'MODO': 'modo.com.ar'
      };
      const domains = scrapers.map(s => scraperDomains[s]).filter(Boolean);
      if (domains.length > 0) {
        promoWhere.OR = domains.map(d => ({ sourceUrl: { contains: d, mode: 'insensitive' } }));
      }
    }

    // Separar bankIds de walletIds (el combo Bancos y Billeteras mezcla ambos)
    const allWallets = await prisma.wallet.findMany({ select: { id: true } });
    const walletIdSet = new Set(allWallets.map(w => w.id));
    const realBankIds = bankIds.filter(id => !walletIdSet.has(id));
    const realWalletIds = bankIds.filter(id => walletIdSet.has(id));

    // Filtro por Requerimientos (Banco, Segmento, Tarjeta, Tipo Cuenta)
    const reqFilter: any = {};
    if (realBankIds.length > 0 && realWalletIds.length > 0) {
      reqFilter.OR = [
        { bankId: { in: realBankIds } },
        { walletId: { in: realWalletIds } },
      ];
    } else if (realBankIds.length > 0) {
      reqFilter.bankId = { in: realBankIds };
    } else if (realWalletIds.length > 0) {
      reqFilter.walletId = { in: realWalletIds };
    }
    if (cardNetworkIds.length > 0) reqFilter.cardNetworkId = { in: cardNetworkIds };
    if (cardSegmentIds.length > 0) reqFilter.cardSegmentId = { in: cardSegmentIds };
    if (accountTypes.length > 0) reqFilter.accountType = { in: accountTypes };

    // Segmento banco: puede estar en segmentId O en cardTier (ej: Selecta, Eminent)
    if (segmentIds.length > 0) {
      const segs = await prisma.bankSegment.findMany({
        where: { id: { in: segmentIds } },
        select: { id: true, name: true }
      });
      const VALID_TIERS = new Set(['CLASSIC','GOLD','PLATINUM','SIGNATURE','BLACK','INFINITE','EMINENT','SELECTA']);
      const tierValues = segs.map(s => s.name.toUpperCase()).filter(t => VALID_TIERS.has(t));
      reqFilter.OR = [
        { segmentId: { in: segmentIds } },
        ...(tierValues.length > 0 ? [{ cardTier: { in: tierValues } }] : []),
      ];
    }

    if (Object.keys(reqFilter).length > 0) {
      promoWhere.requirements = { some: reqFilter };
    }

    const totalPromos = await prisma.promo.count({ where: promoWhere });
    
    if (totalPromos === 0) {
      return NextResponse.json({
        totalPromos: 0,
        byCommerce: [],
        byCategory: [],
        byBank: [],
        byScraper: [],
        withoutCategory: { count: 0, percent: 0 },
        byBankSegment: [],
        byCardSegment: []
      });
    }

    // 1. Por Comercio
    const byCommerceRaw = await prisma.promo.groupBy({
      by: ['commerceId'],
      where: promoWhere,
      _count: { id: true },
    });
    const commerces = await prisma.commerce.findMany();
    const byCommerce = byCommerceRaw.map(stat => {
      const name = commerces.find(c => c.id === stat.commerceId)?.name || 'Desconocido';
      return {
        name,
        count: stat._count.id,
        percent: Number(((stat._count.id / totalPromos) * 100).toFixed(1))
      };
    }).sort((a, b) => b.count - a.count);

    // 2. Por Rubro
    const byCategoryRaw = await prisma.promo.groupBy({
      by: ['categoryId'],
      where: promoWhere,
      _count: { id: true },
    });
    const categories = await prisma.category.findMany();
    const byCategory = byCategoryRaw.map(stat => {
      const name = categories.find(c => c.id === stat.categoryId)?.name || 'Sin Categoría';
      return {
        name,
        count: stat._count.id,
        percent: Number(((stat._count.id / totalPromos) * 100).toFixed(1))
      };
    }).sort((a, b) => b.count - a.count);

    // 3. Por Banco
    const bankFilterForReq: any = { bankId: { not: null } };
    if (realBankIds.length > 0) bankFilterForReq.bankId = { in: realBankIds };

    const promosConBanco = await prisma.promo.findMany({
      where: { ...promoWhere, requirements: { some: bankFilterForReq } },
      include: { requirements: { select: { bankId: true }, where: bankFilterForReq } }
    });

    const bankMap: Record<string, number> = {};
    promosConBanco.forEach(p => {
      const uniqueBanks = new Set(p.requirements.map(r => r.bankId).filter(Boolean));
      uniqueBanks.forEach(bid => {
        if (bid) bankMap[bid] = (bankMap[bid] || 0) + 1;
      });
    });

    const banks = await prisma.bank.findMany();
    const byBank = Object.entries(bankMap).map(([bid, count]) => {
      const name = banks.find(b => b.id === bid)?.name || 'Otro';
      return {
        name,
        count,
        percent: Number(((count / totalPromos) * 100).toFixed(1))
      };
    }).sort((a, b) => b.count - a.count);

    // 4. Por Scraper
    const allSources = await prisma.promo.findMany({
      where: promoWhere,
      select: { sourceUrl: true }
    });
    const SCRAPER_DOMAINS: Array<{ name: string; patterns: string[] }> = [
      { name: 'AmEx',           patterns: ['americanexpress.com'] },
      { name: 'BBVA',           patterns: ['bbva.com.ar'] },
      { name: 'BNA',            patterns: ['semananacion.com.ar', 'bna.com.ar'] },
      { name: 'Brubank',        patterns: ['brubank.com'] },
      { name: 'Cabal',          patterns: ['bancocredicoop.coop', 'credicoop.com.ar'] },
      { name: 'Carrefour',      patterns: ['carrefour.com.ar'] },
      { name: 'ChangoMás',      patterns: ['masonline.com.ar'] },
      { name: 'Ciudad',         patterns: ['bancociudad.com.ar'] },
      { name: 'Clarín 365',     patterns: ['365.clarin.com'] },
      { name: 'Club La Nación', patterns: ['club.lanacion.com.ar'] },
      { name: 'Coto',           patterns: ['coto.com.ar'] },
      { name: 'Cuenta DNI',     patterns: ['bancoprovincia.com.ar'] },
      { name: 'DIA',            patterns: ['supermercadosdia.com.ar'] },
      { name: 'Diarco',         patterns: ['diarco.com.ar'] },
      { name: 'Disco',          patterns: ['disco.com.ar'] },
      { name: 'Galicia',        patterns: ['galicia.ar'] },
      { name: 'ICBC',           patterns: ['beneficios.icbc.com.ar', 'icbc.com.ar'] },
      { name: 'Jumbo',          patterns: ['jumbo.com.ar'] },
      { name: 'Macro',          patterns: ['macro.com.ar'] },
      { name: 'MercadoPago',    patterns: ['mercadopago.com'] },
      { name: 'MODO',           patterns: ['modo.com.ar'] },
      { name: 'Naranja X',      patterns: ['naranjax.com'] },
      { name: 'Openpay',        patterns: ['openpayargentina.com'] },
      { name: 'Patagonia',      patterns: ['bancopatagonia.com.ar'] },
      { name: 'Personal Pay',   patterns: ['personal.com.ar'] },
      { name: 'Santander',      patterns: ['santander.com.ar'] },
      { name: 'Supervielle',    patterns: ['supervielle.com.ar'] },
      { name: 'Vea',            patterns: ['vea.com.ar'] },
      { name: 'VISA',           patterns: ['visa.com.ar'] },
    ];

    const scraperMap: Record<string, number> = {};
    allSources.forEach(p => {
      const url = p.sourceUrl?.toLowerCase() || '';
      let sName = 'Manual / Otro';
      for (const { name, patterns } of SCRAPER_DOMAINS) {
        if (patterns.some(pat => url.includes(pat))) { sName = name; break; }
      }
      scraperMap[sName] = (scraperMap[sName] || 0) + 1;
    });

    const byScraper = Object.entries(scraperMap).map(([name, count]) => ({
      name,
      count,
      percent: Number(((count / totalPromos) * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);

    // 5. Por Segmento de Banco
    const segmentWhere: any = { NOT: { segmentId: null } };
    if (bankIds.length > 0) segmentWhere.bankId = { in: bankIds };

    const byBankSegmentRaw = await prisma.promoRequirement.groupBy({
      by: ['segmentId'],
      where: { ...segmentWhere, promo: promoWhere },
      _count: { promoId: true },
    });
    const bankSegments = await prisma.bankSegment.findMany({ include: { bank: true } });
    const byBankSegment = byBankSegmentRaw.map(stat => {
      const s = bankSegments.find(x => x.id === stat.segmentId);
      return {
        bankName: s?.bank.name || 'Desconocido',
        segmentName: s?.name || 'General',
        count: stat._count.promoId
      };
    }).sort((a, b) => b.count - a.count);

    // 7. Por Segmento de Tarjeta
    const byCardSegmentRaw = await prisma.promoRequirement.groupBy({
      by: ['cardSegmentId'],
      where: { NOT: { cardSegmentId: null } },
      _count: { promoId: true },
    });
    const cardSegments = await prisma.cardSegment.findMany({ include: { cardNetwork: true } });
    const byCardSegment = byCardSegmentRaw.map(stat => {
      const s = cardSegments.find(x => x.id === stat.cardSegmentId);
      return {
        networkName: s?.cardNetwork.name || 'Desconocida',
        segmentName: s?.name || 'General',
        type: s?.cardType || 'ANY',
        count: stat._count.promoId,
        percent: Number(((stat._count.promoId / totalPromos) * 100).toFixed(1))
      };
    }).sort((a, b) => b.count - a.count);

    // 8. Por Tipo de Tarjeta
    const byCardTypeRaw = await prisma.promoRequirement.groupBy({
      by: ['cardType'],
      where: { 
        NOT: { cardType: null },
        promo: promoWhere 
      },
      _count: { promoId: true },
    });
    const cardTypeLabels: Record<string, string> = {
      'CREDIT': 'Crédito',
      'DEBIT': 'Débito',
      'PREPAID': 'Prepaga',
      'ACCOUNT': 'Cuenta'
    };
    const byCardType = byCardTypeRaw.map(stat => ({
      name: cardTypeLabels[stat.cardType || ''] || stat.cardType,
      count: stat._count.promoId,
      percent: Number(((stat._count.promoId / totalPromos) * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);

    // 9. Por Tipo de Cuenta (Sueldo, Jubilado, etc)
    const byAccountTypeRaw = await prisma.promoRequirement.groupBy({
      by: ['accountType'],
      where: { 
        NOT: { accountType: 'ANY' },
        promo: promoWhere 
      },
      _count: { promoId: true },
    });
    const accountTypeLabels: Record<string, string> = {
      'HABERES': 'Sueldo / Haberes',
      'JUBILADO': 'Jubilados',
      'ANSES': 'ANSES / Beneficiarios'
    };
    const byAccountType = byAccountTypeRaw.map(stat => ({
      name: accountTypeLabels[stat.accountType] || stat.accountType,
      count: stat._count.promoId,
      percent: Number(((stat._count.promoId / totalPromos) * 100).toFixed(1))
    })).sort((a, b) => b.count - a.count);

    // 8. Sin Categoría
    const catOtros = categories.find(c => c.name.toLowerCase() === 'otros' || c.name.toLowerCase() === 'sin categoría');
    const countSinCat = byCategoryRaw.find(s => s.categoryId === null || s.categoryId === catOtros?.id)?._count.id || 0;

    return NextResponse.json({
      totalPromos,
      byCommerce,
      byCategory,
      byBank,
      byScraper,
      withoutCategory: {
        count: countSinCat,
        percent: Number(((countSinCat / totalPromos) * 100).toFixed(1))
      },
      byBankSegment,
      byCardSegment,
      byCardType,
      byAccountType
    });

  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

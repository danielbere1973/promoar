// Personal Pay Scraper
// API: https://www.personal.com.ar/pay/api/benefits?offset=0&limit=200

import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';

const PAGE_URL = 'https://www.personal.com.ar/pay/beneficios';
const API_URL = 'https://www.personal.com.ar/pay/api/benefits';
const WALLET_NAME = 'Personal Pay';

const DAY_MAP: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2,
  'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
};

function parseDays(days: string[]): number {
  if (!days || days.length === 0) return 127;

  const joined = days.join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (joined.includes('todos') || joined.includes('diario') || joined.includes('permanente')) return 127;

  // Range: "lunes a miercoles"
  const rangeMatch = joined.match(/(\w+)\s+a\s+(\w+)/);
  if (rangeMatch) {
    const start = DAY_MAP[rangeMatch[1]];
    const end = DAY_MAP[rangeMatch[2]];
    if (start !== undefined && end !== undefined) {
      let mask = 0;
      for (let i = start; i <= end; i++) mask |= 1 << i;
      return mask;
    }
  }

  let mask = 0;
  for (const day of days) {
    const norm = day.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const [name, bit] of Object.entries(DAY_MAP)) {
      if (norm.includes(name)) mask |= 1 << bit;
    }
  }
  return mask > 0 ? mask : 127;
}

function parseCap(limitAmount: string): number | null {
  if (!limitAmount) return null;
  const m = limitAmount.match(/[\d.,]+/);
  if (!m) return null;
  return parseFloat(m[0].replace(/\./g, '').replace(',', '.'));
}

function inferPaymentChannel(paymentMethods: { id: string; name: string }[]): ScrapedPromo['paymentChannel'] {
  const names = paymentMethods.map(p => p.name.toLowerCase());
  const hasCard = names.some(n => n.includes('tarjeta'));
  const hasQR = names.some(n => n.includes('qr'));
  const hasNFC = names.some(n => n.includes('nfc'));
  const hasCupon = names.some(n => n.includes('cup'));
  const hasSaldo = names.some(n => n.includes('saldo') || n.includes('app'));

  if (hasCupon) return 'ANY';
  if (hasCard && !hasQR && !hasNFC && !hasSaldo) return 'TARJETA_FISICA';
  if (hasQR || hasNFC) return 'QR';
  if (hasSaldo) return 'DINERO_EN_CUENTA';
  return 'ANY';
}

async function fetchPage(offset: number, limit: number) {
  const res = await fetch(`${API_URL}?offset=${offset}&limit=${limit}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data?.benefits as any[] ?? [];
}

export const PersonalPayScraper: Scraper = {
  name: 'Personal Pay',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[PersonalPay] Iniciando scraper...');
    const allPromos: ScrapedPromo[] = [];

    try {
      // Paginate: limit 200 per request
      let offset = 0;
      const limit = 200;
      let allBenefits: any[] = [];

      while (true) {
        const batch = await fetchPage(offset, limit);
        if (batch.length === 0) break;
        allBenefits = allBenefits.concat(batch);
        if (batch.length < limit) break;
        offset += batch.length;
      }

      console.log(`[PersonalPay] ${allBenefits.length} beneficios recibidos`);

      for (const item of allBenefits) {
        try {
          const storeName: string = (item.title || '').trim();
          if (!storeName) continue;

          const discountStr: string = item.discounts || '';
          const pct = parseInt(discountStr.replace('%', ''));
          if (!pct || isNaN(pct)) continue;

          const typeCode: string = item.typeCode || 'Discount';
          const discountType = typeCode === 'Cashback' ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';

          const days: string[] = item.days || [];
          const validDays = parseDays(days);
          const daysLabel = item.subtitle?.replace(/\.$/, '') || days.join(', ') || 'Todos los días';

          const cap = parseCap(item.limitAmount || '');
          const logoUrl: string = item.partnerImage || item.image || '';

          const paymentMethods: { id: string; name: string }[] = item.paymentMethods || [];
          const paymentChannel = inferPaymentChannel(paymentMethods);
          const hasVisaCard = paymentMethods.some(p => p.name.toLowerCase().includes('tarjeta'));

          const categoria = detectCategoria(storeName) || 'Otros';

          const validUntil = item.dueDate ? new Date(item.dueDate) : undefined;

          const typeLabel = typeCode === 'Cashback' ? 'reintegro' : 'descuento';
          const title = `${pct}% de ${typeLabel} – ${storeName}`;
          const description = `${pct}% de ${typeLabel} en ${storeName}. ${daysLabel}.${cap ? ` Tope: $${cap.toLocaleString('es-AR')}.` : ''}`;

          allPromos.push({
            storeName,
            storeLogoUrl: logoUrl || undefined,
            title,
            description,
            sourceText: `${discountStr} ${typeLabel} ${storeName} ${daysLabel}`,
            sourceUrl: PAGE_URL,
            discount: String(pct),
            discountType,
            cap: cap ?? null,
            capPeriod: cap ? 'WEEKLY' : undefined,
            capTarget: cap ? 'USER' : undefined,
            validDays,
            validUntil,
            walletNames: [WALLET_NAME],
            cardNetworks: hasVisaCard
              ? [{ network: 'Visa', type: 'CREDIT' as const }]
              : [],
            categoria,
            paymentChannel,
          } as ScrapedPromo);
        } catch (err) {
          console.error('[PersonalPay] Error parseando item:', err);
        }
      }
    } catch (err) {
      console.error('[PersonalPay] Error durante scraping:', err);
    }

    console.log(`[PersonalPay] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

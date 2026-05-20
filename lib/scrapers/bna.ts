// Banco Nación Argentina (BNA) Scraper — Semana Nación
// API pública: backend.activx.production.digiventures.la
//   GET /api/promotions/?bank=bna-semananacion&checkValidity=true
//   GET /api/brands/{id} → title del comercio

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria } from './bank-helpers';

const API_BASE  = 'https://backend.activx.production.digiventures.la/api';
const PAGE_URL  = 'https://semananacion.com.ar/semananacion';
const BANK_NAME = 'Banco Nación';

// Mapeo de nombres de categoría BNA → nuestra DB
const CAT_MAP: Record<string, string> = {
  'gastronomia':          'Gastronomía',
  'gastronomía':          'Gastronomía',
  'supermercado':         'Supermercados',
  'farmacia':             'Farmacias',
  'combustible':          'Combustible',
  'combustibles':         'Combustible',
  'automotor':            'Automotores',
  'automotores':          'Automotores',
  'concesionaria':        'Automotores',
  'tecnologia':           'Tecnología',
  'tecnología':           'Tecnología',
  'indumentaria':         'Indumentaria',
  'moda':                 'Indumentaria',
  'mascota':              'Mascotas',
  'petshop':              'Mascotas',
  'transporte':           'Transporte',
  'turismo':              'Viajes y Turismo',
  'viaje':                'Viajes y Turismo',
  'hogar':                'Hogar',
  'construccion':         'Hogar',
  'decoracion':           'Hogar',
  'entretenimiento':      'Entretenimiento',
  'salud':                'Salud y Belleza',
  'belleza':              'Salud y Belleza',
  'deporte':              'Deportes',
  'juguete':              'Jugueterías',
  'libreria':             'Librerías',
  'shopping':             'Shoppings',
};

function mapCategoria(catName: string): string {
  const n = catName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, val] of Object.entries(CAT_MAP)) {
    if (n.includes(key)) return val;
  }
  return '';
}

// activeDays: ["MO","TU","WE","TH","FR","SA","SU"] → bitmask
const DAY_CODE: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

function parseActiveDays(days: string[]): number {
  if (!Array.isArray(days) || days.length === 0) return 127;
  let mask = 0;
  for (const d of days) {
    const bit = DAY_CODE[d.toUpperCase()];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return mask > 0 ? mask : 127;
}

function parseCardNetworks(products: string[]): CardNetworkWithType[] {
  const nets: CardNetworkWithType[] = [];
  const seen = new Set<string>();
  for (const p of products ?? []) {
    const isVisa = /visa/i.test(p);
    const isMC   = /mc|master/i.test(p);
    const type: 'CREDIT' | 'DEBIT' | null =
      /credit/i.test(p) ? 'CREDIT' : /debit/i.test(p) ? 'DEBIT' : null;
    if (isVisa && !seen.has(`VISA|${type}`)) {
      nets.push({ network: 'VISA', type });
      seen.add(`VISA|${type}`);
    }
    if (isMC && !seen.has(`MC|${type}`)) {
      nets.push({ network: 'Mastercard', type });
      seen.add(`MC|${type}`);
    }
  }
  return nets;
}

async function apiFetch(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': PAGE_URL,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const BNAScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[BNA] Iniciando scraper...');
    const allPromos: ScrapedPromo[] = [];

    // 1. Obtener todas las promociones vigentes
    const promoData = await apiFetch(
      `${API_BASE}/promotions/?bank=bna-semananacion&checkValidity=true&select=brands+incentive+activeDays+endDate+startDate+promotionProducts+categories+legal+legalText+terms`
    );

    if (!promoData || !Array.isArray(promoData)) {
      console.log('[BNA] No se pudieron obtener promociones');
      return [];
    }

    console.log(`[BNA] ${promoData.length} promociones encontradas`);

    // 2. Obtener todos los brand IDs únicos
    const brandIds = new Set<string>();
    for (const promo of promoData) {
      for (const b of promo.brands ?? []) {
        const id = typeof b === 'string' ? b : b._id;
        if (id) brandIds.add(id);
      }
    }

    console.log(`[BNA] ${brandIds.size} brands únicos, obteniendo títulos...`);

    // 3. Obtener título de cada brand
    const brandTitles = new Map<string, string>();
    const brandIdsArr = Array.from(brandIds);
    for (let i = 0; i < brandIdsArr.length; i++) {
      const id = brandIdsArr[i];
      await delay(100);
      const brand = await apiFetch(`${API_BASE}/brands/${id}`);
      if (brand?.title) {
        brandTitles.set(id, brand.title);
      }
      if ((i + 1) % 20 === 0) {
        console.log(`[BNA] Brands procesados: ${i + 1}/${brandIdsArr.length}`);
      }
    }

    console.log(`[BNA] ${brandTitles.size} títulos obtenidos. Procesando promos...`);

    // 4. Construir promos
    for (const promo of promoData) {
      const incentive     = promo.incentive ?? {};
      let discount        = incentive.discount?.value ?? null;
      const cashbackLimit = incentive.discount?.cashbackLimit ?? null;
      let installments    = Array.isArray(incentive.installment?.value) && incentive.installment.value.length > 0
        ? Math.max(...incentive.installment.value)
        : null;
      let discountType    = 'PERCENTAGE_REINTEGRO';
      let fixedAmount: number | null = null;

      // Si no hay descuento numérico, intentar parsear custom.value (texto/HTML)
      if ((!discount || discount <= 0) && !installments) {
        const raw = (incentive.custom?.value ?? '')
          .replace(/<[^>]+>/g, ' ')  // strip HTML
          .trim();

        // "Hasta -25%" o "25% off" o "Hasta 25%"
        const pctMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (pctMatch) {
          const v = parseFloat(pctMatch[1].replace(',', '.'));
          if (v > 0 && v <= 100) {
            discount = v;
            discountType = /reintegro|cashback|ahorro/i.test(raw) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
          }
        }

        // "$5.000 adicionales" → monto fijo
        if (!discount) {
          const fixedMatch = raw.match(/\$\s*([\d.,]+)/);
          if (fixedMatch) {
            fixedAmount = parseFloat(fixedMatch[1].replace(/\./g, '').replace(',', '.'));
          }
        }

        // X cuotas en custom
        if (!discount && !fixedAmount) {
          const custCSI = raw.match(/(\d+)\s+cuotas?\s+sin\s+inter[eé]s/i);
          if (custCSI) installments = parseInt(custCSI[1]);
        }

        if ((!discount || discount <= 0) && !fixedAmount && !installments) continue;
      }

      const validDays  = parseActiveDays(promo.activeDays ?? []);
      const validFrom  = promo.startDate ? String(promo.startDate).split('T')[0] : undefined;
      const validUntil = promo.endDate   ? String(promo.endDate).split('T')[0]   : undefined;
      const cardNetworks = parseCardNetworks(promo.promotionProducts ?? []);

      // Cap period desde cashbackFrequency
      const cashbackFreq = incentive.discount?.cashbackFrequency ?? '';
      const capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined =
        cashbackFreq === 'daily' ? 'DAILY' :
        cashbackFreq === 'weekly' ? 'WEEKLY' :
        cashbackFreq === 'monthly' ? 'MONTHLY' :
        cashbackLimit ? 'MONTHLY' : undefined;

      // Mínimo de compra desde custom.value
      const customRaw = (incentive.custom?.value ?? '').replace(/<[^>]+>/g, ' ').trim();
      let minPurchase: number | null = null;
      const minMatch = customRaw.match(/m[íi]nimo[^$\d]*\$?\s*([\d.,]+)/i);
      if (minMatch) minPurchase = parseFloat(minMatch[1].replace(/\./g, '').replace(',', '.'));

      // Account type desde custom.value
      const accountType =
        /jubilad|pensionad/i.test(customRaw) ? 'JUBILADO' :
        /haberes|plan\s+sueldo/i.test(customRaw) ? 'HABERES' :
        /anses/i.test(customRaw) ? 'ANSES' : 'ANY';

      // Payment channel y salesChannel desde campo channel
      const promoDesc = (promo.description ?? '').toUpperCase();
      const paymentChannel =
        promo.channel === 'online' ? 'ANY' :
        /QR/.test(promoDesc) ? 'QR' : 'ANY';
      const salesChannel: 'ONLINE' | 'FISICA' | null =
        promo.channel === 'online' ? 'ONLINE' :
        promo.channel === 'physical' ? 'FISICA' : null;

      // Categoría del array de categorías
      const catName  = promo.categories?.[0]?.name ?? promo.categories?.[0] ?? '';
      const catFromApi = mapCategoria(typeof catName === 'string' ? catName : '');

      // Una promo puede tener múltiples brands (comercios)
      const brandIds_: string[] = (promo.brands ?? []).map((b: any) =>
        typeof b === 'string' ? b : b._id
      ).filter(Boolean);

      for (const brandId of brandIds_) {
        const storeName = brandTitles.get(brandId) ?? '';
        if (!storeName) continue;
        const categoria = catFromApi || detectCategoria(storeName);

        const description = [
          discount ? `${discount}% de reintegro` : '',
          installments ? `${installments} cuotas sin interés` : '',
          minPurchase ? `Mínimo $${minPurchase.toLocaleString('es-AR')}` : '',
          cashbackLimit ? `Tope $${cashbackLimit.toLocaleString('es-AR')}` : '',
        ].filter(Boolean).join(' | ');

        const legalText = [promo.legal, promo.legalText, promo.terms, customRaw]
          .filter(Boolean).join(' ').trim();
        const base: Partial<ScrapedPromo> = {
          storeName,
          description,
          sourceText:   legalText || description,
          sourceUrl:    PAGE_URL,
          validFrom,
          validUntil,
          validDays,
          cap:          cashbackLimit ?? null,
          capPeriod,
          minPurchase,
          accountType:  accountType as any,
          bankNames:    [BANK_NAME],
          cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
          paymentChannel: paymentChannel as any,
          salesChannel,
          categoria,
        };

        if (discount && discount > 0) {
          allPromos.push({
            ...base,
            title:        `${discount}% ${discountType === 'PERCENTAGE_REINTEGRO' ? 'reintegro' : 'descuento'} – ${storeName}`,
            discount:     String(discount),
            discountType,
          } as ScrapedPromo);
        }
        if (fixedAmount && fixedAmount > 0) {
          allPromos.push({
            ...base,
            title:        `$${fixedAmount.toLocaleString('es-AR')} descuento – ${storeName}`,
            discount:     String(fixedAmount),
            discountType: 'FIXED_AMOUNT',
          } as ScrapedPromo);
        }
        if (installments) {
          allPromos.push({
            ...base,
            title:        `${installments} cuotas sin interés – ${storeName}`,
            discount:     String(installments),
            discountType: 'CUOTAS_SIN_INTERES',
          } as ScrapedPromo);
        }
      }
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.storeName}|${p.discount}|${p.discountType}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[BNAScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

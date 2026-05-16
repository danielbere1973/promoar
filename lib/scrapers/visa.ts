// VISA Argentina Scraper
// Fuente: https://www.visa.com.ar/es_ar/promociones/?redemptionCountry=9
// Técnica: Playwright (Angular SPA)
// Estructura real: todos los beneficios están en la página a la vez.
// Cada card <li class="vs-col-md-*"> tiene badges internos <li class="contrast-borders">
// que indican qué tiers son elegibles (Visa Signature, Visa Platinum, etc.).
// No hay tabs de filtro — extraemos todas las cards de una sola carga.

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';

const BASE_URL = 'https://www.visa.com.ar/es_ar/promociones/?redemptionCountry=9';

const TIER_NAME_MAP: Record<string, ScrapedPromo['cardTier']> = {
  'visa signature': 'SIGNATURE',
  'visa platinum':  'PLATINUM',
  'visa gold':      'GOLD',
  'visa classic':   'CLASSIC',
  'visa infinite':  'INFINITE',
  'visa black':     'BLACK',
};
const MAIN_TIERS = new Set(['SIGNATURE', 'PLATINUM', 'GOLD', 'CLASSIC']);

// ─── helpers ──────────────────────────────────────────────────────────────────

function execAll(regex: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function extractValidDays(text: string): number {
  const t = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/TODOS LOS D[IÍ]AS|LUNES A DOMINGO/.test(t)) return 127;
  if (/LUNES A VIERNES/.test(t))  return 0b0111110;
  if (/LUNES A JUEVES/.test(t))   return 0b0011110;
  if (/S[AÁ]BADOS Y DOMINGOS|FIN DE SEMANA/.test(t)) return 0b1000001;
  if (/LUNES Y MARTES/.test(t))   return 0b0000110;
  if (/MI[EÉ]RCOLES Y JUEVES/.test(t)) return 0b0011000;
  if (/JUEVES Y VIERNES/.test(t)) return 0b0110000;
  if (/VIERNES Y S[AÁ]BADOS/.test(t)) return 0b1100000;

  let mask = 0;
  if (t.includes('DOMINGO'))    mask |= 1 << 0;
  if (t.includes('LUNES'))      mask |= 1 << 1;
  if (t.includes('MARTES'))     mask |= 1 << 2;
  if (t.includes('MI') && t.includes('RCOLES')) mask |= 1 << 3;
  if (t.includes('JUEVES'))     mask |= 1 << 4;
  if (t.includes('VIERNES'))    mask |= 1 << 5;
  if (t.includes('S') && t.includes('BADO') && !t.includes('SABADOS Y')) mask |= 1 << 6;
  return mask || 127;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string } {
  const norm = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const y = new Date().getFullYear();

  const parseNum = (s: string) => {
    const [dd, mm, yy] = s.split('/');
    return `${yy?.length === 2 ? '20' + yy : (yy || y)}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  };

  const numRange = norm.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (numRange) return { validFrom: parseNum(numRange[1]), validUntil: parseNum(numRange[2]) };

  const wordRange = norm.match(
    /DEL?\s+(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s+AL?\s+(\d{1,2})\s+(?:DE\s+)?([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/
  );
  if (wordRange) {
    const m1 = MONTHS[wordRange[2].toLowerCase()];
    const m2 = MONTHS[wordRange[4].toLowerCase()];
    const yr = wordRange[5] ? parseInt(wordRange[5]) : y;
    if (m1 && m2) return {
      validFrom:  `${yr}-${String(m1).padStart(2,'0')}-${wordRange[1].padStart(2,'0')}`,
      validUntil: `${yr}-${String(m2).padStart(2,'0')}-${wordRange[3].padStart(2,'0')}`,
    };
  }

  const singles = execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, norm);
  if (singles.length >= 2) {
    const dates = Array.from(new Set(singles.map(m => parseNum(m[1])))).sort();
    return { validFrom: dates[0], validUntil: dates[dates.length - 1] };
  }
  if (singles.length === 1) {
    const d = parseNum(singles[0][1]);
    return { validFrom: d, validUntil: d };
  }
  return {};
}

function extractDiscounts(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  for (const m of execAll(/(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|OFF|AHORRO|REINTEGRO|REEMBOLSO)/gi, text)) {
    const v = parseFloat(m[1]);
    const type = /REINTEGRO|REEMBOLSO/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }
  return results;
}

function extractInstallments(text: string): number | null {
  const m = text.match(/(\d+)\s+CUOTAS?\s+SIN\s+INTER[ÉE]S/i);
  return m ? parseInt(m[1]) : null;
}

function extractFixedAmount(text: string): number | null {
  // "$30.000 pesos argentinos de descuento" o "USD 30 de descuento"
  const m = text.match(/\$\s*([\d.,]+)\s*(?:pesos?|ars)?\s*(?:de\s+)?(?:descuento|ahorro|reintegro|off)/i);
  if (m) return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

function extractCap(text: string): number | null {
  const m = text.match(/(?:TOPE|M[ÁA]XIMO|HASTA)\s*\$\s*([\d.,]+)/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

function extractMinPurchase(text: string): number | null {
  const m = text.match(/(?:COMPRA?\s+M[ÍI]NIMA?|MONTO\s+M[ÍI]NIMO|A\s+PARTIR\s+DE)\s*:?\s*\$\s*([\d.,]+)/i);
  return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

function detectCategoria(storeName: string, text: string): string {
  const t = (storeName + ' ' + text).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/JUMBO|CARREFOUR|DISCO|COTO|VEA|WALMART|CHANGO|DIARCO|SUPERMERCADO|HIPER/.test(t)) return 'Supermercados';
  if (/FARMACIA|FARMACITY|DROGUERIA/.test(t)) return 'Farmacias';
  if (/YPF|SHELL|AXION|PETROBRAS|NAFTA|COMBUSTIBLE/.test(t)) return 'Combustible';
  if (/HELADERIA|HELADOS|FREDDO|CHUNGO|GRIDO|VOLTA|CREMOLATTI/.test(t)) return 'Heladerías';
  if (/HOTEL|VUELO|AEROLINEA|BOOKING|EDREAMS|IBIS|NOVOTEL|MERCURE|PULLMAN|ACCOR|DESPEGAR|TURISMO/.test(t)) return 'Viajes y Turismo';
  if (/DRAGONPASS|UBER|CABIFY|COLECTIVO|BUS|SUBTE|TREN|TAXI|TELEPASE/.test(t)) return 'Transporte';
  if (/RESTAURANT|PIZZA|BURGER|SUSHI|DELIVERY|GASTRONOMIA|COMIDA|STARBUCKS|CAFE|MCDONALD|PEDIDOSYA|RAPPI/.test(t)) return 'Gastronomía';
  if (/ELECTRO|GARBARINO|FRAVEGA|MUSIMUNDO|PC|NOTEBOOK|CELULAR|LENOVO/.test(t)) return 'Tecnología';
  if (/ADIDAS|NIKE|PUMA|REEBOK|BICICLETA|DEPORTE|FITNESS|GYM|DECATHLON/.test(t)) return 'Deportes';
  if (/ROPA|MODA|ZAPATILLAS|CALZADO|INDUMENTARIA|ZARA|MIMO/.test(t)) return 'Indumentaria';
  if (/PETSHOP|PETCO|VETERINARIA|MASCOTA/.test(t)) return 'Mascotas';
  if (/HOGAR|COLCHON|MUEBLE|DECORACION|EASY|SODIMAC/.test(t)) return 'Hogar';
  if (/CINE|TEATRO|ENTRADAS|TICKETEK|ENTRETENIMIENTO/.test(t)) return 'Entretenimiento';
  if (/OPTICA|BELLEZA|ESTETICA|PELUQUERIA|SPA|SALUD/.test(t)) return 'Salud y Belleza';
  if (/JUGUETE|TOYS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/SHOPPING/.test(t)) return 'Shoppings';
  return '';
}

// ─── parseCard ────────────────────────────────────────────────────────────────
interface RawCard {
  fullText: string;
  tiers: string[];  // e.g. ["Visa Signature", "Visa Platinum", "Visa Gold"]
}

function parseCard(card: RawCard, sourceUrl: string): ScrapedPromo[] {
  const text = card.fullText.trim();
  if (text.length < 20) return [];

  const discounts   = extractDiscounts(text);
  const installments = extractInstallments(text);
  const fixedAmount  = extractFixedAmount(text);
  if (discounts.length === 0 && !installments && !fixedAmount) return [];

  // Primera línea no-trivial → storeName
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const storeName = lines.find(l =>
    l.length > 2 && !/^visa\s/i.test(l) && l !== '.'
  ) || lines[0] || 'VISA Promo';

  const { validFrom, validUntil } = extractDates(text);
  const cap          = extractCap(text);
  const minPurchase  = extractMinPurchase(text);
  const categoria    = detectCategoria(storeName, text);

  // Resolver qué tiers aplican (solo los que conocemos)
  const resolvedTiers = card.tiers
    .map(t => TIER_NAME_MAP[t.toLowerCase()])
    .filter((t): t is NonNullable<ScrapedPromo['cardTier']> => !!t);

  // Si aplica a todos los tiers principales → null (sin restricción de tier)
  const coversAll = MAIN_TIERS.size > 0 &&
    Array.from(MAIN_TIERS).every(t => resolvedTiers.includes(t as any));
  const tiersToEmit: Array<ScrapedPromo['cardTier']> = coversAll
    ? [null]
    : resolvedTiers.length > 0
      ? resolvedTiers
      : [null];

  const base: Partial<ScrapedPromo> = {
    storeName,
    description:   text.slice(0, 500).replace(/\s+/g, ' ').trim(),
    sourceText:    text.slice(0, 8000),
    sourceUrl,
    validFrom,
    validUntil,
    validDays:     extractValidDays(text),
    cap:           cap ?? undefined,
    capPeriod:     cap ? 'MONTHLY' : undefined,
    minPurchase:   minPurchase ?? undefined,
    stackable:     /NO\s+(?:ES\s+)?ACUMULABLE/i.test(text) ? false : undefined,
    cardNetworks:  [{ network: 'VISA', type: 'CREDIT' }],
    categoria,
  };

  const promos: ScrapedPromo[] = [];

  for (const tier of tiersToEmit) {
    if (installments && discounts.length === 0) {
      promos.push({
        ...base,
        title: `${installments} cuotas sin interés – ${storeName}`,
        discount: String(installments),
        discountType: 'CUOTAS_SIN_INTERES',
        cardTier: tier,
      } as ScrapedPromo);
    } else if (fixedAmount && discounts.length === 0) {
      promos.push({
        ...base,
        title: `$${fixedAmount} descuento – ${storeName}`,
        discount: String(fixedAmount),
        discountType: 'FIXED_AMOUNT',
        cardTier: tier,
      } as ScrapedPromo);
    } else {
      for (const disc of discounts) {
        promos.push({
          ...base,
          title: `${disc.value}% ${disc.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}`,
          discount: String(disc.value),
          discountType: disc.type,
          cardTier: tier,
        } as ScrapedPromo);
      }
    }
  }

  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const VisaScraper: Scraper = {
  name: 'VISA',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Visa] Iniciando scraper...');
    const browser = await chromium.launch({ headless: true });
    const allPromos: ScrapedPromo[] = [];

    try {
      const page = await browser.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Esperar que Angular hidrate y cargue las cards
      await page.waitForTimeout(5000);

      // Extraer todas las cards con sus tiers estructurados
      const rawCards: RawCard[] = await page.evaluate(() => {
        const cards = Array.from(
          document.querySelectorAll('li[class*="vs-col-md-4"], li[class*="vs-col-md-6"]')
        );
        return cards.map(card => {
          const tierEls = Array.from(card.querySelectorAll('li.contrast-borders'));
          const tiers   = tierEls.map(t => (t as HTMLElement).innerText?.trim() ?? '').filter(Boolean);
          const fullText = (card as HTMLElement).innerText ?? '';
          return { fullText, tiers };
        });
      });

      console.log(`[Visa] ${rawCards.length} cards encontradas`);

      for (const card of rawCards) {
        const promos = parseCard(card, BASE_URL);
        allPromos.push(...promos);
      }

      await page.close();
    } finally {
      await browser.close();
    }

    // Deduplicar por título + tier + descuento + store
    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.discountType}|${p.cardTier}|${p.storeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[VisaScraper] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

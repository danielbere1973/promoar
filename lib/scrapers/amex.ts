// American Express Argentina Scraper
// Fuente: https://www.americanexpress.com/es-ar/beneficios/promociones/
// Técnica: Playwright — itera por página de categoría
// Estructura: cards con clase .contenedor-promociones en cada URL de categoría.

import { chromium, Page } from 'playwright';
import { Scraper, ScrapedPromo } from './types';

const HOME_URL  = 'https://www.americanexpress.com/es-ar/beneficios/promociones/';
const CATEGORY_URLS: { url: string; categoria: string }[] = [
  { url: `${HOME_URL}categoria/electro-hogar/`,    categoria: 'Tecnología' },
  { url: `${HOME_URL}categoria/moda/`,             categoria: 'Indumentaria' },
  { url: `${HOME_URL}categoria/restaurantes/`,     categoria: 'Gastronomía' },
  { url: `${HOME_URL}categoria/viajes/`,           categoria: 'Viajes y Turismo' },
  { url: `${HOME_URL}categoria/salidas/`,          categoria: 'Entretenimiento' },
  { url: `${HOME_URL}categoria/salud-y-belleza/`,  categoria: 'Salud y Belleza' },
  { url: `${HOME_URL}categoria/cuotas-amex/`,      categoria: 'Otros' },
];

// ─── helpers ──────────────────────────────────────────────────────────────────

function execAll(regex: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

const DAY_TO_BIT: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2,
  'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
};
const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function normStr(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractValidDays(text: string): number {
  const t = normStr(text);

  const rangeMatch = t.match(
    /(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADO|DOMINGO)\s+(?:A|AL?)\s+(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADO|DOMINGO)/i
  );
  if (rangeMatch) {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const a = DAY_TO_BIT[norm(rangeMatch[1])];
    const b = DAY_TO_BIT[norm(rangeMatch[2])];
    let mask = 0;
    if (a !== undefined && b !== undefined) {
      if (a <= b) for (let i = a; i <= b; i++) mask |= 1 << i;
      else { for (let i = a; i <= 6; i++) mask |= 1 << i; for (let i = 0; i <= b; i++) mask |= 1 << i; }
    }
    if (mask > 0) return mask;
  }

  let mask = 0;
  if (/\bDOMINGOS?\b/.test(t)) mask |= 1 << 0;
  if (/\bLUNES\b/.test(t))    mask |= 1 << 1;
  if (/\bMARTES\b/.test(t))   mask |= 1 << 2;
  if (/MI[EÉ]RCOLES/.test(t)) mask |= 1 << 3;
  if (/\bJUEVES\b/.test(t))   mask |= 1 << 4;
  if (/\bVIERNES\b/.test(t))  mask |= 1 << 5;
  if (/S[AÁ]BADO/.test(t))    mask |= 1 << 6;
  if (/FIN\s+DE\s+SEMANA/.test(t)) mask |= (1 << 6) | (1 << 0);
  if (/TODOS\s+LOS\s+D[ÍI]AS/.test(t)) return 127;

  return mask > 0 ? mask : 127;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string } {
  const norm = normStr(text);
  const y = new Date().getFullYear();

  const parseNum = (s: string) => {
    const [dd, mm, yy = String(y)] = s.split('/');
    return `${yy.length === 2 ? '20' + yy : yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
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
      validFrom:  `${yr}-${String(m1).padStart(2, '0')}-${wordRange[1].padStart(2, '0')}`,
      validUntil: `${yr}-${String(m2).padStart(2, '0')}-${wordRange[3].padStart(2, '0')}`,
    };
  }
  return {};
}

function extractDiscounts(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  for (const m of execAll(/(\d+(?:\.\d+)?)\s*%\s*(?:OFF|DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO)?/gi, text)) {
    const v = parseFloat(m[1]);
    if (v <= 0 || v > 100) continue;
    const type = /REINTEGRO|REEMBOLSO/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }
  return results;
}

function extractInstallments(text: string): number[] {
  const cuotas: number[] = [];
  for (const m of execAll(/(\d+)\s+CUOTAS?\s+SIN\s+INTER[ÉE]S/gi, text)) {
    const v = parseInt(m[1]);
    if (!cuotas.includes(v)) cuotas.push(v);
  }
  return cuotas;
}

function extractFixedAmount(text: string): { value: number; type: 'FIXED_AMOUNT' } | null {
  const m = text.match(/\$\s*([\d.,]+)\s*(?:de\s+)?(?:reintegro|descuento|off|ahorro)/i);
  if (m) {
    const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(v) && v > 0) return { value: v, type: 'FIXED_AMOUNT' };
  }
  return null;
}

function extractCap(text: string): { value: number; period: 'MONTHLY' | 'PER_TRANSACTION' } | null {
  const m = text.match(/\$\s*([\d.,]+)\s*(?:de\s+)?reintegro\s+al\s+mes/i);
  if (m) {
    const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(v) && v > 0) return { value: v, period: 'MONTHLY' };
  }
  return null;
}

function extractCardTier(text: string): ScrapedPromo['cardTier'] {
  const t = normStr(text);
  if (/CENTURION/.test(t)) return 'BLACK';
  if (/PLATINUM/.test(t) && /EXCLUSIVO/.test(t)) return 'PLATINUM';
  if (/GOLD/.test(t) && /EXCLUSIVO/.test(t)) return 'GOLD';
  if (/GREEN/.test(t) && /EXCLUSIVO/.test(t)) return 'CLASSIC';
  return null;
}

function detectCategoria(storeName: string, text: string): string {
  const t = normStr(storeName + ' ' + text);
  if (/JUMBO|CARREFOUR|DISCO|COTO|VEA|WALMART|CHANGO|DIARCO|SUPERMERCADO|HIPER/.test(t)) return 'Supermercados';
  if (/FARMACIA|FARMACITY|DROGUERIA/.test(t)) return 'Farmacias';
  if (/YPF|SHELL|AXION|PETROBRAS|NAFTA|COMBUSTIBLE/.test(t)) return 'Combustible';
  if (/HELADERIA|HELADOS|FREDDO/.test(t)) return 'Heladerías';
  if (/HOTEL|VUELO|AEROLINEA|TURISMO|VIAJE|BOOKING|TRIPSTORE|IBIS|NOVOTEL|MERCURE|DESPEGAR/.test(t)) return 'Viajes y Turismo';
  if (/UBER|CABIFY|SUBTE|TAXI|COLECTIVO/.test(t)) return 'Transporte';
  if (/RESTAURANT|PIZZA|BURGER|SUSHI|DELIVERY|GASTRONOMIA|COMIDA|STARBUCKS|CAFE|FRAPPE/.test(t)) return 'Gastronomía';
  if (/CINE|CINEMARK|TEATRO|ENTRADAS|TICKETEK/.test(t)) return 'Entretenimiento';
  if (/ELECTRO|GARBARINO|FRAVEGA|MUSIMUNDO|PC|NOTEBOOK|CELULAR|TECNOLOGIA|LENOVO/.test(t)) return 'Tecnología';
  if (/ADIDAS|NIKE|PUMA|BICICLETA|DEPORTE|FITNESS|GYM/.test(t)) return 'Deportes';
  if (/ROPA|MODA|ZAPATILLAS|CALZADO|INDUMENTARIA|ZARA/.test(t)) return 'Indumentaria';
  if (/PETSHOP|MASCOTA|VETERINARIA/.test(t)) return 'Mascotas';
  if (/HOGAR|MUEBLE|DECORACION|COLCHON/.test(t)) return 'Hogar';
  if (/OPTICA|BELLEZA|ESTETICA|SALUD/.test(t)) return 'Salud y Belleza';
  if (/JUGUETE|TOYS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/SHOPPING/.test(t)) return 'Shoppings';
  return 'Otros';
}

// ─── parseCard ────────────────────────────────────────────────────────────────
function parseCard(text: string, sourceUrl: string, categoria: string): ScrapedPromo[] {
  if (text.length < 15) return [];

  const discounts    = extractDiscounts(text);
  const installments = extractInstallments(text);
  const fixedAmount  = extractFixedAmount(text);
  const cap          = extractCap(text);

  if (discounts.length === 0 && installments.length === 0 && !fixedAmount) return [];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const storeName = lines[0] || 'AmEx Promo';

  const { validFrom, validUntil } = extractDates(text);
  const validDays  = extractValidDays(text);
  const cardTier   = extractCardTier(text);
  const stackable  = /NO\s+(?:ES\s+)?ACUMULABLE/i.test(text) ? false : undefined;

  // Si el nombre del comercio indica una categoría más específica, usarla
  const detectedCat = detectCategoria(storeName, text);
  const finalCategoria = detectedCat !== 'Varios' ? detectedCat : categoria;

  const base: Partial<ScrapedPromo> = {
    storeName,
    description:   text.slice(0, 500).replace(/\s+/g, ' ').trim(),
    sourceText:    text.slice(0, 4000),
    sourceUrl,
    validFrom,
    validUntil,
    validDays,
    stackable,
    cardNetworks:  [{ network: 'American Express', type: 'CREDIT' }],
    cardTier,
    categoria: finalCategoria,
  };

  const promos: ScrapedPromo[] = [];

  // Descuentos porcentuales
  for (const disc of discounts) {
    promos.push({
      ...base,
      title: `${disc.value}% ${disc.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}`,
      discount: String(disc.value),
      discountType: disc.type,
    } as ScrapedPromo);
  }

  // Cuotas sin interés (puede haber 3 y 6 juntas)
  for (const c of installments) {
    if (!discounts.length) {
      promos.push({
        ...base,
        title: `${c} cuotas sin interés – ${storeName}`,
        discount: String(c),
        discountType: 'CUOTAS_SIN_INTERES',
      } as ScrapedPromo);
    } else {
      // Ya hay un promo porcentual — agregar CSI como nota o promo extra
      promos.push({
        ...base,
        title: `${c} cuotas sin interés – ${storeName}`,
        discount: String(c),
        discountType: 'CUOTAS_SIN_INTERES',
        cap: undefined,
        capPeriod: undefined,
      } as ScrapedPromo);
    }
  }

  // Monto fijo (sin descuento porcentual)
  if (fixedAmount && discounts.length === 0 && installments.length === 0) {
    promos.push({
      ...base,
      title: `$${fixedAmount.value.toLocaleString('es-AR')} reintegro – ${storeName}`,
      discount: String(fixedAmount.value),
      discountType: fixedAmount.type,
      cap: cap?.value ?? fixedAmount.value,
      capPeriod: cap?.period ?? 'MONTHLY',
      capTarget: 'USER',
    } as ScrapedPromo);
  }

  return promos;
}

// ─── scrapePage ───────────────────────────────────────────────────────────────
async function scrapePage(page: Page, url: string, categoria: string): Promise<ScrapedPromo[]> {
  console.log(`[AmEx] ${categoria}: ${url}`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(6000);

    const cards: string[] = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.contenedor-promociones, [class*="recduadrobenf"]'))
        .map(el => (el as HTMLElement).innerText?.trim() ?? '')
        .map(t => t.replace(/\s*Ver m[aá]s\s*[🡥→]?\s*$/i, '').trim())
        .filter(t => t.length > 10)
    );

    console.log(`[AmEx] ${categoria}: ${cards.length} cards`);
    const promos: ScrapedPromo[] = [];
    for (const card of cards) promos.push(...parseCard(card, url, categoria));
    return promos;
  } catch (err) {
    console.error(`[AmEx] Error en ${url}:`, err);
    return [];
  }
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const AmexScraper: Scraper = {
  name: 'AmEx',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[AmEx] Iniciando scraper...');
    const browser = await chromium.launch({ headless: true });
    const allPromos: ScrapedPromo[] = [];

    try {
      const page = await browser.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      // Homepage (promos destacadas)
      const homePromos = await scrapePage(page, HOME_URL, 'Varios');
      allPromos.push(...homePromos);

      // Páginas por categoría
      for (const cat of CATEGORY_URLS) {
        const promos = await scrapePage(page, cat.url, cat.categoria);
        allPromos.push(...promos);
      }

      await page.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.discountType}|${p.cardTier}|${p.storeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[AmexScraper] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

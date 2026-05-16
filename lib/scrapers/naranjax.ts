// Naranja X Scraper
// Fuente: https://www.naranjax.com/promociones/
// Técnica: Playwright con anti-detección Cloudflare
// Estructura: app-card (grilla, ~40 cards) + app-promo-carousel-card-desktop (carousel)
// Banco: Naranja X (emisor propio)

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';

const BASE_URL = 'https://www.naranjax.com/promociones/';

// Categorías que no son nombres de comercio específicos
const GENERIC_STORE_WORDS = new Set([
  'supermercados', 'seleccionados', 'comercios', 'locales', 'establecimientos',
  'hoteles', 'hotels', 'restaurants', 'restaurantes', 'combustible', 'nafta', 'todos',
  'productos', 'compras', 'tiendas', 'cuenta', 'caribe', 'hoteles del caribe',
]);

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
  if (/TODOS\s+LOS\s+D[ÍI]AS/.test(t)) return 127;
  if (/LUNES\s+A\s+VIERNES/.test(t)) return 0b0111110; // lunes-viernes
  if (/FIN\s+DE\s+SEMANA/.test(t)) return (1 << 6) | (1 << 0);

  const rangeMatch = t.match(
    /(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADOS?|DOMINGOS?)\s+A\s+(LUNES|MARTES|MI[EÉ]RCOLES|JUEVES|VIERNES|S[AÁ]BADOS?|DOMINGOS?)/i
  );
  if (rangeMatch) {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/s$/, '');
    const a = DAY_TO_BIT[norm(rangeMatch[1])];
    const b = DAY_TO_BIT[norm(rangeMatch[2])];
    if (a !== undefined && b !== undefined) {
      let mask = 0;
      if (a <= b) for (let i = a; i <= b; i++) mask |= 1 << i;
      else { for (let i = a; i <= 6; i++) mask |= 1 << i; for (let i = 0; i <= b; i++) mask |= 1 << i; }
      if (mask > 0) return mask;
    }
  }

  let mask = 0;
  if (/DOMINGOS?/.test(t))  mask |= 1 << 0;
  if (/LUNES/.test(t))      mask |= 1 << 1;
  if (/MARTES/.test(t))     mask |= 1 << 2;
  if (/MI[EÉ]RCOLES/.test(t)) mask |= 1 << 3;
  if (/JUEVES/.test(t))     mask |= 1 << 4;
  if (/VIERNES/.test(t))    mask |= 1 << 5;
  if (/S[AÁ]BADOS?/.test(t)) mask |= 1 << 6;
  return mask > 0 ? mask : 127;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string } {
  const norm = normStr(text);
  const y = new Date().getFullYear();

  const parseNum = (s: string) => {
    const [dd, mm, yy = String(y)] = s.split('/');
    return `${yy.length === 2 ? '20' + yy : yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  };

  const numRange = norm.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (numRange) return { validFrom: parseNum(numRange[1]), validUntil: parseNum(numRange[2]) };

  // "Del 18 al 25 de abril"
  const wordRange = norm.match(/DEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (wordRange) {
    const month = MONTHS[wordRange[3].toLowerCase()];
    const yr = wordRange[4] ? parseInt(wordRange[4]) : y;
    if (month) return {
      validFrom:  `${yr}-${String(month).padStart(2,'0')}-${wordRange[1].padStart(2,'0')}`,
      validUntil: `${yr}-${String(month).padStart(2,'0')}-${wordRange[2].padStart(2,'0')}`,
    };
  }

  // "Hasta el 30 de abril"
  const untilMatch = norm.match(/HASTA\s+(?:EL\s+)?(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (untilMatch) {
    const month = MONTHS[untilMatch[2].toLowerCase()];
    const yr = untilMatch[3] ? parseInt(untilMatch[3]) : y;
    if (month) return { validUntil: `${yr}-${String(month).padStart(2,'0')}-${untilMatch[1].padStart(2,'0')}` };
  }

  return {};
}

function extractDiscounts(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  for (const m of execAll(/(\d+(?:\.\d+)?)\s*%\s*(?:OFF|DE\s+)?(?:DESCUENTO|REINTEGRO|REEMBOLSO|AHORRO)?/gi, text)) {
    const v = parseFloat(m[1]);
    if (v <= 0 || v > 100) continue;
    const type = /REINTEGRO|REEMBOLSO/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v)) results.push({ value: v, type });
  }
  return results;
}

function extractInstallments(text: string): number | null {
  // "9 cuotas cero interés" / "14 cuotas cero interés" / "cuotas sin interés"
  const m = text.match(/(?:hasta\s+)?(\d+)\s+cuotas?\s+(?:cero|sin)\s+inter[eé]s/i);
  return m ? parseInt(m[1]) : null;
}

function extractCap(text: string): number | null {
  const m = text.match(/tope\s+(?:semanal|mensual|diario)?\s*(?:hasta\s+)?\$\s*([\d.,]+)/i)
    ?? text.match(/\$\s*([\d.,]+)\s*(?:de\s+)?(?:tope|m[aá]ximo)/i);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return isNaN(v) || v <= 0 ? null : v;
}

function extractCapPeriod(text: string): 'WEEKLY' | 'MONTHLY' | 'PER_TRANSACTION' | undefined {
  const t = text.toLowerCase();
  if (/semanal|por semana/.test(t)) return 'WEEKLY';
  if (/mensual|por mes|al mes/.test(t)) return 'MONTHLY';
  return undefined;
}

function extractPaymentChannel(text: string): ScrapedPromo['paymentChannel'] {
  const t = normStr(text);
  if (/CON\s+QR|\bMODO\b/.test(t)) return 'QR';
  if (/TRANSFERENCIA/.test(t)) return 'TRANSFERENCIA';
  if (/DINERO\s+EN\s+CUENTA/.test(t)) return 'DINERO_EN_CUENTA';
  return 'ANY';
}

function extractCardType(text: string): 'CREDIT' | 'DEBIT' | null {
  const hasCredit = /\bCR[EÉ]DITO\b/i.test(text);
  const hasDebit  = /\bD[EÉ]BITO\b/i.test(text);
  if (hasCredit && hasDebit) return null; // ambos → sin restricción
  if (hasCredit) return 'CREDIT';
  if (hasDebit)  return 'DEBIT';
  return null;
}

function extractStoreName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // "Días seleccionados en Vea" → "Vea"
    // "25% off en Jumbo" → "Jumbo"
    // "en seleccionados" → skip
    const enMatch = line.match(/\ben\s+(.+)$/i);
    if (enMatch) {
      const candidate = enMatch[1].trim();
      const lower = candidate.toLowerCase();
      if (!GENERIC_STORE_WORDS.has(lower) && candidate.length < 50) return candidate;
    }
  }

  // Buscar línea que no sea fecha, descuento ni medio de pago
  const skipPatterns = /^\d|^del\s|^hasta|^todos|^días|^cuotas|^crédito|^débito|^dinero|^online|^presencial|^con\s+qr|^tope|^en\s|^pagá|^plan\s/i;
  for (const line of lines) {
    if (!skipPatterns.test(line) && line.length > 2 && line.length < 60) {
      const lower = line.toLowerCase();
      if (!GENERIC_STORE_WORDS.has(lower)) return line;
    }
  }

  return null;
}

function detectCategoria(storeName: string, text: string): string {
  const t = normStr(storeName + ' ' + text);
  if (/JUMBO|CARREFOUR|DISCO|COTO|VEA|WALMART|CHANGO|DIARCO|SUPERMERCADO|HIPER|ANONIMA|YAGUAR/.test(t)) return 'Supermercados';
  if (/FARMACIA|FARMACITY|DROGUERIA/.test(t)) return 'Farmacias';
  if (/YPF|SHELL|AXION|PETROBRAS|NAFTA|COMBUSTIBLE/.test(t)) return 'Combustible';
  if (/HELADERIA|HELADOS|FREDDO|CHUNGO|GRIDO/.test(t)) return 'Heladerías';
  if (/HOTEL|VUELO|AEROLINEA|TURISMO|VIAJE|BOOKING|DESPEGAR/.test(t)) return 'Viajes y Turismo';
  if (/TRANSPORT|COLECTIVO|SUBTE|TREN|TAXI|UBER|CABIFY|TELEPASE/.test(t)) return 'Transporte';
  if (/RESTAURANT|PIZZA|BURGER|SUSHI|DELIVERY|GASTRONOMIA|COMIDA|CAFE|FRAPPE|STARBUCKS/.test(t)) return 'Gastronomía';
  if (/CINE|TEATRO|ENTRADAS|TICKETEK|ENTRETENIMIENTO/.test(t)) return 'Entretenimiento';
  if (/ELECTRO|GARBARINO|FRAVEGA|MUSIMUNDO|RODO|PC|NOTEBOOK|CELULAR|TECNOLOG/.test(t)) return 'Tecnología';
  if (/ADIDAS|NIKE|PUMA|BICICLETA|DEPORTE|FITNESS|GYM|GIMNASIO|MEGATLON|DECATHLON/.test(t)) return 'Deportes';
  if (/ROPA|MODA|ZAPATILLAS|CALZADO|INDUMENTARIA|ZARA/.test(t)) return 'Indumentaria';
  if (/OPTICA|BELLEZA|ESTETICA|PELUQUERIA|SALUD/.test(t)) return 'Salud y Belleza';
  if (/PETSHOP|MASCOTA|VETERINARIA|ZOOMUNDO/.test(t)) return 'Mascotas';
  if (/HOGAR|DECORACION|DECO|MUEBLE|SODIMAC|EASY|COLCHON/.test(t)) return 'Hogar';
  if (/JUGUETE|TOYS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/SHOPPING/.test(t)) return 'Shoppings';
  return 'Otros';
}

// ─── parseCard ────────────────────────────────────────────────────────────────
function parseCard(text: string, sourceUrl: string): ScrapedPromo[] {
  if (text.length < 10) return [];

  const discounts    = extractDiscounts(text);
  const installments = extractInstallments(text);
  if (discounts.length === 0 && !installments) return [];

  const storeName = extractStoreName(text);
  if (!storeName) return []; // sin comercio identificable → saltear

  const { validFrom, validUntil } = extractDates(text);
  const validDays      = extractValidDays(text);
  const cap            = extractCap(text);
  const capPeriod      = cap ? (extractCapPeriod(text) ?? 'WEEKLY') : undefined;
  const paymentChannel = extractPaymentChannel(text);
  const cardType       = extractCardType(text);
  const categoria      = detectCategoria(storeName, text);

  const base: Partial<ScrapedPromo> = {
    storeName,
    description:   text.slice(0, 500).replace(/\s+/g, ' ').trim(),
    sourceText:    text.slice(0, 8000),
    sourceUrl,
    validFrom,
    validUntil,
    validDays,
    cap:           cap ?? undefined,
    capPeriod:     capPeriod as any,
    capTarget:     cap ? 'USER' : undefined,
    stackable:     /NO\s+(?:ES\s+)?ACUMULABLE|NO\s+ACUMULA/i.test(text) ? false : undefined,
    bankNames:     ['Naranja X'],
    cardType,
    paymentChannel,
    categoria,
  };

  const promos: ScrapedPromo[] = [];

  if (installments && discounts.length === 0) {
    promos.push({
      ...base,
      title: `${installments} cuotas sin interés – ${storeName}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  } else {
    for (const disc of discounts) {
      promos.push({
        ...base,
        title: `${disc.value}% ${disc.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}`,
        discount: String(disc.value),
        discountType: disc.type,
      } as ScrapedPromo);
    }
    // Si además tiene CSI, agregar como promo separada
    if (installments) {
      promos.push({
        ...base,
        title: `${installments} cuotas sin interés – ${storeName}`,
        discount: String(installments),
        discountType: 'CUOTAS_SIN_INTERES',
        cap: undefined,
        capPeriod: undefined,
      } as ScrapedPromo);
    }
  }

  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const NaranjaXScraper: Scraper = {
  name: 'NaranjaX',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[NaranjaX] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    const allPromos: ScrapedPromo[] = [];

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'es-AR',
        extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9' },
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(8000);

      // Scroll para cargar lazy content
      let prevH = 0;
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(600);
        const h = await page.evaluate(() => document.body.scrollHeight);
        if (h === prevH) break;
        prevH = h;
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      // Extraer cards de la grilla y el carousel
      const cardTexts: string[] = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('app-card, app-promo-carousel-card-desktop'));
        return els.map(el => (el as HTMLElement).innerText?.trim() ?? '').filter(t => t.length > 10);
      });

      console.log(`[NaranjaX] ${cardTexts.length} cards encontradas`);

      for (const text of cardTexts) {
        const promos = parseCard(text, BASE_URL);
        allPromos.push(...promos);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.discountType}|${p.storeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[NaranjaXScraper] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

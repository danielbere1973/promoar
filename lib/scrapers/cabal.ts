// Cabal / Banco Credicoop Scraper
// Fuente: https://www.beneficios.bancocredicoop.coop/coop/beneficios/
// Técnica: Playwright — lee 71 .stared-card, extrae días activos desde clases CSS
// Redes: parsea "CABAL-VISA-MODO" del atributo alt del link

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';

const BASE_URL = 'https://www.beneficios.bancocredicoop.coop/coop/beneficios/';

// Día abreviado → bit en bitmask (Do=0 Lu=1 Ma=2 Mi=3 Ju=4 Vi=5 Sa=6)
const DAY_CLASS_TO_BIT: Record<string, number> = {
  'Do': 0, 'Lu': 1, 'Ma': 2, 'Mi': 3, 'Ju': 4, 'Vi': 5, 'Sa': 6,
};

// Categorías genéricas que no son comercios específicos
const GENERIC_CATEGORIES = new Set([
  'supermercados', 'combustibles', 'combustible', 'gastronomía', 'gastronomia',
  'farmacias', 'farmacias y perfumerías', 'indumentaria', 'indumentaria y accesorios',
  'entretenimiento', 'tecnología', 'tecnologia', 'hogar y decoración', 'hogar y decoracion',
  'salud, belleza y deporte', 'salud belleza y deporte', 'varios', 'transporte',
  'compras en línea', 'compras en linea', 'libros', 'pinturerías', 'jugueterías',
  'bicicleterías', 'instrumentos musicales', 'librerías', 'camping y tiempo libre',
  'automóviles y motos',
]);

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

function extractDates(lines: string[]): { validFrom?: string; validUntil?: string } {
  const text = lines.join(' ');
  const norm = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const y = new Date().getFullYear();

  const parseNum = (s: string) => {
    const [dd, mm, yy = String(y)] = s.split('/');
    return `${yy.length === 2 ? '20' + yy : yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  };

  const numRange = norm.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (numRange) return { validFrom: parseNum(numRange[1]), validUntil: parseNum(numRange[2]) };

  // "Del 6 al 30 de abril"
  const wordRange = norm.match(/DEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (wordRange) {
    const month = MONTHS[wordRange[3].toLowerCase()];
    const yr = wordRange[4] ? parseInt(wordRange[4]) : y;
    if (month) return {
      validFrom:  `${yr}-${String(month).padStart(2,'0')}-${wordRange[1].padStart(2,'0')}`,
      validUntil: `${yr}-${String(month).padStart(2,'0')}-${wordRange[2].padStart(2,'0')}`,
    };
  }

  // "Hasta el 30 de abril" / "hasta X de Y"
  const untilMatch = norm.match(/HASTA\s+(?:EL\s+)?(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (untilMatch) {
    const month = MONTHS[untilMatch[2].toLowerCase()];
    const yr = untilMatch[3] ? parseInt(untilMatch[3]) : y;
    if (month) return { validUntil: `${yr}-${String(month).padStart(2,'0')}-${untilMatch[1].padStart(2,'0')}` };
  }

  // Rango de meses "Abril, Mayo, Junio"
  const monthListMatch = text.match(/([A-Za-záéíóúÁÉÍÓÚ]+),\s*([A-Za-záéíóúÁÉÍÓÚ]+),?\s*([A-Za-záéíóúÁÉÍÓÚ]+)?/);
  if (monthListMatch) {
    const m1 = MONTHS[monthListMatch[1].toLowerCase()];
    const m3 = monthListMatch[3] ? MONTHS[monthListMatch[3].toLowerCase()] : undefined;
    if (m1) {
      const endMonth = m3 ?? m1;
      return {
        validFrom:  `${y}-${String(m1).padStart(2,'0')}-01`,
        validUntil: `${y}-${String(endMonth).padStart(2,'0')}-30`,
      };
    }
  }

  return {};
}

function extractDiscount(lines: string[]): { value: number; type: string } | null {
  for (const line of lines) {
    // "30% de ahorro" / "Hasta 30% de ahorro" / "20% de descuento"
    const m = line.match(/(?:hasta\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:de\s+)?(?:ahorro|descuento|reintegro|reembolso|off)/i);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > 0 && v <= 100) {
        const type = /reintegro|reembolso/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
        return { value: v, type };
      }
    }
  }
  return null;
}

function extractInstallments(lines: string[]): number | null {
  for (const line of lines) {
    const m = line.match(/(?:hasta\s+)?(\d+)\s+cuotas?\s+(?:sin|cero)\s+inter[eé]s/i);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function extractPaymentChannel(lines: string[]): ScrapedPromo['paymentChannel'] {
  const text = lines.join(' ').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\bMODO\b|\bQR\b/.test(text)) return 'QR';
  if (/TRANSFERENCIA/.test(text)) return 'TRANSFERENCIA';
  if (/TIENDA\s+VIRTUAL|ONLINE/.test(text) && /PRESENCIAL/.test(text)) return 'ANY';
  if (/TIENDA\s+VIRTUAL|ONLINE/.test(text)) return 'DINERO_EN_CUENTA';
  return 'ANY';
}

function detectCategoria(storeName: string): string {
  const t = storeName.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/JUMBO|CARREFOUR|DISCO|COTO|VEA|WALMART|CHANGO|DIARCO|SUPERMERCADO|ANONIMA|YAGUAR/.test(t)) return 'Supermercados';
  if (/FARMACIA|FARMACITY|PERFUMER|DROGUERIA/.test(t)) return 'Farmacias';
  if (/YPF|SHELL|AXION|PETROBRAS|COMBUSTIBLE|NAFTA/.test(t)) return 'Combustible';
  if (/HELADERIA|HELADOS|FREDDO|CHUNGO|GRIDO|VOLTA|CREMOLATTI/.test(t)) return 'Heladerías';
  if (/HOTEL|VUELO|AEROLINEA|TURISMO|VIAJE|DESPEGAR|BOOKING/.test(t)) return 'Viajes y Turismo';
  if (/UBER|CABIFY|COLECTIVO|BUS|SUBTE|TREN|TAXI|DRAGONPASS|TELEPASE/.test(t)) return 'Transporte';
  if (/RESTAURANT|PIZZA|BURGER|SUSHI|GASTRONOMIA|COMIDA|CAFE|PEDIDOS|RAPPI|STARBUCKS/.test(t)) return 'Gastronomía';
  if (/ELECTRO|GARBARINO|FRAVEGA|MUSIMUNDO|PC|CELULAR|LENOVO|TECNOLOG/.test(t)) return 'Tecnología';
  if (/ADIDAS|NIKE|PUMA|BICICLETA|DEPORTE|FITNESS|GYM|DECATHLON/.test(t)) return 'Deportes';
  if (/ROPA|MODA|ZAPATILLAS|CALZADO|INDUMENTARIA|ZARA/.test(t)) return 'Indumentaria';
  if (/PETSHOP|PETCO|VETERINAR|MASCOTA/.test(t)) return 'Mascotas';
  if (/HOGAR|COLCHON|MUEBLE|DECORACION|EASY|SODIMAC/.test(t)) return 'Hogar';
  if (/CINE|TEATRO|ENTRADAS|TICKETEK|ENTRETENIMIENTO/.test(t)) return 'Entretenimiento';
  if (/OPTICA|BELLEZA|ESTETICA|PELUQUERIA|SALUD/.test(t)) return 'Salud y Belleza';
  if (/JUGUETE|TOYS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/SHOPPING/.test(t)) return 'Shoppings';
  return '';
}

// ─── RawCard (extraído del DOM) ───────────────────────────────────────────────
interface RawCard {
  activeDayBits: number;
  lines: string[];
  altText: string;
  bid?: string;
  pageId?: string;
}

// ─── parseCard ────────────────────────────────────────────────────────────────
function parseCard(card: RawCard, sourceUrl: string): ScrapedPromo[] {
  const { activeDayBits, lines, altText } = card;
  const storeName = lines[0]?.trim() || '';
  if (!storeName) return [];

  // Saltar si es solo categoría genérica sin descuento específico
  const isGeneric = GENERIC_CATEGORIES.has(storeName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const discount  = extractDiscount(lines);
  const installments = extractInstallments(lines);

  // Saltar "Las mejores promos / Conocelas todas" (sin descuento concreto)
  if (!discount && !installments) return [];
  if (lines.some(l => /conocelas\s+todas|ver\s+m[aá]s/i.test(l))) return [];

  const { validFrom, validUntil } = extractDates(lines);
  const validDays = activeDayBits > 0 ? activeDayBits : 127;
  const paymentChannel = extractPaymentChannel(lines);
  const categoria = isGeneric
    ? (storeName.includes('upermer') ? 'Supermercados' : storeName.includes('arma') ? 'Farmacias' : storeName.includes('ombust') ? 'Combustible' : 'Otros')
    : detectCategoria(storeName);

  // Redes desde alt: "CABAL-VISA-MODO" o "CABAL" solo
  const cardNetworks: CardNetworkWithType[] = [];
  if (/CABAL/i.test(altText)) cardNetworks.push({ network: 'Cabal', type: 'CREDIT' });
  if (/\bVISA\b/i.test(altText)) cardNetworks.push({ network: 'VISA', type: 'CREDIT' });
  if (cardNetworks.length === 0) cardNetworks.push({ network: 'Cabal', type: 'CREDIT' });

  const walletNames: string[] = [];
  if (/\bMODO\b/i.test(altText)) walletNames.push('MODO');

  const description = lines.filter(Boolean).join(' | ').slice(0, 500);

  const base: Partial<ScrapedPromo> = {
    storeName,
    description,
    sourceText: description,
    sourceUrl,
    validFrom,
    validUntil,
    validDays,
    bankNames: ['Banco Credicoop'],
    cardNetworks,
    walletNames: walletNames.length > 0 ? walletNames : undefined,
    paymentChannel,
    categoria,
  };

  const promos: ScrapedPromo[] = [];

  if (installments && !discount) {
    promos.push({
      ...base,
      title: `${installments} cuotas sin interés – ${storeName}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  } else if (discount) {
    promos.push({
      ...base,
      title: `${discount.value}% ${discount.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}`,
      discount: String(discount.value),
      discountType: discount.type,
    } as ScrapedPromo);
    if (installments) {
      promos.push({
        ...base,
        title: `${installments} cuotas sin interés – ${storeName}`,
        discount: String(installments),
        discountType: 'CUOTAS_SIN_INTERES',
      } as ScrapedPromo);
    }
  }

  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const CabalScraper: Scraper = {
  name: 'Cabal',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Cabal] Iniciando scraper...');
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
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(6000);

      // Scroll para asegurar carga completa
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => window.scrollTo(0, 0));

      const rawCards: RawCard[] = await page.evaluate((DAY_MAP) => {
        const results: { activeDayBits: number; lines: string[]; altText: string }[] = [];

        document.querySelectorAll('.stared-card').forEach(card => {
          // Días activos
          let bits = 0;
          card.querySelectorAll('.day').forEach(dayEl => {
            const cls = dayEl.className ?? '';
            if (!cls.includes('inactive')) {
              // Buscar qué abreviatura tiene (Lu, Ma, Mi, Ju, Vi, Sa, Do)
              for (const [abbr, bit] of Object.entries(DAY_MAP)) {
                if (cls.includes(abbr)) { bits |= 1 << bit; break; }
              }
            }
          });

          // Líneas de contenido
          const lines: string[] = [];
          for (let i = 1; i <= 5; i++) {
            const el = card.querySelector(`.stared-card-content-line-${i}`);
            const t = (el as HTMLElement | null)?.innerText?.trim() ?? '';
            if (t) lines.push(t);
          }

          // Alt text del link (contiene CABAL/VISA/MODO)
          const link = card.querySelector('a[alt]');
          const altText = link?.getAttribute('alt') ?? '';

          // bid y page_id para URL de detalle y legales
          const cardEl = card as HTMLElement;
          const bid = cardEl.dataset?.bid || cardEl.getAttribute('data-bid') || '';
          const pageId = cardEl.dataset?.pageId || cardEl.getAttribute('data-page-id') || '';
          // También buscar en links internos
          const detailLink = card.querySelector('a[href*="bid="]');
          const hrefBid = detailLink?.getAttribute('href')?.match(/bid=(\d+)/)?.[1] || '';
          const hrefPageId = detailLink?.getAttribute('href')?.match(/page_id=(\d+)/)?.[1] || '';

          results.push({ activeDayBits: bits, lines, altText, bid: bid || hrefBid, pageId: pageId || hrefPageId });
        });

        return results;
      }, DAY_CLASS_TO_BIT);

      console.log(`[Cabal] ${rawCards.length} cards encontradas`);

      const LEGAL_API = 'https://www.beneficios.bancocredicoop.coop/coop/beneficios/xapi_get_page.php';
      const DETAIL_BASE = 'https://www.beneficios.bancocredicoop.coop/coop/beneficios/?p=page&homeredirect=1&fromhome=1';

      for (const card of rawCards) {
        const promos = parseCard(card, BASE_URL);

        // Enriquecer con legales y URL si tenemos bid/pageId
        if (card.bid || card.pageId) {
          const detailUrl = card.bid && card.pageId
            ? `${DETAIL_BASE}&page_id=${card.pageId}&bid=${card.bid}`
            : BASE_URL;
          let legalText = '';
          if (card.pageId) {
            try {
              const res = await context.request.get(`${LEGAL_API}?page_id=${card.pageId}`, { timeout: 8000 });
              if (res.ok()) {
                const data = await res.json().catch(() => null);
                if (data?.body) {
                  legalText = data.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);
                }
              }
            } catch { /* silencioso */ }
          }
          for (const p of promos) {
            p.sourceUrl = detailUrl;
            if (legalText) p.sourceText = legalText;
          }
        }

        allPromos.push(...promos);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.discountType}|${p.storeName}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[CabalScraper] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

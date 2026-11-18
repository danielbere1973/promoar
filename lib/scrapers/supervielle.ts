// Banco Supervielle Scraper
// La API vieja (api/beneficios?rubro=...&esIdentite=...) está retirada (devuelve "Gone").
// El sitio nuevo (Next.js/RSC) server-renderiza TODO el catálogo (365 cards) directo en el
// DOM de https://www.supervielle.com.ar/personas/beneficios — no hay llamada de red separada
// para los datos. Un botón "Mostrar más beneficios (N)" solo revela más DOM ya cargado (no
// dispara fetch). No hay link de detalle por card (todo lo necesario está en la card misma).
import { chromium } from 'playwright';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria } from './bank-helpers';

const BASE_URL  = 'https://www.supervielle.com.ar/personas/beneficios';
const BANK_NAME = 'Banco Supervielle';

// Categorías reales confirmadas en el sitio (label exacto de la card, normalizado) → PromoAR
const RUBRO_MAP: Record<string, string> = {
  'supermercados':        'Supermercados',
  'automotor':             '',  // mixto → detectCategoria por nombre de comercio
  'belleza':               'Salud y Belleza',
  'bodegas':               'Gastronomía',
  'carnicerias mendoza':   'Gastronomía',
  'carnicerias san luis':  'Gastronomía',
  'combustible':           'Combustible',
  'compras':               'Shoppings',
  'entretenimiento':       'Entretenimiento',
  'farmacia':              'Farmacias',
  'hogar':                 'Hogar',
  'indumentaria':          'Indumentaria',
  'mascotas':              'Petshops',
  'restaurantes':          'Gastronomía',
  'tecnologia':            'Tecnología',
  'transporte':            '',  // mixto → detectCategoria por comercio
  'turismo':               'Viajes y Turismo',
  'libreria':              'Librerías',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function mapRubro(label: string): string {
  const n = normalize(label);
  if (RUBRO_MAP[n] !== undefined) return RUBRO_MAP[n];
  for (const [key, val] of Object.entries(RUBRO_MAP)) {
    if (n.includes(key)) return val;
  }
  return '';
}

function parseCap(items: string[]): number | null {
  for (const text of items) {
    if (/sin tope/i.test(text)) return null;
    const m = text.match(/tope[^$]*\$\s*([\d.,]+)/i);
    if (m) {
      const n = parseInt(m[1].replace(/\./g, '').replace(',', ''), 10);
      if (!isNaN(n)) return n;
    }
  }
  return null;
}

function parseDiscount(title: string, items: string[]): { discount: string; discountType: string } | null {
  const all = `${title} ${items.join(' ')}`;
  const cuotas = all.match(/(\d+)\s*cuotas?\s+sin\s+inter[ée]s/i);
  if (cuotas) {
    return { discount: cuotas[1], discountType: 'CUOTAS_SIN_INTERES' };
  }
  const pct = all.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    const v = parseFloat(pct[1].replace(',', '.'));
    if (v > 0 && v <= 100) {
      const isReintegro = /reintegro|reembolso|ahorro/i.test(all);
      return { discount: String(v), discountType: isReintegro ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO' };
    }
  }
  return null;
}

function parseValidUntil(items: string[]): string | undefined {
  for (const text of items) {
    const m = text.match(/vigente\s+hasta\s+el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (m) {
      const [, d, mo, y] = m;
      return new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).toISOString();
    }
  }
  return undefined;
}

function parseSegment(items: string[]): string | undefined {
  const all = items.join(' ');
  if (/identit[ée]/i.test(all)) return 'identite black';
  if (/plan\s+sueldo/i.test(all)) return 'plan sueldo';
  if (/jubilad/i.test(all)) return 'jubilados';
  return undefined;
}

interface RawCard {
  category: string;
  title: string;
  items: string[];
  logo: string;
  alt: string;
}

// Si no hay "alt" en el logo, intentar extraer el comercio de frases tipo
// "20% de ahorro los martes y jueves en Jumbo" (el h3 no es el nombre del comercio,
// es la oración completa de la promo).
function extractStoreName(card: RawCard): string {
  const alt = card.alt.trim();
  if (alt) return alt;
  const m = card.title.match(/\ben\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'&.\s]+?)(?:\s+con\s+MODO)?$/);
  return m ? m[1].trim() : card.title.trim();
}

function parseCard(card: RawCard): ScrapedPromo | null {
  const storeName = extractStoreName(card);
  if (!storeName) return null;

  const parsed = parseDiscount(card.title, card.items);
  if (!parsed) return null;

  const cap = parseCap(card.items);
  const validUntil = parseValidUntil(card.items);
  const segment = parseSegment(card.items);
  const categoria = mapRubro(card.category) || detectCategoria(storeName);

  const all = `${card.title} ${card.items.join(' ')}`;
  const cardNetworks: CardNetworkWithType[] = [];
  if (/tarjeta.*cr[ée]dito|con cr[ée]dito/i.test(all)) {
    cardNetworks.push({ network: 'VISA', type: 'CREDIT' });
    cardNetworks.push({ network: 'Mastercard', type: 'CREDIT' });
  }
  if (/tarjeta.*d[ée]bito|con d[ée]bito/i.test(all)) {
    cardNetworks.push({ network: 'VISA', type: 'DEBIT' });
  }

  const walletNames: string[] = [];
  const isModo = /modo/i.test(all);
  if (isModo) walletNames.push('MODO');

  const paymentChannel: ScrapedPromo['paymentChannel'] =
    isModo || /\bQR\b|CODIGO\s+QR/i.test(all) ? 'QR' : 'ANY';

  return {
    storeName,
    title: card.title.trim(),
    description: card.items.join(' | '),
    sourceText: card.items.join(' | '),
    sourceUrl: BASE_URL,
    discount: parsed.discount,
    discountType: parsed.discountType,
    validDays: 127,
    validUntil,
    cap,
    bankNames: [BANK_NAME],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    walletNames: walletNames.length > 0 ? walletNames : undefined,
    paymentChannel,
    categoria,
    storeLogoUrl: card.logo || undefined,
    segment,
  } as ScrapedPromo;
}

export const SupervielleScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Supervielle] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const allPromos: ScrapedPromo[] = [];

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'es-AR',
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Expandir el catálogo completo: el botón solo revela DOM ya cargado, sin fetch.
      for (let i = 0; i < 40; i++) {
        const btn = page.getByRole('button', { name: /Mostrar más beneficios/i });
        const count = await btn.count().catch(() => 0);
        if (count === 0) break;
        await btn.first().click().catch(() => {});
        await page.waitForTimeout(1200);
      }

      const cards: RawCard[] = await page.evaluate(() => {
        const articles = Array.from(document.querySelectorAll('article'));
        return articles.map(article => {
          // La categoría real está en el <p> con color #9b0b3b (text-[#9b0b3b]) —
          // un querySelector('p') genérico captura texto de detalle en algunas cards.
          const catP = Array.from(article.querySelectorAll('p')).find(p => {
            const color = window.getComputedStyle(p).color;
            return color === 'rgb(155, 11, 59)';
          });
          const title = article.querySelector('h3')?.textContent?.trim() ?? '';
          const items = Array.from(article.querySelectorAll('li')).map(li => li.textContent?.trim() ?? '').filter(Boolean);
          const logo = article.querySelector('img')?.getAttribute('src') ?? '';
          const alt = article.querySelector('img')?.getAttribute('alt') ?? '';
          return {
            category: catP?.textContent?.trim() ?? '',
            title,
            items,
            logo: logo.startsWith('http') ? logo : logo ? `https://www.supervielle.com.ar${logo}` : '',
            alt,
          };
        });
      });

      console.log(`[Supervielle] ${cards.length} cards encontradas`);

      for (const card of cards) {
        const promo = parseCard(card);
        if (promo) allPromos.push(promo);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.storeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[SupervielleScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

// Banco del Sol (bancodelsol.com/beneficios)
//
// Webflow site con listado de beneficios via Finsweet CMS List (fs-list-*).
// La paginación es "Ver más" (fs-list-load="more", click-to-append), NO
// ?bec6870c_page=N por URL — navegar directo a esa query string simplemente
// re-renderiza la página 1 cacheada sin traer datos reales.
// Cada card (`.collection-item-2.w-dyn-item`) trae ya en el listado, sin
// necesidad de visitar el detalle: título, texto de descuento (% reintegro
// y/o cuotas sin interés, a veces combinados con "+"), rubro(s), medio de
// pago (Débito/Crédito), día de vigencia y provincia.
//
// El sitio está detrás de un WAF Akamai (edgesuite.net) que banea la IP a
// nivel general (no por sesión) tras ~10-12 requests en pocos minutos —
// el baneo es temporal (se recupera en ~20 min) pero hace que correr esto
// en un runner compartido (GitHub Actions) sea poco confiable. Preferir
// correr localmente, como ICBC.

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { dedup, extractCap } from './bank-helpers';

const BANK_NAME = 'Banco del Sol';
const LIST_URL = 'https://www.bancodelsol.com/beneficios';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const DAY_TO_MASK: Record<string, number> = {
  'domingo': 1 << 0, 'lunes': 1 << 1, 'martes': 1 << 2, 'miércoles': 1 << 3,
  'jueves': 1 << 4, 'viernes': 1 << 5, 'sábado': 1 << 6,
};

interface SolCard {
  href: string;
  title: string;
  descuento: string;
  rubros: string[];
  pagos: string[];
  dias: string[];
  provincias: string[];
}

const RUBRO_CATEGORY: Record<string, string> = {
  'Supermercados y Almacén': 'Supermercados',
  'Farmacias': 'Farmacias',
  'Perfumería': 'Salud y Belleza',
  'Belleza': 'Salud y Belleza',
  'Salud': 'Salud y Belleza',
  'Turismo': 'Viajes y Turismo',
  'Descanso': 'Viajes y Turismo',
  'Indumentaria y Accesorios': 'Indumentaria',
  'Accesorios': 'Indumentaria',
  'Zapaterías': 'Indumentaria',
  'Marroquinería': 'Indumentaria',
  'Indumentaria Deportiva': 'Deportes',
  'Transporte': 'Transporte',
  'Electrodomésticos': 'Tecnología',
  'Electrónica': 'Tecnología',
  'Pinturerías': 'Hogar',
  'Construcción': 'Hogar',
  'Restaurant': 'Gastronomía',
  'Gastronomía': 'Gastronomía',
  'Cafetería': 'Gastronomía',
  'Cervecería': 'Gastronomía',
  'Consumos': 'Otros',
  'Tienda para Mascotas': 'Petshops',
  'Librerías': 'Librerías',
  'Joyería': 'Otros',
  'Relojería': 'Otros',
  'Gomerías': 'Automotores',
  'Automotor': 'Automotores',
  'Inversiones': 'Otros',
};

function buildValidDays(dias: string[]): number {
  if (dias.some(d => /todos los días/i.test(d))) return 127;
  let mask = 0;
  for (const d of dias) {
    const key = d.toLowerCase();
    if (DAY_TO_MASK[key]) mask |= DAY_TO_MASK[key];
  }
  return mask > 0 ? mask : 127;
}

function categoryFor(rubros: string[]): string {
  for (const r of rubros) {
    const cat = RUBRO_CATEGORY[r];
    if (cat) return cat;
  }
  return 'Otros';
}

async function fetchAllCards(): Promise<SolCard[]> {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    await page.goto(LIST_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(5000);

    const bodyText = await page.textContent('body');
    if (bodyText?.includes('Access Denied')) return [];

    const hasWrapper = await page.evaluate(() => !!document.querySelector('.collection-list-wrapper'));
    if (!hasWrapper) return [];

    for (let i = 0; i < 10; i++) {
      const nextBtn = await page.$('.w-pagination-next.load-more');
      if (!nextBtn || !(await nextBtn.isVisible())) break;
      await nextBtn.click();
      await page.waitForTimeout(3000);
    }

    return await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.collection-item-2.w-dyn-item'));
      return items.map(item => {
        const title = item.querySelector('[fs-list-field="title"]')?.textContent?.trim() ?? '';
        const descuento = item.querySelector('[fs-list-field="descuento"]')?.textContent?.trim() ?? '';
        const rubros = Array.from(item.querySelectorAll('a[fs-list-field="make"]')).map(a => a.textContent?.trim() ?? '');
        const pagos = Array.from(item.querySelectorAll('a[fs-list-field="pago"]')).map(a => a.textContent?.trim() ?? '');
        const dias = Array.from(item.querySelectorAll('a[fs-list-field="dia"]')).map(a => a.textContent?.trim() ?? '');
        const provincias = Array.from(item.querySelectorAll('a[fs-list-field="provincia"]')).map(a => a.textContent?.trim() ?? '');
        const href = item.querySelector('a.card_link')?.getAttribute('href') ?? '';
        return { href, title, descuento, rubros, pagos, dias, provincias };
      });
    });
  } finally {
    await browser.close();
  }
}

function cardToScraped(c: SolCard): ScrapedPromo[] {
  if (!c.title || !c.descuento) return [];

  const storeName = c.title;
  const categoria = categoryFor(c.rubros);
  const validDays = buildValidDays(c.dias);
  const provinces = c.provincias.length > 0 ? c.provincias.filter(p => p !== 'Todo el país') : undefined;
  const cap = extractCap(c.descuento);
  const sourceUrl = c.href ? `https://www.bancodelsol.com${c.href}` : LIST_URL;

  const base: Partial<ScrapedPromo> = {
    sourceUrl,
    sourceText: c.descuento,
    validDays,
    bankNames: [BANK_NAME],
    paymentChannel: 'ANY',
    categoria,
    storeName,
    provinces: provinces && provinces.length > 0 ? provinces : undefined,
  };

  const promos: ScrapedPromo[] = [];

  const pctMatch = c.descuento.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1].replace(',', '.'));
    promos.push({
      ...base,
      title: `${pct}% reintegro – ${storeName}`,
      description: c.descuento,
      discount: String(pct),
      discountType: 'PERCENTAGE_REINTEGRO',
      cap: cap ?? null,
      capPeriod: cap ? 'MONTHLY' : null,
    } as ScrapedPromo);
  }

  const fixedMatch = !pctMatch && c.descuento.match(/\$\s*([\d.,]+)/);
  if (fixedMatch) {
    const amount = parseFloat(fixedMatch[1].replace(/\./g, '').replace(',', '.'));
    promos.push({
      ...base,
      title: `$${amount} de reintegro – ${storeName}`,
      description: c.descuento,
      discount: String(amount),
      discountType: 'FIXED_AMOUNT',
      cap: null,
      capPeriod: null,
    } as ScrapedPromo);
  }

  const hasCuotas = /cuotas?\s+sin\s+inter[eé]s/i.test(c.descuento);
  if (hasCuotas) {
    const nums = [...c.descuento.matchAll(/(\d+)/g)].map(m => parseInt(m[1]));
    const cuotas = nums.length > 0 ? Math.max(...nums) : null;
    if (cuotas) {
      promos.push({
        ...base,
        title: `${cuotas} cuotas sin interés – ${storeName}`,
        description: c.descuento,
        discount: String(cuotas),
        discountType: 'CUOTAS_SIN_INTERES',
        cap: null,
        capPeriod: null,
      } as ScrapedPromo);
    }
  }

  return promos;
}

export const SolScraper: Scraper = {
  name: 'Sol',
  async run(): Promise<ScrapedPromo[]> {
    const cards = await fetchAllCards();
    const all: ScrapedPromo[] = [];
    for (const c of cards) {
      all.push(...cardToScraped(c));
    }
    return dedup(all);
  },
};

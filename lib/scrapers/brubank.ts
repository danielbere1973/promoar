// Brubank Scraper
// Extrae beneficios desde https://www.brubank.com/beneficios
// Tres niveles: Plan One (blanco), Plan Plus (violeta), Plan Ultra (oscuro)

import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';

const PAGE_URL = 'https://www.brubank.com/beneficios';
const BANK_NAME = 'Brubank';

// CSS class suffix → plan name (debe coincidir con bank_segments en DB)
const PLAN_MAP: Record<string, string> = {
  'card-promo-dark':   'Plan Ultra',
  'card-promo-purple': 'Plan Plus',
  'card-promo-white':  'Plan One',
};

function parseDias(text: string): number {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('todos')) return 127;

  const dias = [
    { names: ['lunes'], bit: 0 },
    { names: ['martes'], bit: 1 },
    { names: ['miercoles'], bit: 2 },
    { names: ['jueves'], bit: 3 },
    { names: ['viernes'], bit: 4 },
    { names: ['sabado'], bit: 5 },
    { names: ['domingo'], bit: 6 },
  ];
  let mask = 0;
  dias.forEach(({ names, bit }) => {
    if (names.some(n => t.includes(n))) mask |= 1 << bit;
  });
  return mask > 0 ? mask : 127;
}

function extractCap(text: string): number | null {
  const m = text.match(/\$\s*([\d.,]+)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

function parseDiscount(discountText: string): { value: number; type: string } | null {
  const t = discountText.toLowerCase();

  // Cuotas sin interés: "Hasta 6 cuotas sin interés", "3, 6 y 12 cuotas sin interés", "2 a 12 cuotas sin interés"
  if (t.includes('cuota') || t.includes('csi')) {
    const nums = discountText.match(/\d+/g)?.map(Number) || [];
    const maxCuotas = nums.length > 0 ? Math.max(...nums) : 0;
    if (maxCuotas > 0) return { value: maxCuotas, type: 'CUOTAS_SIN_INTERES' };
  }

  // Reintegro: "30% de reintegro"
  if (t.includes('reintegro') || t.includes('cashback')) {
    const m = discountText.match(/(\d+)\s*%/);
    if (m) return { value: parseInt(m[1]), type: 'PERCENTAGE_REINTEGRO' };
  }

  // Descuento: "20% de descuento"
  if (t.includes('descuento') || t.includes('off')) {
    const m = discountText.match(/(\d+)\s*%/);
    if (m) return { value: parseInt(m[1]), type: 'PERCENTAGE_DESCUENTO' };
  }

  return null;
}

export const BrubankScraper: Scraper = {
  name: 'Brubank',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Brubank] Iniciando scraper...');
    const allPromos: ScrapedPromo[] = [];

    try {
      const res = await fetch(PAGE_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const $ = cheerio.load(html);

      console.log(`[Brubank] HTML cargado (${html.length} bytes)`);

      for (const [planClass, planName] of Object.entries(PLAN_MAP)) {
        const cards = $(`.${planClass}`).filter((_, el) => {
          // Excluir card-promo-wrapper (son wrappers vacíos)
          const cls = $(el).attr('class') || '';
          return cls.includes(planClass) && !cls.includes('wrapper');
        });

        console.log(`[Brubank] ${planName}: ${cards.length} cards`);

        cards.each((_, el) => {
          try {
            const wrapper = $(el).find('[class*="card-promo-wrapper"]');

            // Descuento: en <strong> o texto del h4 que contiene %/cuotas
            const strong = wrapper.find('strong, [class*="titulo-cuotas"]').first();
            const discountText = strong.text().replace(/‍/g, '').trim().replace(/\s+/g, ' ');

            // Nombre de la empresa: texto del h4 SIN el strong
            const h4 = wrapper.find('h4').first();
            const storeName = h4.clone().find('strong, br').remove().end()
              .text().replace(/‍/g, '').trim().replace(/\s+/g, ' ');

            // Días y tope: en el <p>
            const p = wrapper.find('p').first();
            const pText = p.clone().find('a').remove().end()
              .text().replace(/‍/g, '').trim().replace(/\s+/g, ' ');

            // Separar días de tope (si ambos en el mismo p, separados por \n o punto)
            const lines = pText.split(/\n|Tope/).map(s => s.trim()).filter(Boolean);
            const diasText = lines[0] || 'Todos los días';
            const capText = pText.toLowerCase().includes('tope') ? pText : '';

            const discount = parseDiscount(discountText);
            if (!discount) return;

            const cap = extractCap(capText) || undefined;
            const validDays = parseDias(diasText);
            const logoUrl = $(el).find('img').first().attr('src') || undefined;
            const categoria = detectCategoria(storeName) || 'Otros';

            const title = discount.type === 'CUOTAS_SIN_INTERES'
              ? `${discount.value} cuotas sin interés – ${storeName}`
              : `${discount.value}% ${discount.type === 'PERCENTAGE_REINTEGRO' ? 'reintegro' : 'descuento'} – ${storeName}`;

            allPromos.push({
              storeName,
              storeLogoUrl: logoUrl,
              title,
              description: `${discountText} en ${storeName}. ${diasText}.${cap ? ` Tope: $${cap.toLocaleString('es-AR')}.` : ''}`,
              sourceText: `${discountText} ${storeName} ${diasText} ${capText}`.trim(),
              sourceUrl: PAGE_URL,
              discount: String(discount.value),
              discountType: discount.type,
              cap: cap ?? null,
              capPeriod: cap ? 'MONTHLY' : undefined,
              capTarget: cap ? 'USER' : undefined,
              validDays,
              bankNames: [BANK_NAME],
              cardNetworks: [
                { network: 'Mastercard', type: 'DEBIT' },
                { network: 'Mastercard', type: 'CREDIT' },
              ],
              categoria,
              paymentChannel: 'TARJETA_FISICA',
              segment: planName,
            } as ScrapedPromo);
          } catch (err) {
            console.error('[Brubank] Error parseando card:', err);
          }
        });
      }
    } catch (err) {
      console.error('[Brubank] Error durante scraping:', err);
    }

    console.log(`[Brubank] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

// Club La Nacion Scraper
// Extrae beneficios del club de socios La Nacion
// Los beneficios aplican a socios con credencial Black, Premium o Classic

import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';

const API_BASE = 'https://api-clubv2.lanacion.com.ar/v2/accounts';
const SITE_BASE = 'https://club.lanacion.com.ar/beneficios';
const WALLET_NAME = 'Club La Nacion';
const PAGE_SIZE = 50;
const DELAY_MS = 300;

// Categorías del club → categorías de PromoAR
const CATEGORY_MAP: Record<string, string> = {
  gastronomia:  'Gastronomía',
  salidas:      'Entretenimiento',
  viajes:       'Viajes y Turismo',
  moda:         'Indumentaria',
  hogar:        'Hogar',
  mercados:     'Supermercados',
  bienestar:    'Salud y Belleza',
  automovil:    'Automotores',
  educacion:    'Librerías',
  otros:        'Otros',
};

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function parseDiscount(type: string): number {
  const m = type.match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

function parseDias(text: string): number {
  const t = text.toLowerCase();
  if (t.includes('todos') || t.includes('todos los días')) return 127;

  const dias = [
    { names: ['lunes'], bit: 0 },
    { names: ['martes'], bit: 1 },
    { names: ['miércoles', 'miercoles'], bit: 2 },
    { names: ['jueves'], bit: 3 },
    { names: ['viernes'], bit: 4 },
    { names: ['sábado', 'sabado'], bit: 5 },
    { names: ['domingo'], bit: 6 },
  ];
  let mask = 0;
  dias.forEach(({ names, bit }) => {
    if (names.some(n => t.includes(n))) mask |= 1 << bit;
  });
  return mask > 0 ? mask : 127;
}

function parseVigencia(text: string): { validFrom?: Date; validUntil?: Date } {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return {};
  return {
    validFrom: new Date(`${m[3]}-${m[2]}-${m[1]}`),
    validUntil: new Date(`${m[6]}-${m[5]}-${m[4]}`),
  };
}

function parseModality(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('online') && t.includes('presencial')) return 'ANY';
  if (t.includes('online') || t.includes('tienda online') || t.includes('ecommerce')) return 'ECOMMERCE';
  return 'TARJETA_FISICA';
}

function extractConditions(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const conditions: Record<string, string> = {};
  const labels = [
    'credenciales que aplica',
    '¿qué necesito?',
    'días que aplica',
    'modalidad de compra',
    'sucursales adheridas',
    'vigencia',
    'legales',
  ];

  $('[class*="condition-item"]').each((_, el) => {
    const full = $(el).text().replace(/\s+/g, ' ').trim();
    for (const label of labels) {
      if (full.toLowerCase().startsWith(label) && !conditions[label]) {
        conditions[label] = full.substring(label.length).trim();
      }
    }
  });
  return conditions;
}

function extractDescription(html: string): string {
  const $ = cheerio.load(html);
  // Description is in the meta or in the paragraph near the business name
  const meta = $('meta[name="description"]').attr('content') || '';
  if (meta) return meta.trim();
  // Fallback: text near .benefit-title
  return $('[class*="benefit-title"] p, [class*="benefit-title"] span').first().text().trim();
}

async function fetchDetail(slug: string): Promise<Partial<ScrapedPromo>> {
  const url = `${SITE_BASE}${slug}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const conditions = extractConditions(html);
    const description = extractDescription(html);

    const credText = conditions['credenciales que aplica'] || 'Black Premium Classic';
    const diasText = conditions['días que aplica'] || 'todos';
    const vigencia = parseVigencia(conditions['vigencia'] || '');
    const modality = parseModality(conditions['modalidad de compra'] || 'presencial');
    const legales = conditions['legales'] || '';
    const sucursales = conditions['sucursales adheridas'] || '';

    const credenciales: string[] = [];
    if (credText.includes('Black')) credenciales.push('Black');
    if (credText.includes('Premium')) credenciales.push('Premium');
    if (credText.includes('Classic')) credenciales.push('Classic');

    const noteparts = [];
    if (credenciales.length > 0 && credenciales.length < 3) noteparts.push(`Credencial ${credenciales.join(' / ')}`);
    if (sucursales) noteparts.push(sucursales);

    return {
      description: description || legales || '',
      validDays: parseDias(diasText),
      ...vigencia,
      paymentChannel: modality as any,
      note: noteparts.length > 0 ? noteparts.join(' · ') : undefined,
      sourceText: `${credText} ${diasText} ${conditions['vigencia'] || ''} ${legales}`.trim(),
    };
  } catch {
    return {};
  }
}

async function fetchAllSlugs(categoriaFilter?: string): Promise<Array<{ slug: string; name: string; discountType: string; logoUrl?: string; categorySlug: string; ecommerce: boolean }>> {
  const items: any[] = [];
  let page = 1;
  let total = Infinity;

  const categoryParam = categoriaFilter ? `&category=${encodeURIComponent(categoriaFilter)}` : '';

  while (items.length < total) {
    const url = `${API_BASE}?includeFilters=true&sort=relevance&size=${PAGE_SIZE}&page=${page}${categoryParam}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) break;
      const data = await res.json();
      total = data.meta?.total ?? 0;
      const batch: any[] = data.data ?? [];
      if (batch.length === 0) break;
      items.push(...batch);
      console.log(`[ClubLN] Página ${page}: ${items.length}/${total}`);
      page++;
      await sleep(DELAY_MS);
    } catch (err) {
      console.error('[ClubLN] Error fetching list:', err);
      break;
    }
  }

  return items.map(item => ({
    slug: item.slug,
    name: item.name,
    discountType: item.displayBenefit?.type ?? '',
    logoUrl: item.images?.[0]?.url ?? undefined,
    categorySlug: (item.slug || '').split('/')[1] ?? 'otros',
    ecommerce: !!item.ecommerce,
  }));
}

export const ClubLaNacionScraper: Scraper = {
  name: 'Club La Nacion',

  async run(categoriaFilter?: string): Promise<ScrapedPromo[]> {
    const isTest = categoriaFilter === 'TEST';
    const efectiveFilter = isTest ? undefined : categoriaFilter;
    console.log(`[ClubLN] Iniciando scraper${efectiveFilter ? ` — categoría: ${efectiveFilter}` : isTest ? ' — MODO TEST (5 ítems)' : ''}...`);
    const allPromos: ScrapedPromo[] = [];

    let items = await fetchAllSlugs(efectiveFilter);
    if (isTest) items = items.slice(0, 5);
    console.log(`[ClubLN] Total slugs: ${items.length}`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.slug || !item.discountType) continue;

      const discountValue = parseDiscount(item.discountType);
      if (!discountValue) continue;

      const categoria = CATEGORY_MAP[item.categorySlug] || detectCategoria(item.name) || 'Otros';
      const detail = await fetchDetail(item.slug);
      await sleep(DELAY_MS);

      const title = `${discountValue}% descuento – ${item.name}`;

      allPromos.push({
        storeName: item.name,
        storeLogoUrl: item.logoUrl,
        title,
        description: detail.description || `${discountValue}% de descuento en ${item.name} con Club La Nacion.`,
        sourceText: detail.sourceText || title,
        sourceUrl: `${SITE_BASE}${item.slug}`,
        discount: String(discountValue),
        discountType: 'PERCENTAGE_DESCUENTO',
        validDays: detail.validDays ?? 127,
        validFrom: detail.validFrom,
        validUntil: detail.validUntil,
        paymentChannel: detail.paymentChannel ?? (item.ecommerce ? 'ECOMMERCE' : 'TARJETA_FISICA'),
        walletNames: [WALLET_NAME],
        bankNames: [],
        cardNetworks: [],
        categoria,
        note: detail.note,
      } as ScrapedPromo);

      if ((i + 1) % 10 === 0) {
        console.log(`[ClubLN] Procesados: ${i + 1}/${items.length}`);
      }
    }

    console.log(`[ClubLN] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

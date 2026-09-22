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

function isNxM(type: string): boolean {
  return /^\d+[xX]\d+$/.test(type.trim())
}

function parseDiscount(type: string): number {
  // NxM: no es un porcentaje, devolver 0 para que se maneje por separado
  if (isNxM(type)) return 0
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

// Extrae los días activos de una card a partir de la lista `ul > li` con clase
// bg-primary-negative en el/los día(s) vigente(s) (ver estructura real confirmada
// en la página de detalle de YPF — cada benefit-card tiene su propia lista).
function extractCardDays($card: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): number {
  const dayNames = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const items = $card.find('ul li').toArray();
  if (items.length === 0) return 127;
  let mask = 0;
  let anyActive = false;
  items.forEach((el, i) => {
    if (i >= 7) return;
    const $el = $(el);
    const isActive = $el.hasClass('bg-primary-negative') || $el.find('.bg-primary-negative').length > 0;
    if (isActive) { mask |= 1 << i; anyActive = true; }
  });
  if (!anyActive) return 127;
  return mask;
}

export interface BenefitCard {
  benefitId: string;
  benefitTitle: string;
  benefitType: string; // ej. "30% OFF"
  scopedText: string;  // título + descripción + condiciones propias, para clasificación
  validDays: number;
  conditions: Record<string, string>;
}

// Extrae cada beneficio real de una página de detalle de Club La Nación.
// Cada `article.benefit-card[id]` es un beneficio independiente, con su propio
// %, texto, días activos y condiciones — NO deben mezclarse entre cards
// (confirmado con YPF: vigencias distintas entre benefit 1 y 2/3).
export function extractBenefitCards(html: string): BenefitCard[] {
  const $ = cheerio.load(html);
  const cards: BenefitCard[] = [];

  $('article.benefit-card[id]').each((_, el) => {
    const $card = $(el);
    const benefitId = $card.attr('id') || '';
    if (!benefitId) return;

    const benefitType = $card.find('.benefit-type').first().text().replace(/\s+/g, ' ').trim();
    const benefitTitle = $card.find('.benefit-title h4').first().text().replace(/\s+/g, ' ').trim()
      || $card.find('.benefit-title').first().text().replace(/\s+/g, ' ').trim();

    const conditions: Record<string, string> = {};
    const labels = [
      'credenciales que aplica', '¿qué necesito?', 'días que aplica',
      'modalidad de compra', 'sucursales adheridas', 'vigencia', 'legales',
    ];
    $card.find('[class*="condition-item"]').each((__, cel) => {
      const full = $(cel).text().replace(/\s+/g, ' ').trim();
      for (const label of labels) {
        if (full.toLowerCase().startsWith(label) && !conditions[label]) {
          conditions[label] = full.substring(label.length).trim();
        }
      }
    });

    const validDays = extractCardDays($card, $);
    const scopedText = [benefitTitle, conditions['legales'], conditions['¿qué necesito?']]
      .filter(Boolean).join(' ');

    cards.push({ benefitId, benefitTitle, benefitType, scopedText, validDays, conditions });
  });

  return cards;
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

// Variante de fetchDetail que además devuelve las benefit-cards scoped de la página,
// para el caso multi-beneficio (ver run()).
export async function fetchDetailWithCards(slug: string): Promise<{ detail: Partial<ScrapedPromo>; cards: BenefitCard[] }> {
  const url = `${SITE_BASE}${slug}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return { detail: {}, cards: [] };
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

    const detail: Partial<ScrapedPromo> = {
      description: description || legales || '',
      validDays: parseDias(diasText),
      ...vigencia,
      paymentChannel: modality as any,
      note: noteparts.length > 0 ? noteparts.join(' · ') : undefined,
      sourceText: `${credText} ${diasText} ${conditions['vigencia'] || ''} ${legales}`.trim(),
    };

    return { detail, cards: extractBenefitCards(html) };
  } catch {
    return { detail: {}, cards: [] };
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

// Clasificación beneficio > comercio (RFC Club La Nación multi-beneficio, 12/8/2026):
// 1. contenido scoped del beneficio (título+condiciones de SU card, sin mezclar con otras)
// 2. taxonomía de navegación del sitio origen (CATEGORY_MAP por categorySlug de la URL)
// 3. nombre del comercio
// 4. defaultCategory del comercio (fallback final, se resuelve después en scrape/route.ts)
// 5. Sin Categoría/Otros
// No forzamos categoría si ninguna señal de contenido es suficiente — un fallback
// honesto a 'Otros' es preferible a una clasificación incorrecta (ver caso YPF Full).
// allowBrandFallback: solo true para el caso simple (1 beneficio por página, comportamiento
// histórico sin cambios — clasificar por el nombre del comercio como último recurso sigue
// siendo válido ahí). En el caso multi-card (varios beneficios reales en la misma página,
// ej. YPF) queda en false: un comercio puede tener beneficios de rubros distintos entre sí,
// así que el nombre del comercio ya no es una señal confiable por-beneficio (§4, RFC 12/8/2026,
// caso YPF Full: sin señal propia clasificable, debe caer a 'Otros', no heredar la marca).
export function classifyBenefit(
  benefitScopedText: string,
  categorySlug: string,
  commerceName: string,
  allowBrandFallback: boolean = true
): string {
  // Sacamos el nombre del comercio del texto scoped antes de clasificar: si no, un beneficio
  // de "lubricante sintético... a través de APP YPF" matchea Combustible por la marca (YPF)
  // en vez de Automotores por el contenido real (lubricante) — la marca no debe pesar más
  // que lo que el beneficio efectivamente ofrece.
  const nameParts = commerceName.split(/\s+/).filter(w => w.length > 2);
  const textWithoutBrand = nameParts.length > 0
    ? benefitScopedText.replace(new RegExp(nameParts.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi'), '')
    : benefitScopedText;

  // CATEGORY_MAP (taxonomía de navegación de la página, ej. "automovil/combustible") queda
  // deliberadamente fuera de este cascade: describe DÓNDE se listó el comercio en el sitio
  // origen, no necesariamente el rubro del beneficio individual.
  return (
    detectCategoria(textWithoutBrand)
    || (allowBrandFallback ? detectCategoria(commerceName) : '')
    || 'Otros'
  );
}

// Construye los ScrapedPromo de un único item ya resuelto (slug/name/categorySlug/ecommerce)
// + su detalle/cards — extraído de run() para poder testear un solo comercio sin pegarle
// al endpoint de listado completo.
export function buildPromosForItem(
  item: { slug: string; name: string; discountType: string; logoUrl?: string; categorySlug: string; ecommerce: boolean },
  detail: Partial<ScrapedPromo>,
  cards: BenefitCard[]
): ScrapedPromo[] {
  const nxm = isNxM(item.discountType);
  const discountValue = parseDiscount(item.discountType);
  const baseUrl = `${SITE_BASE}${item.slug}`;

  if (cards.length > 1) {
    return cards.map((card): ScrapedPromo => {
      const cardNxm = isNxM(card.benefitType);
      const cardDiscount = parseDiscount(card.benefitType);
      const title = cardNxm
        ? `${card.benefitType} – ${card.benefitTitle || item.name}`
        : `${cardDiscount || discountValue}% descuento – ${card.benefitTitle || item.name}`;
      const categoria = classifyBenefit(card.scopedText, item.categorySlug, item.name, false);

      return {
        storeName: item.name,
        storeLogoUrl: item.logoUrl,
        title,
        description: card.benefitTitle || detail.description || title,
        sourceText: card.scopedText || detail.sourceText || title,
        sourceUrl: baseUrl,
        source: 'club-lanacion',
        externalId: card.benefitId,
        discount: cardNxm ? card.benefitType : String(cardDiscount || discountValue),
        discountType: cardNxm ? 'NXM' : 'PERCENTAGE_DESCUENTO',
        validDays: card.validDays,
        validFrom: detail.validFrom,
        validUntil: detail.validUntil,
        paymentChannel: detail.paymentChannel ?? (item.ecommerce ? 'ECOMMERCE' : 'TARJETA_FISICA'),
        walletNames: [WALLET_NAME],
        bankNames: [],
        cardNetworks: [],
        categoria,
        note: detail.note,
      } as ScrapedPromo;
    });
  }

  // Caso simple (1 beneficio o cards no detectadas): comportamiento previo, sin regresión —
  // allowBrandFallback=true (default) mantiene detectCategoria(commerceName) como último
  // recurso, igual que antes de este RFC.
  const categoria = classifyBenefit(item.name, item.categorySlug, item.name);
  const title = nxm
    ? `${item.discountType} – ${item.name}`
    : `${discountValue}% descuento – ${item.name}`;

  return [{
    storeName: item.name,
    storeLogoUrl: item.logoUrl,
    title,
    description: detail.description || (nxm
      ? `${item.discountType} en ${item.name} con Club La Nacion.`
      : `${discountValue}% de descuento en ${item.name} con Club La Nacion.`),
    sourceText: detail.sourceText || title,
    sourceUrl: baseUrl,
    source: 'club-lanacion',
    externalId: cards[0]?.benefitId,
    discount: nxm ? item.discountType : String(discountValue),
    discountType: nxm ? 'NXM' : 'PERCENTAGE_DESCUENTO',
    validDays: detail.validDays ?? 127,
    validFrom: detail.validFrom,
    validUntil: detail.validUntil,
    paymentChannel: detail.paymentChannel ?? (item.ecommerce ? 'ECOMMERCE' : 'TARJETA_FISICA'),
    walletNames: [WALLET_NAME],
    bankNames: [],
    cardNetworks: [],
    categoria,
    note: detail.note,
  } as ScrapedPromo];
}

export const ClubLaNacionScraper: Scraper = {
  name: 'Club La Nacion',

  async run(categoriaFilter?: string): Promise<ScrapedPromo[]> {
    const isTest = categoriaFilter === 'TEST';
    const efectiveFilter = isTest ? undefined : categoriaFilter;
    console.log(`[ClubLN] Iniciando scraper${efectiveFilter ? ` — categoría: ${efectiveFilter}` : isTest ? ' — MODO TEST (5 ítems)' : ''}...`);

    let items = await fetchAllSlugs(efectiveFilter);
    if (isTest) items = items.slice(0, 5);

    // Filtrar ítems sin descuento antes de hacer los fetches de detalle
    const validItems = items.filter(item => {
      if (!item.slug || !item.discountType) return false;
      const nxm = isNxM(item.discountType);
      const discountValue = parseDiscount(item.discountType);
      return discountValue > 0 || nxm;
    });
    console.log(`[ClubLN] ${items.length} slugs → ${validItems.length} con descuento válido`);

    // Fetch de detalle en batches paralelos (igual que MODO) → mucho más rápido
    const DETAIL_BATCH = 10;
    const detailMap = new Map<string, { detail: Partial<ScrapedPromo>; cards: BenefitCard[] }>();
    for (let i = 0; i < validItems.length; i += DETAIL_BATCH) {
      const batch = validItems.slice(i, i + DETAIL_BATCH);
      const results = await Promise.all(batch.map(item => fetchDetailWithCards(item.slug)));
      batch.forEach((item, j) => detailMap.set(item.slug, results[j]));
      console.log(`[ClubLN] Detalle ${Math.min(i + DETAIL_BATCH, validItems.length)}/${validItems.length}`);
      if (i + DETAIL_BATCH < validItems.length) await sleep(200);
    }

    const allPromos: ScrapedPromo[] = validItems.flatMap(item => {
      const { detail, cards } = detailMap.get(item.slug) ?? { detail: {}, cards: [] };
      return buildPromosForItem(item, detail, cards);
    });

    console.log(`[ClubLN] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

import axios from 'axios';
import { Scraper, ScrapedPromo } from './types';

const SLOTS_API = 'https://www.modo.com.ar/promos/api/rewards/slots';
const PROMO_BASE_URL = 'https://www.modo.com.ar/promos';

const SLOTS = [
  'web-modo-hub-carrousel_principal',
  'web-modo-hub-destacadas',
  'web-modo-hub-supermercados',
  'web-modo-hub-exclusivas-online',
  'web-modo-hub-promos-financiacion',
  'web-modo-hub-mas-promos',
].join(',');

// ─── Mapas de categorías MODO ─────────────────────────────────────────────────

// Subcategoría es el criterio más específico
const MODO_SUBCAT_MAP: Record<string, string> = {
  '43': 'Supermercados',
  '34': 'Supermercados',
  '26': 'Supermercados',
  '13': 'Gastronomía',
  '14': 'Gastronomía',
  '12': 'Gastronomía',
  '30': 'Gastronomía',
  '46': 'Gastronomía',
  '47': 'Gastronomía',
  '44': 'Gastronomía',
  '45': 'Gastronomía',
  '17': 'Gastronomía',
  '27': 'Gastronomía',
  '29': 'Heladerías',
  '35': 'Indumentaria',
  '38': 'Indumentaria',
  '48': 'Indumentaria',
  '49': 'Indumentaria',
  '16': 'Farmacias',
  '37': 'Salud y Belleza',
  '8':  'Salud y Belleza',
  '33': 'Salud y Belleza',
  '50': 'Salud y Belleza',
  '32': 'Salud y Belleza',
  '28': 'Combustible',
  '22': 'Deportes',
  '25': 'Hogar',
  '19': 'Hogar',
  '51': 'Hogar',
  '42': 'Hogar',
  '3':  'Hogar',
  '4':  'Hogar',
  '39': 'Hogar',
  '10': 'Hogar',
  '5':  'Automotores',
  '53': 'Automotores',
  '52': 'Automotores',
  '56': 'Mascotas',
  '40': 'Mascotas',
  '36': 'Tecnología',
  '41': 'Tecnología',
  '15': 'Jugueterías',
  '20': 'Librerías',
  '23': 'Librerías',
  '58': 'Entretenimiento',
  '9':  'Entretenimiento',
  '31': 'Viajes y Turismo',
  '57': 'Viajes y Turismo',
  '7':  'Transporte',
  '18': 'Otros',
  '24': 'Otros',
  '1':  'Otros',
  '2':  'Otros',
  '6':  'Otros',
  '11': 'Otros',
  '21': 'Otros',
  '54': 'Otros',
  '55': 'Otros',
};

// Fallback por map_category
const MODO_CAT_MAP: Record<string, string> = {
  '1':  'Supermercados',
  '2':  'Gastronomía',
  '3':  'Indumentaria',
  '4':  'Farmacias',
  '5':  'Combustible',
  '6':  'Deportes',
  '7':  'Hogar',
  '8':  'Automotores',
  '10': 'Tecnología',
  '11': 'Hogar',
  '12': 'Mascotas',
  '13': 'Jugueterías',
  '14': 'Entretenimiento',
  '15': 'Otros',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ContentRow { text: string; }

interface ModoCard {
  id: string;
  slug: string;
  title: string;
  short_description: string;
  where: string;
  start_date: string;
  stop_date: string;
  days_of_week: string;
  payment_flow: string;
  trigger_type: string;
  status: string;
  calculated_status: string;
  search_tags: string;
  promo_id: string;
  discount_info: string;
  minimum_amount: number;
  banks: string[];
  credit_list: string[] | null;
  debit_list: string[] | null;
  categories_whitelist?: {
    categories: Array<{ map_category: number; sub_categories: number[] }>;
  };
  content: { row: ContentRow[] };
}

interface ModoApiResponse {
  data: { cards: ModoCard[] };
  metadata?: { pagination?: { page: number; page_results: number; total_pages: number; total_results: number } };
}

interface CapDetails {
  cap: number | null;
  capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  banks: Array<{ name: string; bcraCode?: string }>;
  paymentChannel: 'QR' | 'NFC' | 'DINERO_EN_CUENTA' | 'TARJETA_FISICA' | 'ANY';
  legalText: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_CHAR_TO_BIT: Record<string, number> = {
  D: 1 << 0, L: 1 << 1, M: 1 << 2, X: 1 << 3,
  J: 1 << 4, V: 1 << 5, S: 1 << 6,
};

function parseDaysOfWeek(raw: string | null | undefined): number {
  if (!raw) return 127;
  let mask = 0;
  for (const ch of raw.toUpperCase()) {
    if (DAY_CHAR_TO_BIT[ch] !== undefined) mask |= DAY_CHAR_TO_BIT[ch];
  }
  return mask || 127;
}

function normStr(s: string) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function detectModoCategory(card: ModoCard): string | undefined {
  const cats = card.categories_whitelist?.categories ?? [];
  for (const c of cats) {
    for (const subId of (c.sub_categories ?? [])) {
      const mapped = MODO_SUBCAT_MAP[String(subId)];
      if (mapped) return mapped;
    }
    const mapped = MODO_CAT_MAP[String(c.map_category)];
    if (mapped) return mapped;
  }
  return undefined;
}

function extractNetworks(card: ModoCard): Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> {
  const result: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
  const nameMap: Record<string, string> = {
    visa: 'Visa', master: 'Mastercard', mastercard: 'Mastercard',
    amex: 'American Express', 'american express': 'American Express',
    cabal: 'Cabal', maestro: 'Maestro', naranja: 'Naranja X',
  };
  for (const n of card.credit_list ?? []) {
    const network = nameMap[n.toLowerCase()];
    if (network) result.push({ network, type: 'CREDIT' });
  }
  for (const n of card.debit_list ?? []) {
    const network = nameMap[n.toLowerCase()];
    if (network) result.push({ network, type: 'DEBIT' });
  }
  return result;
}

function extractDiscount(card: ModoCard): Array<{ value: number; type: string }> {
  const raw: Array<{ value: number; type: string }> = [];
  const sources = [card.discount_info, card.title, card.short_description].filter(Boolean);

  for (const text of sources) {
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const value = parseFloat(pctMatch[1]);
      const type = /reintegro|cashback|devoluc|extra|adicional/i.test(text)
        ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      raw.push({ value, type });
    }
    const cuotasMatch = text.match(/(\d+)\s*(?:cuotas?\s+sin\s+inter[eé]s|CSI)/i);
    if (cuotasMatch) raw.push({ value: parseInt(cuotasMatch[1]), type: 'CUOTAS_SIN_INTERES' });
  }

  // Deduplicar: REINTEGRO gana sobre DESCUENTO para mismo valor
  const pctMap = new Map<number, string>();
  const cuotasSet = new Set<number>();
  const result: Array<{ value: number; type: string }> = [];

  for (const d of raw) {
    if (d.type === 'CUOTAS_SIN_INTERES') {
      if (!cuotasSet.has(d.value)) { cuotasSet.add(d.value); result.push(d); }
    } else {
      if (!pctMap.has(d.value)) pctMap.set(d.value, d.type);
      else if (d.type === 'PERCENTAGE_REINTEGRO') pctMap.set(d.value, 'PERCENTAGE_REINTEGRO');
    }
  }
  for (const [value, type] of pctMap) result.push({ value, type });
  return result;
}

type CardTier = 'CLASSIC' | 'GOLD' | 'PLATINUM' | 'SIGNATURE' | 'BLACK' | 'INFINITE' | 'EMINENT' | 'SELECTA';

function extractCardTier(card: ModoCard): CardTier | null {
  // Buscar en slug, search_tags, título y content (legales)
  const contentText = card.content?.row?.map(r => r.text).filter(Boolean).join(' ') ?? '';
  const text = normStr([card.slug, card.search_tags, card.title, card.short_description, contentText].join(' '));

  // Orden importante: más restrictivo primero para evitar que "gold" matchee "gold infinite"
  if (text.includes('infinite')) return 'INFINITE';
  if (text.includes('signature')) return 'SIGNATURE';
  if (text.includes('platinum')) return 'PLATINUM';
  if (text.includes('black')) return 'BLACK';
  if (text.includes('eminent')) return 'EMINENT';
  if (text.includes('selecta')) return 'SELECTA';
  if (text.includes('gold')) return 'GOLD';
  if (text.includes('classic')) return 'CLASSIC';
  return null;
}

function extractStoreName(card: ModoCard): string {
  const where = card.where?.trim() || '';
  const isGeneric = /consultar|adheridos|locales|tienda online/i.test(normStr(where)) || !where;

  if (!isGeneric) return where;

  const titleMatch = card.title.match(/\ben\s+([A-Za-zÁ-ÿ\s&,]+?)(?:\s*[·\-\d%]|$)/i);
  if (titleMatch?.[1]?.trim()) return titleMatch[1].trim();

  const descRows = card.content?.row?.map(r => r.text).filter(Boolean) || [];
  const descMatch = descRows.join(' ').match(/^([^·\-\d%·\n]{3,40}?)(?:\s*·|\s*-|\s*\d)/);
  if (descMatch?.[1]?.trim()) return descMatch[1].trim();

  return 'MODO';
}

// ─── Fetch individual promo (solo cap + bcra_code de bancos) ──────────────────

async function fetchCapAndBanks(promoUrl: string): Promise<CapDetails> {
  const result: CapDetails = { cap: null, capPeriod: null, banks: [], paymentChannel: 'ANY', legalText: '' };
  try {
    const { data: html } = await axios.get(promoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      timeout: 10000,
    });

    // cap_amount
    const capMatch = html.match(/\\"cap_amount\\":\s*(\d+(?:\.\d+)?)/);
    if (capMatch) result.cap = parseFloat(capMatch[1]);

    // period_type → capPeriod
    const periodMatch = html.match(/\\"period_type\\":\s*\\"([^"]+)\\"/);
    if (periodMatch) {
      const p = periodMatch[1].toLowerCase();
      if (p === 'daily') result.capPeriod = 'DAILY';
      else if (p === 'weekly') result.capPeriod = 'WEEKLY';
      else if (p === 'monthly') result.capPeriod = 'MONTHLY';
    }

    // banks con bcra_code
    const banksMatch = html.match(/\\"banks\\":\s*(\[[\s\S]*?\])/);
    if (banksMatch) {
      try {
        const jsonStr = banksMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const banksArray = JSON.parse(jsonStr);
        for (const bank of banksArray) {
          if (bank.name) result.banks.push({ name: bank.name, bcraCode: bank.bcra_code });
        }
      } catch {}
    }

    // legal text — capturar bloques en mayúsculas (texto legal típico de MODO)
    const legalMatches = html.match(/V[ÁA]LID[OA][^<]{30,2000}/gi) ?? [];
    if (legalMatches.length > 0) {
      result.legalText = legalMatches
        .map((m: string) => m.replace(/\s+/g, ' ').trim())
        .join(' | ')
        .slice(0, 3000);
    }

    // payment channel
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('dinero en cuenta') || lowerHtml.includes('dinero de la cuenta')) {
      result.paymentChannel = 'DINERO_EN_CUENTA';
    } else if (lowerHtml.includes('pagando con qr') || lowerHtml.includes('escaneando')) {
      result.paymentChannel = 'QR';
    } else if (lowerHtml.includes('sin contacto') || lowerHtml.includes('nfc') || lowerHtml.includes('contactless')) {
      result.paymentChannel = 'NFC';
    } else if (lowerHtml.includes('tarjeta física') || lowerHtml.includes('con tarjeta')) {
      result.paymentChannel = 'TARJETA_FISICA';
    }
  } catch (e) {
    console.error(`[MODO] Error fetching cap/banks for ${promoUrl}:`, e);
  }
  return result;
}

// ─── Fetch paginado ───────────────────────────────────────────────────────────

async function fetchAllPromos(categoria?: string): Promise<ModoCard[]> {
  const all: ModoCard[] = [];
  let page = 1;
  let totalPages = 1;

  const categoryIdMap: Record<string, string> = {
    'Supermercados': '1', 'Gastronomía': '2', 'Indumentaria': '3',
    'Farmacias': '4', 'Combustible': '5', 'Deportes': '6',
    'Hogar': '7', 'Automotores': '8', 'Tecnología': '10',
    'Mascotas': '12', 'Jugueterías': '13', 'Entretenimiento': '14',
  };
  const categoryId = categoria ? (categoryIdMap[categoria] || '') : '';

  while (page <= totalPages) {
    const params = new URLSearchParams({
      slots: SLOTS, banks: '', user_bank_ids: '',
      limit: '50', page: String(page),
      search_text: '', source: 'web_modo', origin: 'web_modo',
      fcalcstatus: 'running', fdoweeks: '', fflow: '',
      slot_info: 'true', categories: categoryId,
    });

    const { data } = await axios.get<ModoApiResponse>(`${SLOTS_API}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.modo.com.ar/promos',
      },
      timeout: 15000,
    });

    const cards = data?.data?.cards ?? [];
    all.push(...cards);
    totalPages = data.metadata?.pagination?.total_pages ?? 1;
    console.log(`[MODO] Página ${page}/${totalPages} — ${cards.length} cards — Total: ${all.length}`);
    page++;
    if (page <= totalPages) await new Promise(r => setTimeout(r, 200));
  }
  return all;
}

// ─── Scraper principal ────────────────────────────────────────────────────────

export const ModoScraper: Scraper = {
  name: 'MODO',

  async run(categoria?: string): Promise<ScrapedPromo[]> {
    console.log('[MODO] Obteniendo promos...');
    const cards = await fetchAllPromos(categoria);
    console.log(`[MODO] Total recibidas: ${cards.length}`);
    if (cards.length === 0) return [];

    const filteredCards = categoria
      ? cards.filter(card => detectModoCategory(card) === categoria)
      : cards;

    console.log(`[MODO] A procesar${categoria ? ` (${categoria})` : ''}: ${filteredCards.length}/${cards.length}`);

    const promos: ScrapedPromo[] = [];

    for (let i = 0; i < filteredCards.length; i++) {
      const card = filteredCards[i];
      console.log(`[MODO] ${i + 1}/${filteredCards.length}: ${card.slug}`);

      const discountInfoArray = extractDiscount(card);
      if (discountInfoArray.length === 0) {
        console.log(`[MODO] Sin descuento, saltando`);
        continue;
      }

      const validFrom = card.start_date ? new Date(card.start_date) : new Date();
      const validUntil = card.stop_date ? new Date(card.stop_date) : null;
      const validDays = parseDaysOfWeek(card.days_of_week);
      const cardNetworks = extractNetworks(card);
      const cardTier = extractCardTier(card);
      const storeName = extractStoreName(card);
      const detectedCategoria = categoria ?? detectModoCategory(card);

      // Descripción desde content rows
      let description = card.content?.row?.map(r => r.text).filter(Boolean).join(' · ') || card.title;
      description = description
        .replace(/\b(?:Desde|Del)\s+el\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:al|hasta)\s+(?:el\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '')
        .replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();

      // Fetch cap + bcra_code (un solo fetch por promo)
      const promoUrl = `${PROMO_BASE_URL}/${card.slug}`;
      const capDetails = await fetchCapAndBanks(promoUrl);
      await new Promise(r => setTimeout(r, 200));

      // Bancos: preferir los del HTML (con bcra_code), fallback al JSON (solo nombre)
      const allBanks = capDetails.banks.length > 0
        ? capDetails.banks
        : (card.banks ?? []).map(name => ({ name }));

      let stackable: boolean | null = null;
      const conditionsText = card.content?.row?.map(r => r.text).filter(Boolean).join(' | ') || '';
      if (/no\s+(?:es\s+)?acumulable/i.test(conditionsText)) stackable = false;
      else if (/(?:es\s+)?acumulable/i.test(conditionsText)) stackable = true;

      for (const discountInfo of discountInfoArray) {
        promos.push({
          title: card.title.trim(),
          description,
          sourceText: capDetails.legalText || conditionsText,
          sourceUrl: promoUrl,
          discount: String(discountInfo.value),
          discountType: discountInfo.type,
          cap: capDetails.cap,
          capPeriod: capDetails.capPeriod ?? (capDetails.cap ? 'MONTHLY' : undefined),
          capTarget: capDetails.cap ? 'USER' : null,
          minPurchase: card.minimum_amount > 0 ? card.minimum_amount : null,
          stackable,
          singleUse: undefined,
          validFrom,
          validUntil,
          specificDates: undefined,
          validDays,
          bankNames: allBanks.length > 0 ? allBanks : undefined,
          walletNames: ['MODO'],
          cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
          cardType: null,
          cardTier,
          paymentChannel: capDetails.paymentChannel,
          accountType: 'ANY',
          storeName,
          categoria: detectedCategoria,
        });
      }
    }

    console.log(`[MODO] ${promos.length} promos procesadas`);
    return promos;
  },
};

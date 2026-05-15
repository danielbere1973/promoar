// Este es el modo.ts ORIGINAL antes de agregar paymentMethodListWithTags
// Solo extrae UNA red de tarjeta usando el método antiguo (keyword search)

import axios from 'axios';
import * as cheerio from 'cheerio';
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

interface ContentRow { text: string; }

interface ModoCard {
  id: string; slug: string; title: string; short_description: string;
  where: string; start_date: string; stop_date: string;
  days_of_week: string; payment_flow: string; trigger_type: string;
  status: string; calculated_status: string; search_tags: string;
  promo_id: string; exclusiveness: string; promo_visibility: string;
  content: { row: ContentRow[]; };
}

interface ModoApiResponse {
  data: { cards: ModoCard[]; };
  metadata?: { 
    pagination?: { 
      page: number; 
      page_results: number;
      total_pages: number; 
      total_results: number; 
    }; 
  };
}

const MODO_CATEGORIES: Record<string, { id: string; keywords: string[] }> = {
  Supermercados: { id: '1', keywords: ['supermercado', 'super', 'dia', 'carrefour', 'coto', 'changomas', 'disco', 'jumbo', 'walmart', 'hipermercado'] },
  Gastronomía: { id: '2', keywords: ['gastronomia', 'restaurant', 'comida', 'cafe', 'bar', 'pizza', 'parrilla', 'delivery', 'pedidosya', 'rappi'] },
  Combustible: { id: '5', keywords: ['combustible', 'nafta', 'shell', 'ypf', 'axion', 'puma', 'surtidor'] },
  Transporte: { id: '6', keywords: ['transporte', 'cabify', 'uber', 'taxi', 'subte', 'colectivo', 'tren', 'peaje'] },
  Tecnología: { id: '7', keywords: ['tecnologia', 'electronica', 'celular', 'notebook', 'computadora', 'fravega', 'garbarino', 'musimundo'] },
  Farmacias: { id: '3', keywords: ['farmacia', 'farmacity', 'simplicity'] },
  Petshops: { id: '8', keywords: ['petshop', 'mascota', 'veterinaria', 'pet'] },
  Indumentaria: { id: '4', keywords: ['indumentaria', 'ropa', 'zapatilla', 'calzado', 'textil'] },
};

// ─── Helper: Extracción de datos ───────────────────────────────────────────────

function extractCardNetwork(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('visa')) return 'Visa';
  if (lower.includes('mastercard') || lower.includes('master')) return 'Mastercard';
  if (lower.includes('amex') || lower.includes('american express')) return 'American Express';
  if (lower.includes('cabal')) return 'Cabal';
  return null;
}

function extractCardType(text: string): 'CREDIT' | 'DEBIT' | null {
  const lower = text.toLowerCase();
  if (lower.includes('débito') || lower.includes('debit')) return 'DEBIT';
  if (lower.includes('crédito') || lower.includes('credit')) return 'CREDIT';
  return null;
}

function extractDiscountInfo(text: string): { value: number; type: string } {
  // Patrón: "20%", "6 CSI", "$500", "20% de bonificación"
  const pctMatch = text.match(/(\d+)%/);
  if (pctMatch) {
    const hasBonif = /bonif/i.test(text);
    return {
      value: parseInt(pctMatch[1], 10),
      type: hasBonif ? 'PERCENTAGE_BONIFICACION' : 'PERCENTAGE_REINTEGRO',
    };
  }

 const csiMatch = text.match(/(\d+)\s*(?:CSI|cuotas?\s+sin\s+inter[eé]s)/i);
if (csiMatch) {
  return { value: parseInt(csiMatch[1], 10), type: 'INSTALLMENTS' };
}

  const fixedMatch = text.match(/\$\s*(\d+(?:\.\d{3})*)/);
  if (fixedMatch) {
    const amount = parseInt(fixedMatch[1].replace(/\./g, ''), 10);
    return { value: amount, type: 'FIXED_REINTEGRO' };
  }

  return { value: 0, type: 'PERCENTAGE_REINTEGRO' };
}

// ─── Scrapear HTML de promo individual ────────────────────────────────────────
interface PromoDetails {
  banks: Array<{name: string, bcraCode?: string}>;
  paymentChannel: 'QR' | 'NFC' | 'DINERO_EN_CUENTA' | 'TARJETA_FISICA' | 'ANY';
}

async function fetchPromoDetails(promoUrl: string): Promise<PromoDetails | null> {
  try {
    const { data: html } = await axios.get(promoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      timeout: 10000,
    });

    const details: PromoDetails = {
      banks: [],
      paymentChannel: 'ANY',
    };

    // Extraer bancos con códigos BCRA del JSON embebido
    const bankData: Array<{name: string, bcraCode?: string}> = [];
    
    const nameBankMatches = Array.from(html.matchAll(/"name_bank\\?":\\?"([^"\\]+)\\?"/g));
    const bcraCodeMatches = Array.from(html.matchAll(/"bcra_code\\?"?:?\\?"?(\d{4,5})\\?"?/g));
    
    if (nameBankMatches.length > 0 && nameBankMatches.length === bcraCodeMatches.length) {
      for (let i = 0; i < nameBankMatches.length; i++) {
        const bankName = nameBankMatches[i][1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
        const bcraCode = bcraCodeMatches[i][1].padStart(4, '0');
        const exists = bankData.find(b => b.name === bankName && b.bcraCode === bcraCode);
        if (!exists && bankName) {
          bankData.push({ name: bankName, bcraCode });
        }
      }
    } else if (nameBankMatches.length === 0 && bcraCodeMatches.length > 0) {
      for (const match of bcraCodeMatches) {
        const bcraCode = match[1].padStart(4, '0');
        const exists = bankData.find(b => b.bcraCode === bcraCode);
        if (!exists) {
          bankData.push({ name: '', bcraCode });
        }
      }
    } else if (nameBankMatches.length > 0 && bcraCodeMatches.length === 0) {
      for (const match of nameBankMatches) {
        const bankName = match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
        const exists = bankData.find(b => b.name === bankName);
        if (!exists && bankName) {
          bankData.push({ name: bankName });
        }
      }
    }

    details.banks = bankData;

    // Extraer método de pago
    const lowerHtml = html.toLowerCase();
    
    if (lowerHtml.includes('dinero en cuenta') || lowerHtml.includes('dinero de la cuenta')) {
      details.paymentChannel = 'DINERO_EN_CUENTA';
    } else if (lowerHtml.includes('pagando con qr') || lowerHtml.includes('escaneando') || 
               lowerHtml.includes('presencial qr') || lowerHtml.includes('"payment_flow":"trip"')) {
      details.paymentChannel = 'QR';
    } else if (lowerHtml.includes('sin contacto') || lowerHtml.includes('nfc') || 
               lowerHtml.includes('contactless')) {
      details.paymentChannel = 'NFC';
    } else if (lowerHtml.includes('tarjeta física') || lowerHtml.includes('con tarjeta')) {
      details.paymentChannel = 'TARJETA_FISICA';
    }

    return details;
  } catch (error) {
    console.error(`[MODO] Error fetching details for ${promoUrl}:`, error);
    return null;
  }
}

// ─── Scraper principal ─────────────────────────────────────────────────────────

async function run(categoriaFiltro?: string): Promise<ScrapedPromo[]> {
  console.log('[MODO] Obteniendo lista de promos desde la API...');
  
  const activeCategories = categoriaFiltro
    ? Object.keys(MODO_CATEGORIES).filter(cat => 
        cat.toLowerCase() === categoriaFiltro.toLowerCase()
      )
    : Object.keys(MODO_CATEGORIES);

console.log('[MODO DEBUG] categoriaFiltro recibido:', categoriaFiltro);
console.log('[MODO DEBUG] activeCategories:', activeCategories);

  if (activeCategories.length === 0) {
    console.warn(`[MODO] Categoría no reconocida: "${categoriaFiltro}"`);
    return [];
  }

  console.log('[MODO] Categorías activas:', activeCategories);

  const allCards: ModoCard[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const categoryIds = activeCategories.map(cat => MODO_CATEGORIES[cat].id).join(',');
    const url = `${SLOTS_API}?slots=${SLOTS}&banks=&user_id=&categories=${categoryIds}&page=${page}`;
    console.log(`[MODO] Request URL: ${url.substring(0, 200)}...`);

    try {
      const { data } = await axios.get<ModoApiResponse>(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000,
      });

      const cards = data?.data?.cards || [];
      allCards.push(...cards);

      totalPages = data?.metadata?.pagination?.total_pages || 1;
      const pageResults = data?.metadata?.pagination?.page_results || cards.length;
      
      console.log(`[MODO] Página ${page}/${totalPages} — ${pageResults} promos — Total acumuladas: ${allCards.length}`);
      page++;
    } catch (error: any) {
      console.error(`[MODO] Error fetching page ${page}:`, error.message);
      break;
    }
  } while (page <= totalPages);

  console.log(`[MODO] Total promos recibidas: ${allCards.length}`);

  // Filtrar por categorías activas
  const promosWithCategory: ScrapedPromo[] = [];

  for (const catName of activeCategories) {
    const { keywords } = MODO_CATEGORIES[catName];
    console.log(`[MODO] Keywords para ${catName}:`, keywords);

    for (const card of allCards) {
      const fullText = [
        card.title,
        card.short_description,
        card.where,
        card.content?.row?.map(r => r.text).join(' '),
        card.search_tags,
      ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const hasKeyword = keywords.some(kw => fullText.includes(kw));

      if (hasKeyword) {
        // Scraping de detalles del HTML
        const promoUrl = `${PROMO_BASE_URL}/${card.slug}`;
        const htmlDetails = await fetchPromoDetails(promoUrl);
        
        const allBanks = htmlDetails?.banks || [];

        const conditionsText = card.content?.row?.map(r => r.text).filter(Boolean).join(' | ') || '';
        const discountInfo = extractDiscountInfo(card.title + ' ' + card.short_description);

        let cap: number | null = null;
        const capMatch = conditionsText.match(/tope[:\s]+\$?\s*(\d{1,3}(?:\.\d{3})*)/i);
        if (capMatch) {
          cap = parseInt(capMatch[1].replace(/\./g, ''), 10);
        }

        let capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null = null;
        if (/diario|día|por día/i.test(conditionsText)) capPeriod = 'DAILY';
        else if (/semanal|semana|por semana/i.test(conditionsText)) capPeriod = 'WEEKLY';
        else if (/mensual|mes|por mes/i.test(conditionsText)) capPeriod = 'MONTHLY';

        const capTarget = cap ? 'USER' : null;

        let minPurchase: number | null = null;
        const minMatch = conditionsText.match(/mínimo[:\s]+\$?\s*(\d{1,3}(?:\.\d{3})*)/i);
        if (minMatch) {
          minPurchase = parseInt(minMatch[1].replace(/\./g, ''), 10);
        }

        let stackable: boolean | null = null;
        let singleUse = false;
        if (/no\s+(?:es\s+)?acumulable/i.test(conditionsText)) stackable = false;
        else if (/(?:es\s+)?acumulable/i.test(conditionsText)) stackable = true;
        if (/uso\s+[úu]nico/i.test(conditionsText)) singleUse = true;

        const validFrom = card.start_date ? new Date(card.start_date) : new Date();
        let validUntil: Date | null = null;
        if (card.stop_date) {
          const stopDate = new Date(card.stop_date);
          if (!isNaN(stopDate.getTime())) {
            validUntil = stopDate;
          }
        }

        const validDays = parseDaysOfWeek(card.days_of_week);

        let paymentChannel: 'QR' | 'NFC' | 'DINERO_EN_CUENTA' | 'TARJETA_FISICA' | 'ANY' = htmlDetails?.paymentChannel || 'ANY';

        const promo: ScrapedPromo = {
          title: card.title.trim(),
          description: card.content?.row?.map(r => r.text).filter(Boolean).join(' · ') || card.title,
          sourceText: conditionsText,
          sourceUrl: promoUrl,
          discount: String(discountInfo.value),
          discountType: discountInfo.type,
          cap,
          capPeriod: capPeriod ?? (cap ? 'MONTHLY' : undefined),
          capTarget,
          minPurchase,
          stackable,
          singleUse,
          validFrom,
          validUntil,
          specificDates: undefined,
          validDays,
          bankNames: allBanks.length > 0 ? allBanks : undefined,
          walletNames: ['MODO'],
          cardNetworkName: extractCardNetwork(fullText) || undefined,
          cardType: extractCardType(fullText),
          paymentChannel,
          accountType: 'ANY',
          storeName: card.where?.trim() || 'MODO',
          categoria: catName,
        };

        promosWithCategory.push(promo);
      }
    }
  }

  console.log(`[MODO Scraper] ${promosWithCategory.length} promos procesadas`);
  return promosWithCategory;
}

export const ModoScraper: Scraper = {
  name: 'MODO',
  run,
};

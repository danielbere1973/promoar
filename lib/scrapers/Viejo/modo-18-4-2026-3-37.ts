// MODO Scraper V3 con extracción de redes de tarjeta + TIPO (Crédito/Débito)
// FIX: Matching de bancos usando codigoModo + American Express + Card Type

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

async function fetchAllPromos(categoria?: string): Promise<ModoCard[]> {
  const all: ModoCard[] = [];
  let page = 1;
  let totalPages = 1;

  // Mapear categoría a ID de categoría en la API de MODO
  const categoryIdMap: Record<string, string> = {
    'Supermercados': '1',
    'Gastronomia': '2',
    'Indumentaria': '3',
    'Farmacias': '4',
    'Combustible': '5',
    'Tecnologia': '10',
    'Petshops': '12',
    'Transporte': '',  // ← No tiene categoría, usar search_text
  };

  const categoryId = categoria ? (categoryIdMap[categoria] || '') : '';

  while (page <= totalPages) {
    const params = new URLSearchParams({
      slots: SLOTS,
      banks: '',
      user_bank_ids: '',
      limit: '10',
      page: String(page),
      search_text: '',
      source: 'web_modo',
      origin: 'web_modo',
      fcalcstatus: 'running',
      fdoweeks: '',
      fflow: '',
      slot_info: 'true',
      categories: categoryId,
    });

    console.log(`[MODO] Request URL: ${SLOTS_API}?${params.toString().slice(0, 200)}...`);
    if (categoryId) {
      console.log(`[MODO] categories="${categoryId}" (usando ID de categoría)`);
    }

    const { data } = await axios.get<ModoApiResponse>(
      `${SLOTS_API}?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.modo.com.ar/promos',
          'Accept-Language': 'es-AR,es;q=0.9',
        },
        timeout: 15000,
      }
    );

    const cards = data?.data?.cards ?? [];
    all.push(...cards);
    totalPages = data.metadata?.pagination?.total_pages ?? 1;
    console.log(`[MODO] Página ${page}/${totalPages} — ${cards.length} promos — Total acumuladas: ${all.length}`);
    page++;
    if (page <= totalPages && page <= 10) await new Promise(r => setTimeout(r, 500));
  }

  return all;
}

// ─── Scrapear HTML de promo individual ────────────────────────────────────────
interface CardNetworkWithType {
  network: string;
  type: 'CREDIT' | 'DEBIT' | null;
}

interface PromoDetails {
  banks: Array<{ name: string, bcraCode?: string }>;
  paymentChannel: 'QR' | 'NFC' | 'DINERO_EN_CUENTA' | 'TARJETA_FISICA' | 'ANY';
  cardNetworks: CardNetworkWithType[];
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

    console.log(`[MODO HTML] Fetched ${promoUrl}, HTML length: ${html.length}`);

    const details: PromoDetails = {
      banks: [],
      paymentChannel: 'ANY',
      cardNetworks: [],
    };

    // ── Extraer bancos ─────────────────────────────────────────────────────────
    const bankData: Array<{ name: string, bcraCode?: string }> = [];

    // FIX: Extraer el array "banks" del JSON embebido
    // Formato: "banks":[{"id":"...","name":"ICBC","bcra_code":"0015",...}]
    const banksArrayMatch = html.match(/"banks":\s*\[(.*?)\]/s);
    
    if (banksArrayMatch) {
      const banksJson = banksArrayMatch[0];
      console.log(`[MODO HTML] Encontrado array banks, length: ${banksJson.length}`);
      
      // Extraer name y bcra_code del array
      const nameMatches = Array.from(banksJson.matchAll(/"name\\?":\\?"([^"\\]+)\\?"/g));
      const bcraMatches = Array.from(banksJson.matchAll(/"bcra_code\\?"?:?\\?"?(\d{4,5})\\?"?/g));
      
      console.log(`[MODO HTML] En banks: ${nameMatches.length} names, ${bcraMatches.length} bcra_codes`);
      
      if (nameMatches.length > 0 && nameMatches.length === bcraMatches.length) {
        for (let i = 0; i < nameMatches.length; i++) {
          const bankName = nameMatches[i][1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
          const bcraCode = bcraMatches[i][1];
          if (bankName) {
            bankData.push({ name: bankName, bcraCode });
            console.log(`[MODO HTML] ✅ Banco: ${bankName} (BCRA: ${bcraCode})`);
          }
        }
      } else if (bcraMatches.length > 0) {
        for (const match of bcraMatches) {
          const bcraCode = match[1];
          bankData.push({ name: '', bcraCode });
          console.log(`[MODO HTML] ✅ Código BCRA solo: ${bcraCode}`);
        }
      }
    } else {
      console.log(`[MODO HTML] ⚠️  No se encontró array "banks" en el HTML`);
    }

    console.log(`[MODO HTML] Total bancos extraídos: ${bankData.length}`);
    details.banks = bankData;


    // ── Extraer redes de tarjeta desde paymentMethodListWithTags ──────────────
    const paymentMethodMatch = html.match(/\\"paymentMethodListWithTags\\":\s*(\[[\s\S]*?\]),\\"promotion\\"/)
    console.log(`[MODO HTML DEBUG] paymentMethodListWithTags encontrado: ${!!paymentMethodMatch}`);

    if (!paymentMethodMatch) {
      // Buscar si existe con otro formato
      const altMatch = html.match(/paymentMethodListWithTags/);
      console.log(`[MODO HTML DEBUG] Existe "paymentMethodListWithTags" en el HTML: ${!!altMatch}`);
      if (altMatch) {
        const idx = html.indexOf('paymentMethodListWithTags');
        const snippet = html.substring(Math.max(0, idx - 50), idx + 200);
        console.log(`[MODO HTML DEBUG] Snippet: ${snippet}`);
      }
    }

    if (paymentMethodMatch) {
      try {
        // Limpiar escapes: \" → "
        let jsonStr = paymentMethodMatch[1].replace(/\\"/g, '"');

        console.log(`[MODO HTML DEBUG] JSON limpio (primeros 200 chars): ${jsonStr.substring(0, 200)}`);

        const methods = JSON.parse(jsonStr);
        const networksMap = new Map<string, CardNetworkWithType>();

        for (const method of methods) {
          const name = method.name?.toLowerCase();
          const tags = method.tags || [];
          
          // Determinar tipo de tarjeta
          let cardType: 'CREDIT' | 'DEBIT' | null = null;
          if (tags.some((t: string) => t.toLowerCase() === 'crédito' || t.toLowerCase() === 'credito')) {
            cardType = 'CREDIT';
          } else if (tags.some((t: string) => t.toLowerCase() === 'débito' || t.toLowerCase() === 'debito')) {
            cardType = 'DEBIT';
          }

          // Determinar red
          let network: string | null = null;
          if (name === 'visa') network = 'Visa';
          else if (name === 'master' || name === 'mastercard') network = 'Mastercard';
          else if (name === 'amex' || name === 'american express') network = 'American Express';
          else if (name === 'cabal') network = 'Cabal';
          else if (name === 'maestro') network = 'Maestro';
          else if (name === 'diners') network = 'Diners';

          if (network) {
            // Crear clave única: "Visa_CREDIT", "Visa_DEBIT", "Visa_null"
            const key = `${network}_${cardType}`;
            if (!networksMap.has(key)) {
              networksMap.set(key, { network, type: cardType });
            }
          }
        }

        details.cardNetworks = Array.from(networksMap.values());
        if (details.cardNetworks.length > 0) {
          const summary = details.cardNetworks.map(cn => 
            `${cn.network}${cn.type ? ' ' + cn.type : ''}`
          ).join(', ');
          console.log(`[MODO HTML] ✅ Redes extraídas: ${summary}`);
        }
      } catch (err) {
        console.error(`[MODO HTML] ❌ Error parseando paymentMethodListWithTags:`, err);
      }
    }

    if (details.cardNetworks.length === 0) {
      console.log(`[MODO HTML] ⚠️  Sin redes en JSON, usando fallback`);
    }

    // ── Extraer método de pago ─────────────────────────────────────────────────
    const lowerHtml = html.toLowerCase();

    if (lowerHtml.includes('dinero en cuenta') || lowerHtml.includes('dinero de la cuenta')) {
      details.paymentChannel = 'DINERO_EN_CUENTA';
      console.log(`[MODO HTML] ✅ Método de pago (fallback): DINERO_EN_CUENTA`);
    } else if (lowerHtml.includes('pagando con qr') || lowerHtml.includes('escaneando') ||
      lowerHtml.includes('presencial qr') || lowerHtml.includes('"payment_flow":"trip"')) {
      details.paymentChannel = 'QR';
      console.log(`[MODO HTML] ✅ Método de pago: QR`);
    } else if (lowerHtml.includes('sin contacto') || lowerHtml.includes('nfc') ||
      lowerHtml.includes('contactless')) {
      details.paymentChannel = 'NFC';
      console.log(`[MODO HTML] ✅ Método de pago: NFC`);
    } else if (lowerHtml.includes('tarjeta física') || lowerHtml.includes('con tarjeta')) {
      details.paymentChannel = 'TARJETA_FISICA';
      console.log(`[MODO HTML] ✅ Método de pago: TARJETA_FISICA`);
    }

    return details;
  } catch (error) {
    console.error(`[MODO] Error fetching details for ${promoUrl}:`, error);
    return null;
  }
}

function extractDiscountFromCard(card: ModoCard): Array<{ value: number; type: string }> {
  const discounts: Array<{ value: number; type: string }> = [];
  
  const sources = [
    card.content?.row?.[1]?.text ?? '',
    card.title,
    card.short_description,
    card.search_tags,
  ].filter(Boolean); // ← FILTRAR nulls/undefined
  
  for (const text of sources) {
    if (!text || typeof text !== 'string') continue; // ← VALIDACIÓN EXTRA
    
    // Buscar porcentajes
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const value = parseFloat(pctMatch[1]);
      const type = /reintegro|cashback|devoluc|extra|adicional/i.test(text)
        ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      discounts.push({ value, type });
    }
    
    // Buscar cuotas (expandido para detectar CSI)
    const cuotasMatch = text.match(/(\d+)\s*(?:cuotas?\s+sin\s+inter[eé]s|CSI)/i);
    if (cuotasMatch) {
      discounts.push({ value: parseInt(cuotasMatch[1]), type: 'CUOTAS_SIN_INTERES' });
    }
    
    // Si ya encontramos ambos tipos de descuento, no seguir buscando
    const hasPercentage = discounts.some(d => d.type.includes('PERCENTAGE'));
    const hasCuotas = discounts.some(d => d.type === 'CUOTAS_SIN_INTERES');
    if (hasPercentage && hasCuotas) break;
  }
  
  return discounts;
}

// ─── Scraper principal ─────────────────────────────────────────────────────────

export const ModoScraper: Scraper = {
  name: 'MODO',

  async run(categoria?: string): Promise<ScrapedPromo[]> {
    console.log('[MODO] Obteniendo lista de promos desde la API...');
    const cards = await fetchAllPromos(categoria);
    console.log(`[MODO] Total promos recibidas: ${cards.length}`);

    if (cards.length === 0) return [];

    // ── Filtro por categorías ──────────────────────────────────────────────────
    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      Combustible: ['combustible', 'nafta', 'shell', 'ypf', 'axion', 'puma', 'surtidor'],
      Supermercados: ['supermercado', 'super', 'hiper', 'coto', 'carrefour', 'dia ', 'changomas', 'walmart', 'jumbo', 'disco', 'vea', 'diarco', 'maxi'],
      Tecnologia: ['fravega', 'tecnologia', 'tecnología', 'electronica', 'electrónica', 'computacion', 'computación', 'celular', 'garbarino', 'frávega', 'musimundo', 'megatone', 'rodo', 'ipoint', 'garmin'],
      Petshops: ['petshop', 'pet shop', 'mascota', 'veterinaria', 'petshops'],
      Gastronomia: ['gastronomia', 'gastronomia', 'restaurant', 'restaurante', 'delivery', 'rappi', 'pedidosya', 'mcdonald', 'freddo', 'starbucks'],
      Transporte: ['transporte', 'uber', 'cabify', 'telepase', 'peaje', 'subte', 'taxi'],
      Farmacias: ['farmacia', 'farmacias', 'drogueria', 'droguerias', 'farmacity'],
      Indumentaria: ['indumentaria', 'ropa', 'calzado', 'zapatillas', 'deportes', 'vestimenta', 'moda', 'equus', 'swarovski', 'nike', 'adidas', 'puma', 'zara', 'h&m'],
    };

    const activeCategories = categoria
      ? { [categoria]: CATEGORY_KEYWORDS[categoria] ?? [] }
      : CATEGORY_KEYWORDS;

    console.log(`[MODO] Categorías activas: [`, Object.keys(activeCategories).join(', '), `]`);
    if (categoria && CATEGORY_KEYWORDS[categoria]) {
      console.log(`[MODO] Keywords para ${categoria}:`, CATEGORY_KEYWORDS[categoria]);
    }

    const norm = (s: string) => (s ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const filteredCards = cards.filter(card => {
      const text = norm((card.search_tags ?? '') + ' ' + (card.where ?? '') + ' ' + card.title);
      return Object.values(activeCategories).some(keywords =>
        keywords.some(k => text.includes(norm(k)))
      );
    });

    console.log(`[MODO] Promos después de filtrar (${categoria}): ${filteredCards.length}/${cards.length}`);

    const promos: ScrapedPromo[] = [];

    for (let i = 0; i < filteredCards.length; i++) {
      const card = filteredCards[i];
      console.log(`[MODO] ${i + 1}/${filteredCards.length}: ${card.slug}`);

      const discountInfoArray = extractDiscountFromCard(card);
      if (discountInfoArray.length === 0) {
        console.log(`[MODO] ⚠️  Sin descuento, saltando promo`);
        continue;
      }

      console.log(`[MODO DEBUG] ${card.slug} → descuentos encontrados: ${discountInfoArray.length}`, discountInfoArray);

      const validFrom = card.start_date ? new Date(card.start_date) : new Date();
      const validUntil = card.stop_date ? new Date(card.stop_date) : null;
      const validDays = parseDaysOfWeek(card.days_of_week);
      const conditionsText = card.content?.row?.map(r => r.text).filter(Boolean).join(' | ') || '';

      // ── Fetch detalles del HTML ───────────────────────────────────────────────
      const promoUrl = `${PROMO_BASE_URL}/${card.slug}`;
      const htmlDetails = await fetchPromoDetails(promoUrl);
      await new Promise(r => setTimeout(r, 300));

      const allBanks = htmlDetails?.banks || [];
      const cardNetworks = htmlDetails?.cardNetworks || [];

      // ── Extraer cap, minPurchase, etc ─────────────────────────────────────────
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
      if (/no\s+(?:es\s+)?acumulable/i.test(conditionsText)) stackable = false;
      else if (/(?:es\s+)?acumulable/i.test(conditionsText)) stackable = true;

      const paymentChannel = htmlDetails?.paymentChannel || 'ANY';

      // ── Crear una promo por cada descuento encontrado ─────────────────────────
      for (const discountInfo of discountInfoArray) {
        // ── PUNTO 6: Extraer storeName del title si dice "Consultar Locales Adheridos" ───
        let storeName = card.where?.trim() || 'MODO';
        if (storeName.toLowerCase().includes('consultar') || storeName.toLowerCase().includes('adheridos')) {
          // Extraer del title: "10% en Carrefour" → "Carrefour"
          const match = card.title.match(/\ben\s+([A-Za-zÁ-ÿ\s&]+?)(?:\s|$)/i);
          if (match && match[1]) {
            storeName = match[1].trim();
          }
        }

        // ── PUNTO 5: Limpiar fechas de la descripción ───────────────────────────
        let description = card.content?.row?.map(r => r.text).filter(Boolean).join(' · ') || card.title;
        // Remover patrones de fecha: "Desde el 01/01 al 31/03", "Del 01/01 al 31/03", etc.
        description = description.replace(/\b(?:Desde|Del)\s+el\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:al|hasta)\s+(?:el\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '');
        // Limpiar múltiples espacios y separadores
        description = description.replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();

        const promo: ScrapedPromo = {
          title: card.title.trim(),
          description,
          sourceText: conditionsText,
          sourceUrl: promoUrl,
          discount: String(discountInfo.value),
          discountType: discountInfo.type,
          cap,
          capPeriod: capPeriod ?? (cap ? 'MONTHLY' : undefined),
          capTarget,
          minPurchase,
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
          paymentChannel,
          accountType: 'ANY',
          storeName,
          categoria,
        };

        promos.push(promo);
      }
    }

    console.log(`[MODO Scraper V3] ${promos.length} promos procesadas`);
    return promos;
  },
};

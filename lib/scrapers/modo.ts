// MODO Scraper V3 con extracción de redes de tarjeta + TIPO (Crédito/Débito)
// FIX: Matching de bancos usando codigoModo + American Express + Card Type
// FIX: storeName desde descripción cuando el título dice "Consultá los locales adheridos"

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

  const categoryIdMap: Record<string, string> = {
    'Supermercados':     '1',
    'Gastronomía':       '2',
    'Indumentaria':      '3',
    'Farmacias':         '4',
    'Combustible':       '5',
    'Tecnología':        '10',
    'Mascotas':          '12',
    'Transporte':        '',
    'Viajes y Turismo':  '',
    'Deportes':          '',
    'Hogar':             '',
    'Entretenimiento':   '',
    'Salud y Belleza':   '',
    'Heladerías':        '',
    'Jugueterías':       '',
    'Librerías':         '',
    'Shoppings':         '',
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
    // El HTML de MODO tiene el JSON escapado: \"banks\":[{\"name\":\"Banco Nación\",...}]
    const bankData: Array<{ name: string, bcraCode?: string }> = [];

    const banksArrayMatch = html.match(/\\"banks\\":\s*(\[[\s\S]*?\])/);

    if (banksArrayMatch) {
      try {
        // Limpiar escapes: \" → "
        const jsonStr = banksArrayMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        console.log(`[MODO HTML] Banks JSON limpio (primeros 200): ${jsonStr.substring(0, 200)}`);

        const banksArray = JSON.parse(jsonStr);
        for (const bank of banksArray) {
          if (bank.name && bank.bcra_code) {
            bankData.push({ name: bank.name, bcraCode: bank.bcra_code });
            console.log(`[MODO HTML] ✅ Banco: ${bank.name} (BCRA: ${bank.bcra_code})`);
          }
        }
      } catch (err) {
        console.error(`[MODO HTML] ❌ Error parseando banks:`, err);
      }
    } else {
      console.log(`[MODO HTML] ⚠️  No se encontró array "banks" en el HTML`);
    }

    console.log(`[MODO HTML] Total bancos extraídos: ${bankData.length}`);
    details.banks = bankData;

    // ── Extraer redes de tarjeta ───────────────────────────────────────────────
    const paymentMethodMatch = html.match(/\\"paymentMethodListWithTags\\":\s*(\[[\s\S]*?\]),\\"promotion\\"/)
    console.log(`[MODO HTML DEBUG] paymentMethodListWithTags encontrado: ${!!paymentMethodMatch}`);

    if (!paymentMethodMatch) {
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
        let jsonStr = paymentMethodMatch[1].replace(/\\"/g, '"');
        console.log(`[MODO HTML DEBUG] JSON limpio (primeros 200 chars): ${jsonStr.substring(0, 200)}`);

        const methods = JSON.parse(jsonStr);
        const networksMap = new Map<string, CardNetworkWithType>();

        for (const method of methods) {
          const name = method.name?.toLowerCase();
          const tags = method.tags || [];
          
          let cardType: 'CREDIT' | 'DEBIT' | null = null;
          if (tags.some((t: string) => t.toLowerCase() === 'crédito' || t.toLowerCase() === 'credito')) {
            cardType = 'CREDIT';
          } else if (tags.some((t: string) => t.toLowerCase() === 'débito' || t.toLowerCase() === 'debito')) {
            cardType = 'DEBIT';
          }

          let network: string | null = null;
          if (name === 'visa') network = 'Visa';
          else if (name === 'master' || name === 'mastercard') network = 'Mastercard';
          else if (name === 'amex' || name === 'american express') network = 'American Express';
          else if (name === 'cabal') network = 'Cabal';
          else if (name === 'maestro') network = 'Maestro';
          else if (name === 'diners') network = 'Diners';

          if (network) {
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
  const raw: Array<{ value: number; type: string }> = [];

  const sources = [
    card.content?.row?.[1]?.text ?? '',
    card.title,
    card.short_description,
    card.search_tags,
  ].filter(Boolean);

  for (const text of sources) {
    if (!text || typeof text !== 'string') continue;

    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const value = parseFloat(pctMatch[1]);
      const type = /reintegro|cashback|devoluc|extra|adicional/i.test(text)
        ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      raw.push({ value, type });
    }

    const cuotasMatch = text.match(/(\d+)\s*(?:cuotas?\s+sin\s+inter[eé]s|CSI)/i);
    if (cuotasMatch) {
      raw.push({ value: parseInt(cuotasMatch[1]), type: 'CUOTAS_SIN_INTERES' });
    }
  }

  // ── Deduplicar ────────────────────────────────────────────────────────────────
  // Para cada valor de %, si hay conflicto REINTEGRO vs DESCUENTO → REINTEGRO gana.
  // CUOTAS_SIN_INTERES es independiente y se deduplica por separado.
  const pctMap = new Map<number, string>(); // value → type
  const cuotasSet = new Set<number>();
  const result: Array<{ value: number; type: string }> = [];

  for (const d of raw) {
    if (d.type === 'CUOTAS_SIN_INTERES') {
      if (!cuotasSet.has(d.value)) {
        cuotasSet.add(d.value);
        result.push(d);
      }
      continue;
    }
    // Porcentaje: REINTEGRO tiene prioridad sobre DESCUENTO
    if (!pctMap.has(d.value)) {
      pctMap.set(d.value, d.type);
    } else if (d.type === 'PERCENTAGE_REINTEGRO') {
      pctMap.set(d.value, 'PERCENTAGE_REINTEGRO');
    }
  }

  for (const [value, type] of pctMap) {
    result.push({ value, type });
  }

  return result;
}


// ── FIX: Extraer storeName correctamente ──────────────────────────────────────
// Cuando MODO pone "Consultá los locales adheridos" en card.where,
// el nombre real del comercio está en la descripción (primer segmento antes del ·)
function extractStoreName(card: ModoCard): string {
  const where = card.where?.trim() || '';
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const whereNorm = norm(where);

  const isGeneric =
    whereNorm.includes('consultar') ||
    whereNorm.includes('adheridos') ||
    whereNorm.includes('locales') ||
    whereNorm.includes('tienda online') ||
    where === '';

  if (!isGeneric) {
    // card.where tiene un nombre de comercio real
    return where;
  }

  // Intentar extraer del título: "20% en Animalia" → "Animalia"
  const titleMatch = card.title.match(/\ben\s+([A-Za-zÁ-ÿ\s&,]+?)(?:\s*[·\-\d%]|$)/i);
  if (titleMatch?.[1]?.trim()) {
    const name = titleMatch[1].trim();
    console.log(`[MODO] storeName desde título: "${name}"`);
    return name;
  }

  // Intentar extraer del primer segmento de la descripción: "Animalia · 20% de reintegro..."
  const descRows = card.content?.row?.map(r => r.text).filter(Boolean) || [];
  const descText = descRows.join(' ');
  const descMatch = descText.match(/^([^·\-\d%·\n]{3,40}?)(?:\s*·|\s*-|\s*\d)/);
  if (descMatch?.[1]?.trim()) {
    const name = descMatch[1].trim();
    console.log(`[MODO] storeName desde descripción: "${name}"`);
    return name;
  }

  // Fallback
  console.log(`[MODO] storeName no encontrado, usando "MODO"`);
  return 'MODO';
}

// ─── Scraper principal ─────────────────────────────────────────────────────────
export const ModoScraper: Scraper = {
  name: 'MODO',

  async run(categoria?: string): Promise<ScrapedPromo[]> {
    console.log('[MODO] Obteniendo lista de promos desde la API...');
    const cards = await fetchAllPromos(categoria);
    console.log(`[MODO] Total promos recibidas: ${cards.length}`);

    if (cards.length === 0) return [];

    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      Combustible:        ['combustible', 'nafta', 'shell', 'ypf', 'axion', 'surtidor'],
      Supermercados:      ['supermercado', 'super', 'hiper', 'coto', 'carrefour', 'dia ', 'changomas', 'walmart', 'jumbo', 'disco', 'vea', 'diarco', 'maxi'],
      Farmacias:          ['farmacia', 'drogueria', 'farmacity'],
      'Heladerías':       ['heladeria', 'helados', 'freddo', 'chungo', 'grido', 'volta'],
      'Viajes y Turismo': ['hotel', 'vuelo', 'turismo', 'despegar', 'booking', 'aerolinea'],
      Transporte:         ['uber', 'cabify', 'telepase', 'peaje', 'subte', 'taxi', 'colectivo', 'tren'],
      'Gastronomía':      ['gastronomia', 'restaurant', 'restaurante', 'delivery', 'rappi', 'pedidosya', 'mcdonald', 'starbucks', 'pizza', 'burger'],
      'Tecnología':       ['fravega', 'tecnologia', 'electronica', 'computacion', 'celular', 'garbarino', 'musimundo', 'megatone', 'rodo', 'ipoint'],
      Deportes:           ['bicicleta', 'deporte', 'fitness', 'gym', 'decathlon', 'adidas', 'nike', 'puma', 'reebok'],
      Indumentaria:       ['indumentaria', 'ropa', 'calzado', 'zapatillas', 'moda', 'zara', 'h&m', 'equus'],
      Mascotas:           ['petshop', 'mascota', 'veterinaria', 'zoomundo'],
      Hogar:              ['hogar', 'mueble', 'decoracion', 'colchon', 'easy', 'sodimac'],
      Entretenimiento:    ['cine', 'teatro', 'entradas', 'ticketek'],
      'Salud y Belleza':  ['optica', 'belleza', 'estetica', 'peluqueria', 'spa', 'salud'],
      'Jugueterías':      ['juguete', 'toys'],
      'Librerías':        ['libreria', 'libro'],
      Shoppings:          ['shopping'],
    };

    const activeCategories = categoria
      ? { [categoria]: CATEGORY_KEYWORDS[categoria] ?? [] }
      : CATEGORY_KEYWORDS;

    console.log(`[MODO] Categorías activas: [`, Object.keys(activeCategories).join(', '), `]`);

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

      const promoUrl = `${PROMO_BASE_URL}/${card.slug}`;
      const htmlDetails = await fetchPromoDetails(promoUrl);
      await new Promise(r => setTimeout(r, 300));

      const allBanks = htmlDetails?.banks || [];
      const cardNetworks = htmlDetails?.cardNetworks || [];

      let cap: number | null = null;
      const capMatch = conditionsText.match(/tope[:\s]+\$?\s*(\d{1,3}(?:\.\d{3})*)/i);
      if (capMatch) cap = parseInt(capMatch[1].replace(/\./g, ''), 10);

      let capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null = null;
      if (/diario|día|por día/i.test(conditionsText)) capPeriod = 'DAILY';
      else if (/semanal|semana|por semana/i.test(conditionsText)) capPeriod = 'WEEKLY';
      else if (/mensual|mes|por mes/i.test(conditionsText)) capPeriod = 'MONTHLY';

      const capTarget = cap ? 'USER' : null;

      let minPurchase: number | null = null;
      const minMatch = conditionsText.match(/mínimo[:\s]+\$?\s*(\d{1,3}(?:\.\d{3})*)/i);
      if (minMatch) minPurchase = parseInt(minMatch[1].replace(/\./g, ''), 10);

      let stackable: boolean | null = null;
      if (/no\s+(?:es\s+)?acumulable/i.test(conditionsText)) stackable = false;
      else if (/(?:es\s+)?acumulable/i.test(conditionsText)) stackable = true;

      const paymentChannel = htmlDetails?.paymentChannel || 'ANY';

      // ── FIX: Usar extractStoreName en lugar de lógica inline ──────────────
      const storeName = extractStoreName(card);

      // ── Limpiar descripción ───────────────────────────────────────────────
      let description = card.content?.row?.map(r => r.text).filter(Boolean).join(' · ') || card.title;
      description = description.replace(/\b(?:Desde|Del)\s+el\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+(?:al|hasta)\s+(?:el\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gi, '');
      description = description.replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();

      for (const discountInfo of discountInfoArray) {
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

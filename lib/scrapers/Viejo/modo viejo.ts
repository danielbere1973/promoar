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

  // Fallback a search_text si no hay categoryId
  const searchTextMap: Record<string, string> = {
    'Transporte': 'trans',
    'Supermercados': '',
    'Combustible': '',
    'Tecnologia': '',
    'Petshops': '',
    'Gastronomia': '',
    'Farmacias': '',
    'Indumentaria': '',
  };

  const categoryId = categoria ? (categoryIdMap[categoria] || '') : '';
  const searchText = categoryId === '' && categoria ? (searchTextMap[categoria] || '') : '';

  while (page <= totalPages) {
    const params = new URLSearchParams({
      slots: SLOTS,
      banks: '',
      user_bank_ids: '',
      limit: '10',
      page: String(page),
      search_text: searchText,
      source: 'web_modo',
      origin: 'web_modo',
      fcalcstatus: 'running',  // ← Solo 'running' como la web
      fdoweeks: '',
      fflow: '',
      slot_info: 'true',
      categories: categoryId,  // ← NUEVO: usar ID de categoría
    });

    console.log(`[MODO] Request URL: ${SLOTS_API}?${params.toString().slice(0, 200)}...`);
    if (categoryId) {
      console.log(`[MODO] categories="${categoryId}" (usando ID de categoría)`);
    } else if (searchText) {
      console.log(`[MODO] search_text="${searchText}" (fallback)`);
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
    if (page <= totalPages && page <= 10) await new Promise(r => setTimeout(r, 500));  // Max 10 páginas
  }

  return all;
}

// ─── Scrapear HTML de promo individual ────────────────────────────────────────
interface PromoDetails {
  banks: Array<{name: string, bcraCode?: string}>;
  paymentChannel: 'QR' | 'NFC' | 'DINERO_EN_CUENTA' | 'TARJETA_FISICA' | 'ANY';
  cardNetworks: string[];
  cardType?: 'CREDIT' | 'DEBIT' | 'PREPAID';
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
    
    // Debug: mostrar una muestra del HTML
    const htmlSample = html.substring(0, 500)
    console.log(`[MODO HTML] 📄 Primeros 500 chars del HTML: ${htmlSample}`)

    const details: PromoDetails = {
      banks: [],
      paymentChannel: 'ANY',
      cardNetworks: [],
    };

    // ── Extraer JSON embebido con datos de bancos ─────────────────────────────
    // Next.js embebe los datos en scripts con formato:
    // {"name_bank":"Banco Nación","bcra_code":"0011","image_bank":"..."}
    
    const bankData: Array<{name: string, bcraCode?: string}> = [];
    
    // Extraer todos los name_bank
    const nameBankMatches = Array.from(html.matchAll(/"name_bank\\?":\\?"([^"\\]+)\\?"/g));
    
    // Extraer todos los bcra_code (con o sin comillas, con o sin escapes)
    const bcraCodeMatches = Array.from(
      html.matchAll(/"bcra_code\\?"?:?\\?"?(\d{4,5})\\?"?/g)
    );
    
    console.log(`[MODO HTML] Encontrados ${nameBankMatches.length} name_bank y ${bcraCodeMatches.length} bcra_code`);
    
    // Debug: mostrar algunos bcra_code encontrados
    if (bcraCodeMatches.length > 0) {
      const sampleCodes = bcraCodeMatches.slice(0, 3).map(m => m[1]).join(', ');
      console.log(`[MODO HTML] Códigos BCRA encontrados (muestra): ${sampleCodes}`);
    }
    
    // Caso 1: Mismo número de names y codes → asociar por posición
    if (nameBankMatches.length > 0 && nameBankMatches.length === bcraCodeMatches.length) {
      for (let i = 0; i < nameBankMatches.length; i++) {
        const bankName = nameBankMatches[i][1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .trim();
        
        const bcraCode = bcraCodeMatches[i][1].padStart(4, '0');
        
        // Evitar duplicados
        const exists = bankData.find(b => b.name === bankName && b.bcraCode === bcraCode);
        if (!exists && bankName) {
          bankData.push({ name: bankName, bcraCode });
          
          if (bcraCode) {
            console.log(`[MODO HTML] ✅ Banco: ${bankName} (BCRA: ${bcraCode})`);
          } else {
            console.log(`[MODO HTML] ⚠️  Banco: ${bankName} (sin código BCRA)`);
          }
        }
      }
    }
    // Caso 2: Solo códigos BCRA, sin nombres → usar códigos solos
    else if (nameBankMatches.length === 0 && bcraCodeMatches.length > 0) {
      console.log(`[MODO HTML] ⚠️  Solo códigos BCRA sin nombres, usando códigos`);
      for (const match of bcraCodeMatches) {
        const bcraCode = match[1].padStart(4, '0');
        const exists = bankData.find(b => b.bcraCode === bcraCode);
        if (!exists) {
          bankData.push({ name: '', bcraCode });
          console.log(`[MODO HTML] ✅ Código BCRA solo: ${bcraCode}`);
        }
      }
    }
    // Caso 3: Solo nombres sin códigos → usar nombres solos
    else if (nameBankMatches.length > 0 && bcraCodeMatches.length === 0) {
      for (const match of nameBankMatches) {
        const bankName = match[1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\')
          .trim();
        
        const exists = bankData.find(b => b.name === bankName);
        if (!exists && bankName) {
          bankData.push({ name: bankName });
          console.log(`[MODO HTML] ⚠️  Banco: ${bankName} (sin código BCRA)`);
        }
      }
    }
    
    console.log(`[MODO HTML] Total bancos extraídos: ${bankData.length}`);

    details.banks = bankData;

    // ── Extraer redes y tipos de tarjeta desde paymentMethodListWithTags ─────────
    // MODO embebe un JSON con estructura:
    // "paymentMethodListWithTags":[
    //   {"id":"master_Crédito","name":"master","tags":["Crédito"],...},
    //   {"id":"visa_Crédito_Débito","name":"visa","tags":["Crédito","Débito"],...},
    //   {"id":"pct","name":"Dinero en cuenta","tags":[],...}
    // ]
    
    console.log(`[MODO HTML] 🔍 Buscando paymentMethodListWithTags...`)
    
    // Intentar diferentes formatos de búsqueda
    const searchVariants = [
      '"paymentMethodListWithTags"',
      '\\"paymentMethodListWithTags\\"',
      'paymentMethodListWithTags',
      '&quot;paymentMethodListWithTags&quot;'
    ]
    
    let startIdx = -1
    let foundVariant = ''
    
    for (const variant of searchVariants) {
      startIdx = html.indexOf(variant)
      if (startIdx !== -1) {
        foundVariant = variant
        break
      }
    }
    
    console.log(`[MODO HTML] ${startIdx !== -1 ? `✅ ENCONTRADO con variant: ${foundVariant}` : '❌ NO ENCONTRADO con ningún variant'} en posición: ${startIdx}`)
    
    if (startIdx !== -1) {
      let jsonStr = '' // Declarar fuera para usar en catch
      try {
        // Encontrar el inicio del array
        const arrayStart = html.indexOf('[', startIdx)
        if (arrayStart === -1) throw new Error('No array start found')
        
        // Balancear corchetes para encontrar el final del array
        let depth = 0
        let arrayEnd = arrayStart
        for (let i = arrayStart; i < html.length; i++) {
          if (html[i] === '[') depth++
          if (html[i] === ']') depth--
          if (depth === 0) {
            arrayEnd = i + 1
            break
          }
        }
        
        // Extraer el JSON del array
        jsonStr = html.substring(arrayStart, arrayEnd)
        
        // Limpiar escapes - el HTML viene con \" que necesitamos convertir a "
        // IMPORTANTE: hacerlo en este orden
        jsonStr = jsonStr.replace(/\\"/g, '"')
        
        console.log(`[MODO HTML] JSON extraído (primeros 200 chars): ${jsonStr.substring(0, 200)}`)
        
        const paymentMethods = JSON.parse(jsonStr)
        
        console.log(`[MODO HTML] ✅ Encontrados ${paymentMethods.length} métodos de pago`)
        
        const networks = new Set<string>()
        const cardTypes = new Set<string>()
        let hasDineroCuenta = false
        
        for (const method of paymentMethods) {
          const name = (method.name || '').toLowerCase()
          const tags = method.tags || []
          
          // Detectar "Dinero en cuenta" (pct)
          if (name === 'pct' || name.includes('dinero') || method.id === 'pct') {
            hasDineroCuenta = true
            console.log(`[MODO HTML] ✅ Detectado: Dinero en cuenta (pct)`)
            continue
          }
          
          // Mapear nombre de red
          let networkName = ''
          if (name === 'visa') networkName = 'Visa'
          else if (name === 'master' || name === 'mastercard') networkName = 'Mastercard'
          else if (name === 'amex' || name === 'american express') networkName = 'American Express'
          else if (name === 'cabal') networkName = 'Cabal'
          else if (name === 'naranja') networkName = 'Naranja'
          else if (name === 'maestro') networkName = 'Maestro'
          else if (name === 'diners') networkName = 'Diners'
          else if (name === 'confiable') networkName = 'Confiable'
          else if (name.includes('patagonia')) networkName = 'Patagonia 365'
          
          if (networkName) {
            networks.add(networkName)
            console.log(`[MODO HTML] ✅ Red de tarjeta: ${networkName}`)
            
            // Extraer tipos (Crédito/Débito) de los tags
            for (const tag of tags) {
              const tagLower = tag.toLowerCase()
              if (tagLower.includes('crédit') || tagLower.includes('credit')) {
                cardTypes.add('CREDIT')
              }
              if (tagLower.includes('débit') || tagLower.includes('debit')) {
                cardTypes.add('DEBIT')
              }
            }
          }
        }
        
        // Asignar redes encontradas
        details.cardNetworks = Array.from(networks)
        
        // Asignar tipo de tarjeta (si hay ambos, priorizar CREDIT)
        if (cardTypes.has('CREDIT') && cardTypes.has('DEBIT')) {
          details.cardType = 'CREDIT' // Guardar principal, pero ambos están disponibles
          console.log(`[MODO HTML] ✅ Tipo de tarjeta: CREDIT y DEBIT`)
        } else if (cardTypes.has('CREDIT')) {
          details.cardType = 'CREDIT'
          console.log(`[MODO HTML] ✅ Tipo de tarjeta: CREDIT`)
        } else if (cardTypes.has('DEBIT')) {
          details.cardType = 'DEBIT'
          console.log(`[MODO HTML] ✅ Tipo de tarjeta: DEBIT`)
        }
        
        // Asignar Dinero en Cuenta como canal de pago
        if (hasDineroCuenta) {
          details.paymentChannel = 'DINERO_EN_CUENTA'
          console.log(`[MODO HTML] ✅ Canal de pago: DINERO_EN_CUENTA`)
        }
        
      } catch (err) {
        console.error(`[MODO HTML] ❌ Error parseando paymentMethodListWithTags:`)
        console.error(`[MODO HTML] ❌ Error message:`, err)
        console.error(`[MODO HTML] ❌ Primeros 500 chars del JSON extraído:`, jsonStr?.substring(0, 500))
        // Fallback al método antiguo si falla el parsing
      }
    }
    
    // ── Fallback: Método antiguo si no se encontró paymentMethodListWithTags ────
    if (details.cardNetworks.length === 0) {
      console.log(`[MODO HTML] ⚠️  Usando método fallback para redes de tarjeta`)
      const lowerHtml = html.toLowerCase()
      
      if (lowerHtml.includes('visa') && !lowerHtml.includes('supervielle')) {
        details.cardNetworks.push('Visa')
      }
      if (lowerHtml.includes('mastercard') || lowerHtml.includes('master card')) {
        details.cardNetworks.push('Mastercard')
      }
      if (lowerHtml.includes('american express') || lowerHtml.includes('amex')) {
        details.cardNetworks.push('American Express')
      }
      if (lowerHtml.includes('cabal')) {
        details.cardNetworks.push('Cabal')
      }
    }
    
    // ── Método de pago adicional (QR, NFC, etc.) ──────────────────────────────
    if (details.paymentChannel === 'ANY') {
      const lowerHtml = html.toLowerCase()
      
      if (lowerHtml.includes('dinero en cuenta') || lowerHtml.includes('dinero de la cuenta')) {
        details.paymentChannel = 'DINERO_EN_CUENTA'
        console.log(`[MODO HTML] ✅ Método de pago (fallback): DINERO_EN_CUENTA`)
      } else if (lowerHtml.includes('pagando con qr') || lowerHtml.includes('escaneando') || 
                 lowerHtml.includes('presencial qr') || lowerHtml.includes('"payment_flow":"trip"')) {
        details.paymentChannel = 'QR'
        console.log(`[MODO HTML] ✅ Método de pago: QR`)
      } else if (lowerHtml.includes('sin contacto') || lowerHtml.includes('nfc') || 
                 lowerHtml.includes('contactless')) {
        details.paymentChannel = 'NFC'
        console.log(`[MODO HTML] ✅ Método de pago: NFC`)
      } else if (lowerHtml.includes('tarjeta física') || lowerHtml.includes('con tarjeta')) {
        details.paymentChannel = 'TARJETA_FISICA'
        console.log(`[MODO HTML] ✅ Método de pago: TARJETA_FISICA`)
      }
    }

    return details;
  } catch (error) {
    console.error(`[MODO HTML] ❌ Error fetching HTML for ${promoUrl}:`, error);
    return null;
  }
}

const BANK_KEYWORDS = [
  'banco', 'bbva', 'galicia', 'santander', 'macro', 'icbc', 'ciudad',
  'credicoop', 'hipotecario', 'supervielle', 'comafi', 'patagonia',
  'nacion', 'columbia', 'brubank', 'naranja', 'hsbc', 'itau',
  'santa fe', 'santa cruz', 'entre rios', 'corrientes', 'chaco',
  'tucuman', 'neuquen', 'mendoza', 'salta', 'formosa', 'jujuy',
  'misiones', 'catamarca', 'rioja', 'yoy', 'bsf', 'bsc',
];

const BANK_NAME_MAP: Record<string, string> = {
  'bsf': 'Banco Santa Fe', 'banco santa fe': 'Banco Santa Fe',
  'bsc': 'Banco Santa Cruz', 'banco santa cruz': 'Banco Santa Cruz',
  'yoy': 'YOY', 'bbva': 'BBVA', 'icbc': 'ICBC', 'hsbc': 'HSBC',
  'itau': 'Itaú', 'itaú': 'Itaú',
  'banco macro': 'Macro', 'macro': 'Macro',
  'banco galicia': 'Galicia', 'galicia': 'Galicia',
  'banco santander': 'Santander', 'santander': 'Santander',
  'banco ciudad': 'Ciudad', 'ciudad': 'Ciudad',
  'banco nacion': 'Banco Nación', 'banco nación': 'Banco Nación', 'nacion': 'Banco Nación',
  'banco patagonia': 'Patagonia', 'patagonia': 'Patagonia',
  'banco supervielle': 'Supervielle', 'supervielle': 'Supervielle',
  'banco comafi': 'Comafi', 'comafi': 'Comafi',
  'banco hipotecario': 'Hipotecario', 'hipotecario': 'Hipotecario',
  'banco credicoop': 'Credicoop', 'credicoop': 'Credicoop',
  'banco columbia': 'Columbia', 'columbia': 'Columbia',
  'naranja x': 'Naranja X', 'naranja': 'Naranja X',
  'brubank': 'Brubank', 'buepp': 'Buepp',
};

function normalizeBankName(raw: string): string {
  const key = raw.trim().toLowerCase();
  return BANK_NAME_MAP[key] ?? raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function extractBanksFromTags(searchTags: string): string[] {
  if (!searchTags) return [];
  const tags = searchTags.split(',').map(t => t.trim().toLowerCase());
  const banks: string[] = [];
  for (const tag of tags) {
    if (BANK_KEYWORDS.some(k => tag.includes(k))) {
      const normalized = tag
        .replace(/\bbsf\b/g, 'banco santa fe')
        .replace(/\bbsc\b/g, 'banco santa cruz')
        .replace(/\byoy\b/g, 'yoy')
        .replace(/\bbbva\b/g, 'bbva')
        .replace(/\bicbc\b/g, 'icbc')
        .replace(/\bhsbc\b/g, 'hsbc')
        .replace(/\bitau\b/g, 'itaú');
      const capitalized = normalized.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!banks.includes(capitalized)) banks.push(capitalized);
    }
  }
  return banks;
}

function extractDiscountFromCard(card: ModoCard): { value: number; type: string } | null {
  const sources = [
    card.content?.row?.[1]?.text ?? '',
    card.title,
    card.short_description,
    card.search_tags,
  ];
  for (const text of sources) {
    const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const value = parseFloat(pctMatch[1]);
      const type = /reintegro|cashback|devoluc|extra|adicional/i.test(text)
        ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      return { value, type };
    }
    const cuotasMatch = text.match(/(\d+)\s*cuotas?\s+sin\s+inter[eé]s/i);
    if (cuotasMatch) return { value: parseInt(cuotasMatch[1]), type: 'CUOTAS_SIN_INTERES' };
  }
  return null;
}

function extractCapFromCard(card: ModoCard): number | undefined {
  const capText = card.content?.row?.[4]?.text ?? '';
  const num = parseFloat(capText.replace(/\./g, '').replace(',', '.'));
  if (!isNaN(num) && num > 0) return num;
  const tagMatch = card.search_tags?.match(/tope\s+(\d+)/i);
  if (tagMatch) return parseFloat(tagMatch[1]);
  return undefined;
}

function extractCardType(text: string): string | null {
  const t = text.toUpperCase();
  if (/TARJETAS?\s+DE\s+CR[EÉ]DITO/.test(t)) return 'CREDIT';
  if (/TARJETAS?\s+DE\s+D[EÉ]BITO/.test(t)) return 'DEBIT';
  if (/PREPAGA|PREPAID/.test(t)) return 'PREPAID';
  if (/\bCR[EÉ]DITO\b/.test(t)) return 'CREDIT';
  if (/\bD[EÉ]BITO\b/.test(t)) return 'DEBIT';
  return 'CREDIT';
}

function extractCardNetworks(text: string): string[] {
  const t = text.toUpperCase();
  const networks: string[] = [];
  
  if (/\bVISA\b/.test(t)) networks.push('Visa');
  if (/MASTERCARD/.test(t)) networks.push('Mastercard');
  if (/\bCABAL\b/.test(t)) networks.push('Cabal');
  if (/AMERICAN\s+EXPRESS|\bAMEX\b/.test(t)) networks.push('American Express');
  if (/\bMAESTRO\b/.test(t)) networks.push('Maestro');
  if (/\bDINERS\b/.test(t)) networks.push('Diners');
  if (/\bNARANJA\b/.test(t)) networks.push('Naranja');
  
  return networks;
}

// Devuelve string solo si hay UNA red, null si hay varias o ninguna
function extractCardNetwork(text: string): string | null {
  const networks = extractCardNetworks(text);
  return networks.length === 1 ? networks[0] : null;
}

// ─── extractConditionsFromCard ────────────────────────────────────────────────
// Sin Playwright — usamos los datos que ya vienen de la API
function buildConditionsText(card: ModoCard): string {
  const rows = card.content?.row?.map(r => r.text).filter(Boolean) ?? [];
  return rows.join('\n');
}

export const ModoScraper: Scraper = {
  name: 'MODO',

  async run(categoria?: string): Promise<ScrapedPromo[]> {
    console.log('[MODO] Obteniendo lista de promos desde la API...');
    const cards = await fetchAllPromos(categoria);
    console.log(`[MODO] Total promos recibidas: ${cards.length}`);
    
    // DEBUG: Buscar promos con "transporte" en CUALQUIER campo
    if (categoria === 'Transporte') {
      const transportePromos = cards.filter(card => {
        const allText = [
          card.title,
          card.short_description,
          card.search_tags,
          card.where,
          card.slug,
          ...(card.content?.row?.map(r => r.text) ?? [])
        ].join(' ').toLowerCase();
        return allText.includes('transporte');
      });
      
      console.log(`[MODO DEBUG] Promos con "transporte" encontradas: ${transportePromos.length}`);
      
      if (transportePromos.length > 0) {
        console.log('[MODO DEBUG] Primeras 3 promos con "transporte":');
        transportePromos.slice(0, 3).forEach((card, i) => {
          console.log(`\n[${i + 1}]`, {
            title: card.title,
            search_tags: card.search_tags?.slice(0, 200),
            where: card.where,
            content_rows: card.content?.row?.map(r => r.text.slice(0, 100)),
          });
        });
      }
    }
    
    if (cards.length === 0) return [];

    // ── Filtro por categorías activas ──────────────────────────────────────
    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      Supermercados: ['supermercado', 'super', 'hiper', 'coto', 'carrefour', 'dia ', 'changomas', 'walmart', 'jumbo', 'disco', 'vea', 'diarco', 'maxi'],
      Combustible: ['combustible', 'nafta', 'shell', 'ypf', 'axion', 'puma', 'surtidor'],
      Tecnologia: ['fravega', 'tecnologia', 'tecnología', 'electronica', 'electrónica', 'computacion', 'computación', 'celular', 'garbarino', 'frávega', 'musimundo', 'megatone', 'rodo', 'ipoint', 'garmin', 'electro', 'tecno', 'armytech', 'infinito', 'electromodo', 'oncity', 'ofit', 'newsan', 'samsung', 'apple', 'xiaomi', 'notebook', 'smart', 'tv'],
      Petshops: ['petshop', 'pet shop', 'mascota', 'veterinaria', 'petshops', 'zoocopet', 'puppis', 'petrelfi', 'delivery pet', 'pet food', 'veterinarias'],
      Gastronomia: ['gastronomia', 'gastronomía', 'restaurant', 'restaurante', 'delivery', 'rappi', 'pedidosya', 'mcdonald', 'freddo', 'starbucks'],
      Transporte: ['transporte', 'uber', 'cabify', 'telepase', 'peaje', 'subte', 'taxi', 'colectivo', 'bondi', 'sube', 'tren', 'metrobus', 'movilidad', 'viaje compartido', 'didi', 'beat', 'bna transporte', 'visa transporte', 'garpa transporte', 'promo visa transporte'],
      Farmacias: ['farmacia', 'farmacias', 'drogueria', 'droguerias', 'farmacity'],
      Indumentaria: ['indumentaria', 'calzado', 'moda', 'ropa', 'zapatillas', 'zapatos', 'deportes', 'dexter', 'adidas', 'nike', 'puma', 'reebok', 'topper', 'fila'],
    };

    const EXCLUDE_KEYWORDS = [
      'turismo', 'hotel', 'vuelo', 'italjet',  // ← REMOVIDO 'viajes' porque bloqueaba transporte
      'muebles', 'hogar', 'decoracion',
    ];

    // Si se pasa una categoría específica, filtramos solo esa
    // Normalizamos para evitar problemas de case-sensitivity
    const normalizedCategoria = categoria 
      ? Object.keys(CATEGORY_KEYWORDS).find(k => k.toLowerCase() === categoria.toLowerCase())
      : null;
    
    const activeCategories = normalizedCategoria
      ? { [normalizedCategoria]: CATEGORY_KEYWORDS[normalizedCategoria] ?? [] }
      : CATEGORY_KEYWORDS;

    console.log('[MODO] Categorías activas:', Object.keys(activeCategories));
    if (normalizedCategoria) {
      console.log('[MODO] Keywords para', normalizedCategoria, ':', CATEGORY_KEYWORDS[normalizedCategoria]);
    }

    const norm = (s: string) => (s ?? '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const filteredCards = cards.filter(card => {
      const text = norm((card.search_tags ?? '') + ' ' + (card.where ?? '') + ' ' + card.title);
      const titleText = norm(card.title + ' ' + (card.short_description ?? ''));

      // Log primera promo para debug
      if (cards.indexOf(card) === 0 && normalizedCategoria) {
        console.log('[MODO DEBUG] Primera promo:', {
          title: card.title,
          text_normalizado: text.slice(0, 200),
          tiene_keyword_transporte: text.includes('transporte'),
        });
      }

      if (EXCLUDE_KEYWORDS.some(k => text.includes(norm(k)))) return false;
      
      // ── DESHABILITADO: Ahora incluimos promos de CSI (cuotas sin interés) ──
      // Las CSI son beneficios valiosos para los usuarios
      // const onlyCsi = categoria !== 'Tecnologia' &&
      //   (text.includes('csi') || text.includes('financiacion'))
      //   && !text.includes('%') && !text.includes('reintegro')
      //   && !text.includes('descuento') && !text.includes('off')
      //   && !titleText.includes('%') && !titleText.includes('reintegro')
      //   && !titleText.includes('descuento') && !titleText.includes('off');
      // if (onlyCsi) return false;
      
      // Si la categoría tiene ID en la API (no es Transporte), confiar en el filtro de la API
      // Solo Transporte necesita filtro de keywords porque no tiene categories=X
      const categoriesWithId = ['Supermercados', 'Gastronomia', 'Indumentaria', 'Farmacias', 'Combustible', 'Tecnologia', 'Petshops'];
      if (normalizedCategoria && categoriesWithId.includes(normalizedCategoria)) {
        return true;  // La API ya filtró correctamente con categories=X
      }
      
      const matches = Object.values(activeCategories).some(keywords =>
        keywords.some(k => text.includes(norm(k)))
      );
      
      // Log promos de transporte que NO matchean
      if (normalizedCategoria === 'Transporte' && text.includes('transporte') && !matches) {
        console.log('[MODO DEBUG] Promo con "transporte" que NO matcheó:', {
          title: card.title,
          activeCategories: Object.keys(activeCategories),
        });
      }
      
      return matches;
    });

    console.log(`[MODO] Promos después de filtrar${categoria ? ' (' + categoria + ')' : ''}: ${filteredCards.length}/${cards.length}`);

    // DEBUG: Si es Transporte, loguear las que se filtraron
    if (normalizedCategoria === 'Transporte') {
      const blocked = cards.filter(card => !filteredCards.includes(card));
      console.log(`[MODO DEBUG] Promos de Transporte BLOQUEADAS: ${blocked.length}`);
      blocked.slice(0, 5).forEach(card => {
        console.log(`  ❌ ${card.slug} - "${card.title}"`);
      });
    }

    const promos: ScrapedPromo[] = [];

    for (let i = 0; i < filteredCards.length; i++) {
      const card = filteredCards[i];
      console.log(`[MODO] ${i + 1}/${filteredCards.length}: ${card.slug}`);

      const discountInfo = extractDiscountFromCard(card);
      if (!discountInfo) continue;

      const validFrom = card.start_date ? card.start_date.slice(0, 10) : undefined;
      const validUntil = card.stop_date ? card.stop_date.slice(0, 10) : undefined;
      const validDays = parseDaysOfWeek(card.days_of_week);
      const conditionsText = buildConditionsText(card);

      // ── Fetch detalles del HTML (bancos, método de pago) ─────────────────────
      const promoUrl = `${PROMO_BASE_URL}/${card.slug}`;
      const htmlDetails = await fetchPromoDetails(promoUrl);
      
      // Delay para no saturar el servidor de MODO
      await new Promise(r => setTimeout(r, 300)); // 300ms entre requests
      
      // Usar bancos del HTML si están disponibles, sino usar los del texto
      const banksFromTags = extractBanksFromTags(card.search_tags);
      const banksFromHtml = htmlDetails?.banks || [];
      
      // Si hay bancos del HTML con bcraCode, usarlos
      // Si no, usar los del texto (formato antiguo)
      const allBanks = banksFromHtml.length > 0 
        ? banksFromHtml 
        : banksFromTags.map(name => ({ name: normalizeBankName(name) }));

      // Usar método de pago del HTML si está disponible
      const fullText = card.search_tags + ' ' + conditionsText;
      const hasNFC = /NFC|CONTACTLESS|SIN\s+CONTACTO|APPLE\s+PAY|GOOGLE\s+PAY/.test(fullText.toUpperCase());
      const hasQR = /\bQR\b/.test(fullText.toUpperCase());
      const paymentChannelFromText = hasNFC && !hasQR ? 'NFC' : hasQR && !hasNFC ? 'QR' : 'ANY';
      const paymentChannel = htmlDetails?.paymentChannel && htmlDetails.paymentChannel !== 'ANY' 
        ? htmlDetails.paymentChannel 
        : paymentChannelFromText;

      const cap = extractCapFromCard(card);
      let capPeriod: 'WEEKLY' | 'MONTHLY' | 'DAILY' | undefined;
      let capTarget: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION' | undefined;
      const capMatch = conditionsText.match(/(?:tope|m[aá]ximo)[^$\n]{0,60}\$\s*([\d.,]+)/i);
      if (capMatch) {
        const ctx = capMatch[0].toUpperCase();
        if (/SEMANAL|POR\s+SEMANA/.test(ctx)) capPeriod = 'WEEKLY';
        else if (/MENSUAL|POR\s+MES/.test(ctx)) capPeriod = 'MONTHLY';
        else if (/DIARIO/.test(ctx)) capPeriod = 'DAILY';
        if (/POR\s+TARJETA|POR\s+MARCA/.test(ctx)) capTarget = 'CARD';
        else if (/POR\s+USUARIO|POR\s+PERSONA/.test(ctx)) capTarget = 'USER';
        else if (/POR\s+CUENTA/.test(ctx)) capTarget = 'ACCOUNT';
        else if (/POR\s+PAGO|POR\s+TRANSACCI/.test(ctx)) capTarget = 'TRANSACCION';
      }

      let minPurchase: number | undefined;
      const minMatch = conditionsText.match(/(?:m[ií]nimo\s+de\s+compra|compra\s+m[ií]nima|a\s+partir\s+de)\s*:?\s*\$\s*([\d.,]+)/i);
      if (minMatch) minPurchase = parseFloat(minMatch[1].replace(/\./g, '').replace(',', '.'));

      let stackable: boolean | undefined;
      let singleUse: boolean | undefined;
      if (/no\s+(?:es\s+)?acumulable/i.test(conditionsText)) stackable = false;
      else if (/(?:es\s+)?acumulable/i.test(conditionsText)) stackable = true;
      if (/uso\s+[úu]nico/i.test(conditionsText)) singleUse = true;

      const promo = {
        title: card.title.trim(),
        description: card.content?.row?.map(r => r.text).filter(Boolean).join(' · ') ?? card.title,
        sourceText: conditionsText,
        sourceUrl: `${PROMO_BASE_URL}/${card.slug}`,
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
        // allBanks ahora contiene objetos con {name, bcraCode}
        // El uploader debe manejar ambos formatos para backward compatibility
        bankNames: allBanks.length > 0 ? allBanks : undefined,
        walletNames: ['MODO'],
        cardNetworkName: (htmlDetails?.cardNetworks && htmlDetails.cardNetworks.length === 1) 
          ? htmlDetails.cardNetworks[0] 
          : extractCardNetwork(fullText) || undefined,
        cardType: htmlDetails?.cardType || extractCardType(fullText),
        paymentChannel,
        accountType: 'ANY',
        provinces: ['Todas'],
        storeName: card.where?.trim() || 'MODO',
        categoria: (() => {
          // Map internal key to exact DB category name
          const DB_CAT_MAP: Record<string, string> = {
            'Supermercados': 'Supermercados',
            'Combustible': 'Combustible',
            'Tecnologia': 'Tecnologia',
            'Tecnología': 'Tecnologia',
            'Petshops': 'Petshops',
            'Gastronomia': 'Gastronomia',
            'Transporte': 'Transporte',
            'Farmacias': 'Farmacias',
            'Indumentaria': 'Indumentaria',
          };
          return categoria ? (DB_CAT_MAP[categoria] ?? categoria) : 'Billeteras';
        })(),
      };

      // DEBUG: Loguear promos específicas que no se están guardando
      if (card.slug === 'transportevqr-abril26' || card.slug === '50-transportevqr-gp-abr26') {
        console.log(`\n[MODO DEBUG] Promo problemática: ${card.slug}`);
        console.log('  title:', promo.title);
        console.log('  storeName:', promo.storeName);
        console.log('  categoria:', promo.categoria);
        console.log('  validFrom:', promo.validFrom);
        console.log('  validUntil:', promo.validUntil);
        console.log('  sourceUrl:', promo.sourceUrl);
        console.log('  bankNames:', promo.bankNames);
      }

      promos.push(promo);
    }

    console.log(`[MODO Scraper V3] ${promos.length} promos procesadas`);
    return promos;
  },
};

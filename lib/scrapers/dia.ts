// DIA Scraper
// Fuente: https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones
// Técnica: HTTP GET — los datos de promos bancarias están embebidos como JSON en el HTML (SSR).
// No requiere Playwright. Cada entrada tiene: active, daysToShow, associatedBanks, terms.

import { Scraper, ScrapedPromo } from './types';
import { extractProvinces } from './bank-helpers';
import {
  extractDates,
  extractCap,
  extractMinPurchase,
  extractCardNetworks,
  extractWalletNames,
  normStr,
} from './cencosud-helpers';

const SOURCE_URL = 'https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones';
const STORE_NAME = 'DIA';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DaysToShow {
  monday: boolean; tuesday: boolean; wednesday: boolean;
  thursday: boolean; friday: boolean; saturday: boolean;
  sunday: boolean; all: boolean;
}

interface PromoEntry {
  __editorItemTitle: string;
  active: boolean;
  daysToShow: DaysToShow;
  availableOn: { online: boolean; store: boolean; all: boolean };
  associatedBanks?: { __editorItemTitle: string }[];
  terms: string;
}

// ─── daysToShow → bitmask ─────────────────────────────────────────────────────

function daysToMask(days: DaysToShow): number {
  // Ignorar days.all — DIA lo setea en true incluso cuando hay días específicos.
  // Solo usarlo como fallback si ningún día específico está activo.
  let mask = 0;
  if (days.sunday)    mask |= 1 << 0;
  if (days.monday)    mask |= 1 << 1;
  if (days.tuesday)   mask |= 1 << 2;
  if (days.wednesday) mask |= 1 << 3;
  if (days.thursday)  mask |= 1 << 4;
  if (days.friday)    mask |= 1 << 5;
  if (days.saturday)  mask |= 1 << 6;
  return mask || 127; // 127 solo si todos los días específicos son false
}

// ─── Extracción del JSON desde el HTML ───────────────────────────────────────
// Los datos están en el source como objetos JSON serializados.
// Buscamos todos los objetos que tengan el campo "terms" (texto legal de la promo).

function extractPromoEntries(html: string): PromoEntry[] {
  const entries: PromoEntry[] = [];

  // Encontrar todos los índices donde aparece `"terms":"`
  let searchFrom = 0;
  while (true) {
    const termsIdx = html.indexOf('"terms":"', searchFrom);
    if (termsIdx === -1) break;

    // Encontrar la apertura del objeto que contiene "terms"
    // Caminamos hacia atrás buscando el `{` de nivel 0
    let objStart = -1;
    let depth = 0;
    for (let i = termsIdx; i >= 0; i--) {
      if (html[i] === '}') depth++;
      else if (html[i] === '{') {
        if (depth === 0) { objStart = i; break; }
        depth--;
      }
    }
    if (objStart === -1) { searchFrom = termsIdx + 1; continue; }

    // Encontrar el cierre del objeto
    let objEnd = -1;
    depth = 0;
    for (let i = objStart; i < html.length; i++) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') {
        depth--;
        if (depth === 0) { objEnd = i; break; }
      }
    }
    if (objEnd === -1) { searchFrom = termsIdx + 1; continue; }

    const jsonStr = html.slice(objStart, objEnd + 1);
    try {
      const entry = JSON.parse(jsonStr) as PromoEntry;
      // Solo entradas con campo terms no vacío y que sean promos (tienen daysToShow)
      if (entry.terms && entry.daysToShow) {
        entries.push(entry);
      }
    } catch {
      // JSON malformado — saltar
    }

    searchFrom = objEnd + 1;
  }

  return entries;
}

// ─── paymentChannel desde terms y availableOn ────────────────────────────────

function extractChannel(
  terms: string,
  availableOn: PromoEntry['availableOn'],
): 'QR' | 'TARJETA_FISICA' | 'ANY' {
  const t = normStr(terms);
  if (/\bMODO\b|\bQR\b/.test(t)) return 'QR';
  if (!availableOn.online && availableOn.store) return 'TARJETA_FISICA';
  return 'ANY';
}

// ─── extractDiscountsDIA ──────────────────────────────────────────────────────
// Versión extendida para DIA:
// - Maneja paréntesis entre % y keyword: "25% (VEINTICINCO POR CIENTO) DE REINTEGRO"
// - Maneja "10% EN PRODUCTOS" sin keyword explícita (default DESCUENTO)
// - Maneja "BENEFICIO DE X%"

function extractDiscountsDIA(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  const t = text.toUpperCase();

  // Patrón 1: "X% (opcional parentético) DE/keyword"
  const p1 = /(\d+(?:\.\d+)?)\s*%\s*(?:\([^)]*\)\s*)?(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(t)) !== null) {
    const v = parseFloat(m[1]);
    const kw = m[0].toUpperCase();
    const type = /REINTEGRO|REEMBOLSO/.test(kw) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }

  // Patrón 2: "BENEFICIO DE X%" o "BENEFICIO DEL X%"
  const p2 = /BENEFICIO\s+DEL?\s+(\d+(?:\.\d+)?)\s*%/g;
  while ((m = p2.exec(t)) !== null) {
    const v = parseFloat(m[1]);
    if (!results.find(r => r.value === v)) results.push({ value: v, type: 'PERCENTAGE_DESCUENTO' });
  }

  // Patrón 3: X% seguido de cualquier cosa que no sea tasa financiera (CFT/TNA/TEA)
  // Ej: "BNA JUBILADOS 5%  PROMOCIÓN..." o "EL DESCUENTO ES DE UN 10% DEL TOTAL"
  if (results.length === 0) {
    const p3 = /(\d+(?:\.\d+)?)\s*%(?!\s*(?:TASA|TNA|TEA|CFT|T\.N\.A|T\.E\.A|C\.F\.T))/g;
    while ((m = p3.exec(t)) !== null) {
      const v = parseFloat(m[1]);
      // Excluir 0% (tasas de interés) y valores irreales
      if (v > 0 && v <= 100 && !results.find(r => r.value === v)) {
        const type = /REINTEGRO|REEMBOLSO/.test(t.slice(Math.max(0, m.index - 50), m.index + 50))
          ? 'PERCENTAGE_REINTEGRO'
          : 'PERCENTAGE_DESCUENTO';
        results.push({ value: v, type });
      }
    }
  }

  return results;
}

// ─── extractFromTitle ─────────────────────────────────────────────────────────
// Fallback: extrae descuento o CSI del __editorItemTitle cuando el terms no tiene nada.

function extractFromTitle(title: string): { discounts: { value: number; type: string }[]; installments: number } {
  // CSI: "3CI", "3 CSI", "3 cuotas sin interés"
  const csiMatch = title.match(/(\d+)\s*(?:CI\b|CSI\b|CUOTAS?\s+SIN)/i);
  const installments = csiMatch ? parseInt(csiMatch[1]) : 0;

  // Descuento: "10%", "5%"
  const discounts: { value: number; type: string }[] = [];
  if (!installments) {
    const pctMatch = title.match(/(\d+)\s*%/);
    if (pctMatch) {
      const v = parseInt(pctMatch[1]);
      if (v > 0 && v <= 100) {
        discounts.push({ value: v, type: 'PERCENTAGE_DESCUENTO' });
      }
    }
  }

  return { discounts, installments };
}

// ─── extractInstallments ─────────────────────────────────────────────────────

function extractInstallments(text: string): number {
  // Maneja "3 CUOTAS SIN INTERÉS" y "3 (TRES) CUOTAS SIN INTERÉS"
  const m = text.match(/(\d+)\s*(?:\([^)]*\)\s*)?CUOTAS?\s+SIN\s+INTER[ÉE]S/i);
  return m ? parseInt(m[1]) : 0;
}

// ─── Parser principal ─────────────────────────────────────────────────────────

function parseEntry(entry: PromoEntry): ScrapedPromo[] {
  const promos: ScrapedPromo[] = [];
  const { terms, daysToShow, availableOn, associatedBanks } = entry;

  if (!terms || terms.trim().length < 40) return promos;

  const discounts = extractDiscountsDIA(terms);
  const installments = extractInstallments(terms);

  let finalDiscounts = discounts;
  let finalInstallments = installments;

  if (discounts.length === 0 && installments === 0) {
    const fromTitle = extractFromTitle(entry.__editorItemTitle);
    finalDiscounts = fromTitle.discounts;
    finalInstallments = fromTitle.installments;
  }

  if (finalDiscounts.length === 0 && finalInstallments === 0) {
    console.log(`[DIA] Sin descuento ni CSI: "${entry.__editorItemTitle}" — terms: "${terms.slice(0, 150).replace(/\n/g, ' ')}"`);
    return promos;
  }

  const BANK_NAME_MAP: Record<string, string> = {
    'Naranja':      'Naranja X',
    'Naranja X':    'Naranja X',
    'BNA':          'Banco Nación',
    'Banco Nacion': 'Banco Nación',
    'Del Sol':      'Banco del Sol',
  };

  const bankNames = (associatedBanks ?? [])
    .map(b => BANK_NAME_MAP[b.__editorItemTitle.trim()] ?? b.__editorItemTitle.trim())
    .filter(n => n && n !== 'Nueva card');

  const walletNames = extractWalletNames(terms);

  if (bankNames.length === 0 && walletNames.length === 0) {
    console.log(`[DIA] Sin banco ni billetera: "${entry.__editorItemTitle}" — descartado`);
    return promos;
  }

  const { validFrom, validUntil, specificDates } = extractDates(terms);
  const capInfo    = extractCap(terms);
  const minPurchase = extractMinPurchase(terms);
  const cardNetworks = extractCardNetworks(terms);
  const validDays  = daysToMask(daysToShow);
  const paymentChannel = extractChannel(terms, availableOn);
  const stackable  = /NO\s+ACUMULABLE/i.test(terms) ? false : undefined;

  // Título: usar __editorItemTitle limpio como base (es más legible que el terms).
  // Ignorar títulos genéricos como "Nueva card".
  const rawTitle = entry.__editorItemTitle.trim().replace(/^\s*\d+CI\s*-\s*/i, '');
  const entityName = bankNames[0] ?? walletNames[0] ?? rawTitle;
  const title = rawTitle && rawTitle !== 'Nueva card' ? rawTitle : entityName;

  const promoBase = {
    description: title,
    sourceText: terms.slice(0, 8000),
    sourceUrl: SOURCE_URL,
    cap: capInfo?.value,
    capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
    capTarget: capInfo ? (capInfo.target ?? 'USER') : null,
    minPurchase: minPurchase ?? undefined,
    stackable,
    singleUse: undefined,
    validFrom,
    validUntil,
    specificDates,
    validDays,
    bankNames:    bankNames.length > 0 ? bankNames : undefined,
    walletNames:  walletNames.length > 0 ? walletNames : undefined,
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    cardType:     null,
    paymentChannel: paymentChannel as any,
    accountType:  'ANY' as any,
    storeName:    STORE_NAME,
    categoria:    'Supermercados',
    provinces:    extractProvinces(terms),
  };

  // Promos de descuento/reintegro
  for (const disc of finalDiscounts) {
    promos.push({
      ...promoBase,
      title,
      discount: String(disc.value),
      discountType: disc.type as any,
    } as ScrapedPromo);
  }

  // Cuotas sin interés (si no hay otro descuento)
  if (finalInstallments > 0 && finalDiscounts.length === 0) {
    promos.push({
      ...promoBase,
      title: `${finalInstallments} cuotas sin interés – ${bankNames[0] ?? walletNames[0] ?? 'DIA'}`,
      discount: String(finalInstallments),
      discountType: 'CUOTAS_SIN_INTERES' as any,
    } as ScrapedPromo);
  }

  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────

export const DIAScraper: Scraper = {
  name: STORE_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[DIA] Obteniendo página de medios de pago...');

    const response = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`[DIA] HTTP ${response.status}`);
    }

    const html = await response.text();
    console.log(`[DIA] HTML obtenido: ${html.length} chars`);

    const entries = extractPromoEntries(html);
    console.log(`[DIA] Entradas encontradas: ${entries.length}`);

    const activeEntries = entries.filter(e => e.active !== false);
    console.log(`[DIA] Entradas activas: ${activeEntries.length}`);

    const allPromos: ScrapedPromo[] = [];
    for (const entry of activeEntries) {
      const parsed = parseEntry(entry);
      allPromos.push(...parsed);
    }

    // Deduplicar por título + banco + descuento
    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.discount}|${p.discountType}|${JSON.stringify(p.bankNames)}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[DIA] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

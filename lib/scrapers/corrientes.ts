// Banco de Corrientes — portal de beneficios "Promos del Banco" (promosdelbanco.com), WordPress
// + TablePress. bancodecorrientes.com.ar linkea a este dominio externo desde el home
// (href="https://promosdelbanco.com"). Sitio detrás de un WAF tipo DNN-splash (cookies
// SplashPageView/dnn_IsMobile se setean con el primer request) — con curl -c/-b alcanza,
// no requiere headless/Playwright.
//
// Cada rubro tiene su propia página estática /promociones/{slug}/ con:
// 1) Un bloque de "título" (día(s) + % base + cuotas + tope, y a veces un bonus adicional
//    "ABONANDO CON MÁSBANCO/MODO X% ADICIONAL TOPE $Y") seguido de un párrafo legal con
//    la misma info en prosa — se parsea con los helpers ya existentes (extractDiscount,
//    extractInstallments, extractValidDays, extractCap) sobre el párrafo completo.
// 2) Una tabla TablePress con los comercios adheridos: DENOMINACION, DOMICILIO, LOCALIDAD,
//    VIGENTE DESDE, TARJETAS, y opcionalmente DESCUENTO (override del % base por comercio,
//    ej. Supermercados: 5% o 10% según el local en vez del % del párrafo).
//
// tarjeta-bonita (segmento tarjeta joven) es un programa aparte: tabla propia con columna
// RUBRO (categoría por comercio) en vez de basarse en la página en la que vive.

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import {
  extractDiscount, extractInstallments, extractValidDays, extractCap,
  extractCardNetworks, detectCategoria, dedup,
} from './bank-helpers';

const BANK_NAME = 'Banco de Corrientes';
const BASE_URL = 'https://promosdelbanco.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// slug de rubro → categoría PromoAR fija (más confiable que detectCategoria sobre el nombre del comercio)
const RUBRO_PAGE_CATEGORY: Record<string, string> = {
  'supermercados': 'Supermercados',
  'farmacias': 'Farmacias',
  'gastronomia': 'Gastronomía',
  'indumentaria': 'Indumentaria',
  'estaciones-de-servicio': 'Combustible',
  'librerias-jugueterias': 'Librerías',
  'concesionarias': 'Automotores',
  'mas-obras': 'Hogar',
  'bancotunegocio': 'Otros',
  'promo-clubes': 'Deportes',
  'florerias-y-viveros': 'Hogar',
  'colegios-y-consejos': 'Otros',
};

const RUBRO_SLUGS = Object.keys(RUBRO_PAGE_CATEGORY);

// Valores de la columna RUBRO en tarjeta-bonita → categoría PromoAR
const TARJETA_BONITA_RUBRO_MAP: Record<string, string> = {
  'INDUMENTARIA': 'Indumentaria',
  'LIBRERÍA': 'Librerías',
  'LIBRERIA': 'Librerías',
  'ESTÉTICA Y BELLEZA': 'Salud y Belleza',
  'ESTETICA Y BELLEZA': 'Salud y Belleza',
  'ENSEÑANZA': 'Otros',
  'ENSENANZA': 'Otros',
};

interface MerchantRow {
  name: string;
  address: string;
  city: string;
  validFrom?: string;
  cards: string;
  discountOverride?: number;
  rubro?: string; // solo tarjeta-bonita
}

let cookieHeader = '';

async function primeCookies(): Promise<void> {
  const res = await fetch(`${BASE_URL}/`, { headers: { 'User-Agent': UA } });
  const setCookies = res.headers.getSetCookie?.() ?? [];
  cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
}

async function fetchPage(path: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'User-Agent': UA, ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
  });
  if (!res.ok) return null;
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Divide el bloque de términos en (base, bonus) usando el punto donde aparece
// "ABONANDO ... M[ÁA]S ?BANCO" / "ABONANDO ... MODO" — el bonus es el % adicional
// exclusivo de pagar con la billetera MásBanco/MODO.
function splitBaseAndBonus(termsText: string): { base: string; bonus: string | null } {
  const m = termsText.match(/(.*?)(ABONANDO[\s\S]*?(?:M[ÁA]S\s*BANCO|MODO)[\s\S]*)/i);
  if (!m) return { base: termsText, bonus: null };
  return { base: m[1], bonus: m[2] };
}

function parseMerchantTable(html: string): MerchantRow[] {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/);
  if (!tableMatch) return [];
  const table = tableMatch[0];

  const headerCols = [...table.matchAll(/<th[^>]*><strong>([^<]*)<\/strong><\/th>/g)].map(m => m[1].trim().toUpperCase());
  const idxDenom = headerCols.findIndex(c => c.startsWith('DENOMINACION'));
  const idxDomicilio = headerCols.findIndex(c => c.startsWith('DOMIC'));
  const idxLocalidad = headerCols.findIndex(c => c.startsWith('LOCALIDAD'));
  const idxVigente = headerCols.findIndex(c => c.startsWith('VIGEN'));
  const idxRubro = headerCols.findIndex(c => c.startsWith('RUBRO'));
  const idxTarjetas = headerCols.findIndex(c => c.startsWith('TARJETA'));
  const idxDescuento = headerCols.findIndex(c => c.startsWith('DESCUENTO'));

  const rows: MerchantRow[] = [];
  const bodyMatch = table.match(/<tbody[\s\S]*?<\/tbody>/);
  if (!bodyMatch) return [];

  for (const rowMatch of bodyMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c =>
      c[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
    );
    if (cells.length === 0) continue;
    const name = idxDenom >= 0 ? cells[idxDenom] : '';
    if (!name) continue;

    const discRaw = idxDescuento >= 0 ? cells[idxDescuento] : '';
    const discOverride = discRaw ? parseFloat(discRaw.replace(',', '.')) : NaN;

    rows.push({
      name,
      address: idxDomicilio >= 0 ? cells[idxDomicilio] : '',
      city: idxLocalidad >= 0 ? cells[idxLocalidad] : '',
      validFrom: idxVigente >= 0 ? cells[idxVigente] : undefined,
      cards: idxTarjetas >= 0 ? cells[idxTarjetas] : '',
      discountOverride: Number.isFinite(discOverride) && discOverride > 0 ? discOverride : undefined,
      rubro: idxRubro >= 0 ? cells[idxRubro] : undefined,
    });
  }
  return rows;
}

// Las páginas de rubro usan d/m/yyyy (convención argentina); la página tarjeta-bonita
// usa m/d/yyyy (confirmado con fechas inequívocas como "2/23/2026" — no existe el mes 23).
function parseVigenteDesde(s: string | undefined, format: 'DMY' | 'MDY' = 'DMY'): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, first, second, yyyy] = m;
  let [dd, mm] = format === 'DMY' ? [first, second] : [second, first];
  // El sitio no es consistente con el formato de fecha entre rubros — si el mes queda
  // fuera de rango (ej. "14"), asumimos que el orden real era el opuesto y swapeamos.
  if (parseInt(mm, 10) > 12) {
    if (parseInt(dd, 10) <= 12) [dd, mm] = [mm, dd];
    else return undefined; // ninguna interpretación da una fecha válida
  }
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function groupMerchantsByOverride(rows: MerchantRow[]): Map<number | null, MerchantRow[]> {
  const groups = new Map<number | null, MerchantRow[]>();
  for (const r of rows) {
    const key = r.discountOverride ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return groups;
}

function promosFromTermsBlock(
  termsText: string,
  categoria: string,
  storeName: string,
  sourceUrl: string,
  cardNetworksOverride: CardNetworkWithType[] | undefined,
  walletOnly: boolean,
  discountOverrideValue?: number,
): ScrapedPromo[] {
  const validDays = extractValidDays(termsText);
  const discount = extractDiscount(termsText);
  const installments = extractInstallments(termsText);
  const cap = extractCap(termsText);
  const cardNetworks = cardNetworksOverride ?? extractCardNetworks(termsText);

  const promos: ScrapedPromo[] = [];
  const base: Partial<ScrapedPromo> = {
    sourceUrl,
    sourceText: termsText.slice(0, 500),
    validDays,
    cap: cap ?? null,
    capPeriod: cap ? 'MONTHLY' : null,
    bankNames: [BANK_NAME],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    walletNames: walletOnly ? ['MODO'] : undefined,
    paymentChannel: 'ANY',
    categoria,
    storeName,
  };

  const pctValue = discountOverrideValue ?? discount?.value;
  if (pctValue && pctValue > 0) {
    promos.push({
      ...base,
      title: `${pctValue}% ${walletOnly ? 'adicional MODO' : 'descuento'} – ${storeName}`,
      description: `${pctValue}% de descuento en ${storeName}${walletOnly ? ' pagando con MODO/MásBanco' : ''}`,
      discount: String(pctValue),
      discountType: discount?.type === 'PERCENTAGE_REINTEGRO' ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO',
    } as ScrapedPromo);
  }
  if (installments && installments > 0 && !walletOnly) {
    promos.push({
      ...base,
      title: `${installments} cuotas sin interés – ${storeName}`,
      description: `${installments} cuotas sin interés en ${storeName}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
      cap: null,
      capPeriod: null,
    } as ScrapedPromo);
  }
  return promos;
}

async function scrapeRubroPage(slug: string, categoria: string): Promise<ScrapedPromo[]> {
  const url = `${BASE_URL}/promociones/${slug}/`;
  const html = await fetchPage(`/promociones/${slug}/`);
  if (!html) return [];

  const rows = parseMerchantTable(html);
  if (rows.length === 0) return [];

  const tableIdx = html.indexOf('<table');
  const headText = stripHtml(html.slice(0, tableIdx));
  // El párrafo de términos empieza después del bloque de nav "... Frecuentes {Rubro}"
  const afterNav = headText.replace(/^[\s\S]*?Preguntas Frecuentes\s*/i, '');
  const { base: baseTerms, bonus: bonusTerms } = splitBaseAndBonus(afterNav);

  const groups = groupMerchantsByOverride(rows);
  const all: ScrapedPromo[] = [];

  for (const [overrideVal, groupRows] of groups) {
    const storeNames = [...new Set(groupRows.map(r => r.name))];

    for (const storeName of storeNames) {
      const storeRows = groupRows.filter(r => r.name === storeName);
      const cardsText = storeRows.map(r => r.cards).join(' ');
      const cardNetworks = extractCardNetworks(cardsText || baseTerms);
      const vigente = parseVigenteDesde(storeRows[0]?.validFrom);

      const basePromos = promosFromTermsBlock(
        baseTerms, categoria, storeName, url,
        cardNetworks.length > 0 ? cardNetworks : undefined,
        false,
        overrideVal ?? undefined,
      );
      for (const p of basePromos) {
        if (vigente) p.validFrom = vigente;
        p.note = `Sucursal: ${storeRows.map(r => `${r.address}, ${r.city}`).join(' / ')}`;
      }
      all.push(...basePromos);

      if (bonusTerms) {
        const bonusPromos = promosFromTermsBlock(
          bonusTerms, categoria, storeName, url,
          cardNetworks.length > 0 ? cardNetworks : undefined,
          true,
        );
        for (const p of bonusPromos) {
          if (vigente) p.validFrom = vigente;
          p.note = `Sucursal: ${storeRows.map(r => `${r.address}, ${r.city}`).join(' / ')}`;
        }
        all.push(...bonusPromos);
      }
    }
  }

  return all;
}

async function scrapeTarjetaBonita(): Promise<ScrapedPromo[]> {
  const url = `${BASE_URL}/promociones/tarjeta-bonita/`;
  const html = await fetchPage('/promociones/tarjeta-bonita/');
  if (!html) return [];

  const rows = parseMerchantTable(html);
  if (rows.length === 0) return [];

  const tableIdx = html.indexOf('<table');
  const headText = stripHtml(html.slice(0, tableIdx));
  const afterNav = headText.replace(/^[\s\S]*?Preguntas Frecuentes\s*/i, '');
  const { base: baseTerms } = splitBaseAndBonus(afterNav);

  const all: ScrapedPromo[] = [];
  const byName = new Map<string, MerchantRow[]>();
  for (const r of rows) {
    const key = `${r.name}|${r.rubro}`;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }

  for (const [, storeRows] of byName) {
    const storeName = storeRows[0].name;
    const rubroRaw = (storeRows[0].rubro ?? '').trim().toUpperCase();
    const categoria = TARJETA_BONITA_RUBRO_MAP[rubroRaw] ?? (detectCategoria(rubroRaw) || 'Otros');
    const cardsText = storeRows.map(r => r.cards).join(' ');
    const cardNetworks = extractCardNetworks(cardsText || baseTerms);
    const vigente = parseVigenteDesde(storeRows[0]?.validFrom, 'MDY');

    const promos = promosFromTermsBlock(
      baseTerms, categoria, storeName, url,
      cardNetworks.length > 0 ? cardNetworks : undefined,
      false,
    );
    for (const p of promos) {
      if (vigente) p.validFrom = vigente;
      p.segment = 'Tarjeta Joven Bonita';
      p.note = `Sucursal: ${storeRows.map(r => `${r.address}, ${r.city}`).join(' / ')}`;
    }
    all.push(...promos);
  }

  return all;
}

export const CorrientesScraper: Scraper = {
  name: 'Corrientes',
  async run(): Promise<ScrapedPromo[]> {
    await primeCookies();
    const all: ScrapedPromo[] = [];

    for (const slug of RUBRO_SLUGS) {
      const categoria = RUBRO_PAGE_CATEGORY[slug];
      const promos = await scrapeRubroPage(slug, categoria);
      all.push(...promos);
      await new Promise(r => setTimeout(r, 150));
    }

    all.push(...await scrapeTarjetaBonita());

    return dedup(all);
  },
};

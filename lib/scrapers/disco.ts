// Disco Scraper V4
// Fuente: https://www.disco.com.ar/descuentos-del-dia?type=por-banco
// Técnica: Playwright (SPA - VTEX) — itera por banco
// Extrae descuentos, reintegros y cuotas sin interés de cada entidad bancaria.

import { chromium, Page } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { extractProvinces } from './bank-helpers';

// ─── Lista de bancos ──────────────────────────────────────────────────────────
// Parámetros ?bank= verificados directamente desde los links de la página.
const BANKS: { param: string; displayName: string; type?: string }[] = [
  { param: 'Santander',           displayName: 'Banco Santander' },
  { param: 'Galicia',             displayName: 'Banco Galicia' },
  { param: 'Banco Macro',         displayName: 'Banco Macro' },
  { param: 'Nacion',              displayName: 'Banco Nación' },
  { param: 'Banco Hipotecario',   displayName: 'Banco Hipotecario' },
  { param: 'Banco Patagonia',     displayName: 'Banco Patagonia' },
  { param: 'supervielle',         displayName: 'Banco Supervielle' },
  { param: 'Banco Comafi',        displayName: 'Banco Comafi' },
  { param: ' Tarjeta Naranja X',  displayName: 'Naranja X' },
  { param: 'Amex',                displayName: 'American Express Banco' },
  { param: 'Visa y Master',       displayName: 'Visa / Mastercard' },
  { param: 'MODO',                displayName: 'MODO',        type: 'wallet' as const },
  { param: 'Jumbo Mas Clarin',    displayName: 'Clarín 365' },
  { param: 'Banco Patagonia 365', displayName: 'Banco Patagonia 365' },
  { param: 'CencoPay',            displayName: 'Cencopay Mastercard',    type: 'wallet' as const },
  { param: 'Tarjeta Sol',         displayName: 'Tarjeta Sol' },
  { param: 'Medios de Pago',      displayName: 'Jubilados y Pensionados' },
];

const BASE_URL = 'https://www.disco.com.ar/descuentos-del-dia?type=por-banco';
const STORE_NAME = 'Disco';

// ─── helpers ──────────────────────────────────────────────────────────────────

function execAll(regex: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function normStr(text: string): string {
  return text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ─── extractDates ─────────────────────────────────────────────────────────────
function extractDates(text: string): { validFrom?: string; validUntil?: string; specificDates?: string[] } {
  const currentYear = new Date().getFullYear();
  const normText = normStr(text);

  const parseNum = (s: string) => {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || String(currentYear);
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  };

  // Patrón numérico: "VÁLIDA DESDE 01/04/2026 HASTA 30/04/2026"
  const numericRangeMatch = normText.match(
    /(?:V[AÁ]LID[AO]\s+)?(?:DESDE\s+)?(?:DEL?\s+)?(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA(?:\s+EL)?)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRangeMatch) {
    return {
      validFrom: parseNum(numericRangeMatch[1]),
      validUntil: parseNum(numericRangeMatch[2]),
    };
  }

  // Rango con texto: "DESDE EL 1 DE ABRIL AL 30 DE ABRIL DE 2026"
  const simpleRangeMatch = normText.match(
    /\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/
  );
  if (simpleRangeMatch) {
    const monthName = simpleRangeMatch[3].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS[monthName];
    const y = simpleRangeMatch[4] ? parseInt(simpleRangeMatch[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return {
        validFrom: `${y}-${mm}-${simpleRangeMatch[1].padStart(2, '0')}`,
        validUntil: `${y}-${mm}-${simpleRangeMatch[2].padStart(2, '0')}`,
      };
    }
  }

  // Fechas individuales
  const specificDatesRaw = execAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g, normText);
  if (specificDatesRaw.length >= 2) {
    const dates = Array.from(new Set(specificDatesRaw.map(m => parseNum(m[1])))).sort();
    return { specificDates: dates, validFrom: dates[0], validUntil: dates[dates.length - 1] };
  }
  if (specificDatesRaw.length === 1) {
    const d = parseNum(specificDatesRaw[0][1]);
    return { validFrom: d, validUntil: d };
  }

  return {};
}

// ─── extractDiscounts ─────────────────────────────────────────────────────────
function extractDiscounts(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)/gi;
  const matches = execAll(pattern, text);
  for (const m of matches) {
    const v = parseFloat(m[1]);
    const keyword = m[0].toUpperCase();
    const type = keyword.includes('REINTEGRO') || keyword.includes('REEMBOLSO')
      ? 'PERCENTAGE_REINTEGRO'
      : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) {
      results.push({ value: v, type });
    }
  }
  return results;
}

// ─── extractInstallments ──────────────────────────────────────────────────────
function extractInstallments(titleText: string, bodyText: string): { value: number; type: string } | null {
  const combined = (titleText + ' ' + bodyText).toUpperCase();
  const match = combined.match(/(\d+)\s+CUOTAS?\s+SIN\s+INTER[ÉE]S/);
  if (match) return { value: parseInt(match[1]), type: 'CUOTAS_SIN_INTERES' };
  return null;
}

// ─── extractCap ───────────────────────────────────────────────────────────────
function extractCap(text: string): {
  value: number;
  target?: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION';
  period?: 'WEEKLY' | 'MONTHLY' | 'DAILY';
} | null {
  const match = text.match(
    /(?:TOPE[^$\n]*|M[AÁ]XIMO[^$\n]*REINTEGRO[^$\n]*|HASTA)\s*\$\s*([\d.,]+)/i
  );
  if (!match) return null;
  const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  if (isNaN(val) || val <= 0) return null;

  const t = text.toUpperCase();
  let target: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION' | undefined;
  let period: 'WEEKLY' | 'MONTHLY' | 'DAILY' | undefined;

  if (/POR\s+USUARIO|POR\s+CLIENTE|POR\s+PERSONA/.test(t)) target = 'USER';
  else if (/POR\s+TARJETA/.test(t)) target = 'CARD';
  else if (/POR\s+CUENTA/.test(t)) target = 'ACCOUNT';
  else if (/POR\s+TRANSACCI|POR\s+OPERACI/.test(t)) target = 'TRANSACCION';

  if (/SEMANAL|POR\s+SEMANA/.test(t)) period = 'WEEKLY';
  else if (/MENSUAL|POR\s+MES|AL\s+MES/.test(t)) period = 'MONTHLY';
  else if (/DIARIO|POR\s+D[ÍI]A/.test(t)) period = 'DAILY';

  return { value: val, target, period };
}

// ─── extractMinPurchase ───────────────────────────────────────────────────────
function extractMinPurchase(text: string): number | null {
  const match = text.match(
    /(?:COMPRAS?\s+(?:A\s+PARTIR\s+DE|DESDE|MAYOR(?:ES)?\s+O\s+IGUAL(?:ES)?\s+A|M[ÍI]NIM[OA](?:\s+DE)?)|MONTO\s+M[ÍI]NIM[OA](?:\s+DE)?\s*COMPRA|CONSUMO\s+M[ÍI]NIM[OA]|COMPRA\s+M[ÍI]NIMA)\s*:?\s*\$\s*([\d.,]+)/i
  );
  if (match) return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

// ─── extractValidDays ─────────────────────────────────────────────────────────
function extractValidDays(text: string): number {
  let t = text.toLowerCase();
  t = t.replace(/de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?(?: y de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?)?,? de lunes a sábados?\\.?/gi, '');

  const DAY_TO_BIT: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2,
    'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5,
    'sábado': 6, 'sabado': 6,
  };

  const rangeMatch = t.match(
    /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:a|hasta)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i
  );
  if (rangeMatch) {
    const startIdx = DAY_TO_BIT[rangeMatch[1]];
    const endIdx = DAY_TO_BIT[rangeMatch[2]];
    let mask = 0;
    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) mask |= 1 << i;
    } else {
      for (let i = startIdx; i <= 6; i++) mask |= 1 << i;
      for (let i = 0; i <= endIdx; i++) mask |= 1 << i;
    }
    return mask;
  }

  let mask = 0;
  if (t.includes('domingo')) mask |= 1 << 0;
  if (t.includes('lunes')) mask |= 1 << 1;
  if (t.includes('martes')) mask |= 1 << 2;
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= 1 << 3;
  if (t.includes('jueves')) mask |= 1 << 4;
  if (t.includes('viernes')) mask |= 1 << 5;
  if (t.includes('sábado') || t.includes('sabado')) mask |= 1 << 6;
  if (t.includes('fin de semana')) mask |= (1 << 6) | (1 << 0);

  if (mask > 0) return mask;
  return 127; // todos los días
}

// ─── extractPaymentChannel ────────────────────────────────────────────────────
function extractPaymentChannel(text: string): 'QR' | 'NFC' | 'TARJETA_FISICA' | 'TRANSFERENCIA' | 'DINERO_EN_CUENTA' | 'ANY' {
  const t = text.toUpperCase();
  const cleaned = t
    .replace(/NO\s+PARTICIPAN?.*?MODO/g, '')
    .replace(/NO\s+APLICA.*?NFC/g, '');

  if (/\bMODO\b/.test(cleaned) || /\bQR\b/.test(cleaned)) return 'QR';
  if (/NFC|CONTACTLESS|SIN\s+CONTACTO|APPLE\s+PAY|GOOGLE\s+PAY|\bTAP\b/.test(cleaned)) return 'NFC';
  if (/TRANSFERENCIA/.test(cleaned)) return 'TRANSFERENCIA';
  if (/DINERO\s+EN\s+CUENTA|SALDO\s+EN\s+CUENTA/.test(cleaned)) return 'DINERO_EN_CUENTA';
  if (/TARJETA\s+F[ÍI]SICA|EN\s+LOCAL|EN\s+TIENDA|COMPRAS\s+PRESENCIALES/.test(t)) return 'TARJETA_FISICA';
  return 'ANY';
}

// ─── extractCardType ──────────────────────────────────────────────────────────
function extractCardType(text: string): 'CREDIT' | 'DEBIT' | 'PREPAID' | null {
  const t = text.toUpperCase();
  const hasCredit = /TARJETAS?\s+DE\s+CR[EÉ]DITO|\bCR[EÉ]DITO\b/.test(t);
  const hasDebit = /TARJETAS?\s+DE\s+D[EÉ]BITO|\bD[EÉ]BITO\b|\bTD\b/.test(t);
  if (hasCredit && hasDebit) return null;
  if (hasCredit) return 'CREDIT';
  if (hasDebit) return 'DEBIT';
  if (/PREPAGA|PREPAID/.test(t)) return 'PREPAID';
  return null;
}

// ─── extractAccountType ───────────────────────────────────────────────────────
function extractAccountType(text: string): string {
  const t = text.toUpperCase();
  if (/JUBILAD|PENSIONAD/.test(t)) return 'JUBILADO';
  if (/PLAN\s+SUELDO|COBRANDO\s+HABERES|\bHABERES\b|CUENTA\s+SUELDO/.test(t)) return 'HABERES';
  if (/\bANSES\b/.test(t)) return 'ANSES';
  return 'ANY';
}

// ─── parsePageText ────────────────────────────────────────────────────────────
// Disco SPA innerText pattern per bank page (misma estructura VTEX que Jumbo):
//   [optional: "Exclusivo Online"]
//   LEGAL TEXT block (dates, conditions, etc.)
//   "+\nVer más"  ← reliable separator between promo cards
//
// Strategy: split on "+\nVer más" which appears after each card's legal text.
function parsePageText(
  fullText: string,
  bankDisplayName: string,
  sourceUrl: string,
  isWallet = false,
): ScrapedPromo[] {
  const promos: ScrapedPromo[] = [];

  // Normalize newlines
  const text = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on the "+" / "Ver más" pattern that Disco/VTEX uses after each promo card's legal text.
  // Also split on "Exclusivo Online" header which starts some cards.
  const rawBlocks = text.split(
    /\n\+\s*\n\s*Ver m[aá]s\s*\n|\n(?=Exclusivo\s+Online\s*\n)/i
  );

  // Footer markers — strip everything from these markers onward in each block
  const FOOTER_MARKERS = [
    /Términos más buscados/i,
    /Sí, quiero suscribirme/i,
    /¡Suscribite/i,
    /Política de privacidad/i,
  ];

  for (const rawBlock of rawBlocks) {
    // Strip footer noise from end of block
    let block = rawBlock;
    for (const marker of FOOTER_MARKERS) {
      const idx = block.search(marker);
      if (idx > 0) block = block.slice(0, idx);
    }
    block = block.trim();

    if (block.length < 40) continue;

    // Must contain at least one promotional signal
    const hasDiscount = /\d+\s*%\s*(de\s+)?(descuento|ahorro|reintegro|reembolso|bonificaci[oó]n)/i.test(block);
    const hasInstallments = /\d+\s+cuotas?\s+sin\s+inter[eé]s/i.test(block);
    if (!hasDiscount && !hasInstallments) continue;

    // Skip blocks that are purely about electronics/clothing with no bank reference
    if (/ELECTRODOM[EÉ]STICO|INDUMENTARIA/i.test(block) &&
        !/BANCO|TARJETA|MODO|MERCADO\s+PAGO|REINTEGRO/i.test(block)) continue;

    const installment = extractInstallments('', block);
    const discounts = extractDiscounts(block);
    if (!installment && discounts.length === 0) continue;

    const { validFrom, validUntil, specificDates } = extractDates(block);
    const capInfo = extractCap(block);
    const minPurchase = extractMinPurchase(block);
    const validDays = extractValidDays(block);
    const paymentChannel = extractPaymentChannel(block);
    const cardType = extractCardType(block);
    const accountType = extractAccountType(block);
    const stackable = /NO\s+(?:ES\s+)?ACUMULABLE|NO\s+SE\s+ACUMULA|no es acumulable|no se acumula/i.test(block) ? false : undefined;

    // Title: first non-trivial line of the block
    let title = block.split('\n').find(l => {
      const t = l.trim();
      return t.length > 5 && !/^(Exclusivo|Ver más|\+|Inicio|Por banco|Por d[ií]a|Planes de financiaci[oó]n|Cenco Pay|.*Categor[ií]as.*|Mi Cuenta)$/i.test(t);
    }) || '';
    title = title.replace(/\s+/g, ' ').trim().slice(0, 120);

    // capTarget: read from cap helper, fallback to ACCOUNT if "por cuenta" appears
    const capTargetVal = capInfo
      ? (capInfo.target ?? (/POR\s+CUENTA/i.test(block) ? 'ACCOUNT' : 'USER')) as 'USER' | 'ACCOUNT' | 'CARD' | 'TRANSACCION'
      : null;

    const promoBase: Partial<ScrapedPromo> = {
      description: block.slice(0, 500).replace(/\s+/g, ' ').trim(),
      sourceText: block.slice(0, 8000),
      sourceUrl,
      cap: capInfo?.value,
      capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
      capTarget: capTargetVal,
      minPurchase: minPurchase ?? undefined,
      stackable,
      singleUse: undefined,
      validFrom,
      validUntil,
      specificDates,
      validDays,
      bankNames:   isWallet ? undefined : [bankDisplayName],
      walletNames: isWallet ? [bankDisplayName] : undefined,
      cardType,
      paymentChannel,
      accountType: accountType as any,
      storeName: STORE_NAME,
      categoria: 'Supermercados',
      provinces: extractProvinces(block),
    };

    if (installment && discounts.length === 0) {
      promos.push({
        ...promoBase,
        title: title || `${installment.value} cuotas sin interés – ${bankDisplayName}`,
        discount: String(installment.value),
        discountType: 'CUOTAS_SIN_INTERES',
      } as ScrapedPromo);
    } else {
      for (const disc of discounts) {
        promos.push({
          ...promoBase,
          title: title || `${disc.value}% ${disc.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${bankDisplayName}`,
          discount: String(disc.value),
          discountType: disc.type as any,
        } as ScrapedPromo);
      }
    }
  }

  return promos;
}

// ─── scrapeBankPage ───────────────────────────────────────────────────────────
async function scrapeBankPage(
  page: Page,
  bank: { param: string; displayName: string },
): Promise<ScrapedPromo[]> {
  const url = `${BASE_URL}&bank=${encodeURIComponent(bank.param)}`;
  console.log(`[Disco] Scrapeando ${bank.displayName}: ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Esperar por el contenedor de promos o hasta 8s (SPA VTEX tarda en hidratar)
    await page.waitForSelector(
      '[class*="descuento"], [class*="promo"], [class*="discount"], .vtex-rich-text',
      { timeout: 8000 }
    ).catch(() => {
      // Si no hay selector, igual esperamos un tiempo fijo para el rendering
    });
    await page.waitForTimeout(3000);

    const fullText = await page.evaluate(() => document.body.innerText);
    console.log(`[Disco] ${bank.displayName}: ${fullText.length} chars`);

    if (fullText.length < 500) {
      console.warn(`[Disco] Sin contenido para ${bank.param}`);
      return [];
    }

    const promos = parsePageText(fullText, bank.displayName, url, bank.type === 'wallet');
    console.log(`[Disco] ${bank.displayName}: ${promos.length} promos`);
    return promos;
  } catch (err) {
    console.error(`[Disco] Error en ${bank.param}:`, err);
    return [];
  }
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const DiscoScraper: Scraper = {
  name: STORE_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Disco] Iniciando scraper...');
    const browser = await chromium.launch({ headless: true });
    const allPromos: ScrapedPromo[] = [];

    try {
      const page = await browser.newPage();

      // Bloquear recursos innecesarios para acelerar el scraping
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', route => route.abort());

      for (const bank of BANKS) {
        const promos = await scrapeBankPage(page, bank);
        allPromos.push(...promos);
      }

      await page.close();
    } finally {
      await browser.close();
    }

    // Deduplicar por título + banco + descuento
    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.discountType}|${JSON.stringify(p.bankNames)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[DiscoScraper] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
    return unique;
  },
};

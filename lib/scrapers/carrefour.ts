// Carrefour Scraper V1
// Fuente: https://www.carrefour.com.ar/descuentos-bancarios
// Técnica: Playwright (SPA - VTEX)
// Cubre: BNA, Patagonia, Mastercard, Mercado Pago, Club La Nación, jubilados, tarjeta Carrefour

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://www.carrefour.com.ar/descuentos-bancarios';

const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function execAll(regex: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

function normStr(s: string): string {
  return (s ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractDiscounts(text: string): Array<{ value: number; type: string }> {
  const results: Array<{ value: number; type: string }> = [];
  const t = normStr(text);

  const pctMatches = execAll(/(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|OFF)/g, t);
  for (const m of pctMatches) {
    const v = parseFloat(m[1]);
    const type = /REINTEGRO|REEMBOLSO/.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }

  const csiMatches = execAll(/(\d+)(?:\s+Y\s+(\d+))?\s+CUOTAS?\s+(?:SIN\s+INTERES|CERO\s+INTERES)/g, t);
  for (const m of csiMatches) {
    const maxV = Math.max(parseInt(m[1]), m[2] ? parseInt(m[2]) : 0);
    if (!results.find(r => r.value === maxV && r.type === 'CUOTAS_SIN_INTERES'))
      results.push({ value: maxV, type: 'CUOTAS_SIN_INTERES' });
  }

  return results;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string; specificDates?: string[] } {
  const currentYear = new Date().getFullYear();
  const normText = normStr(text);

  const parseNumDate = (s: string): string => {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || String(currentYear);
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  };

  // Fechas específicas
  const stripped = normText.replace(/\b(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\b/g, ' ');
  const specificDates: string[] = [];
  const monthRefs = execAll(/\bDE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/g, stripped);
  for (const mr of monthRefs) {
    const month = MONTHS[mr[1].toLowerCase()];
    if (!month) continue;
    const year = mr[2] ? parseInt(mr[2]) : currentYear;
    const before = stripped.substring(0, mr.index!);
    const segStart = Math.max(0, before.lastIndexOf('.') + 1, before.length - 80);
    const segment = before.substring(segStart);
    for (const nm of execAll(/\b(\d{1,2})\b/g, segment)) {
      const dayNum = parseInt(nm[1]);
      if (dayNum < 1 || dayNum > 31) continue;
      if (/\bAL\s*$/.test(segment.substring(Math.max(0, nm.index! - 4), nm.index!))) continue;
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (!specificDates.includes(iso)) specificDates.push(iso);
    }
  }
  if (specificDates.length > 0) {
    specificDates.sort();
    return { specificDates, validFrom: specificDates[0], validUntil: specificDates[specificDates.length - 1] };
  }

  // Rango numérico
  const numericRange = normText.match(
    /(?:DEL?|DESDE\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRange) return { validFrom: parseNumDate(numericRange[1]), validUntil: parseNumDate(numericRange[2]) };

  // Rango simple
  const simpleRange = normText.match(/\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (simpleRange) {
    const month = MONTHS[simpleRange[3].toLowerCase()];
    const y = simpleRange[4] ? parseInt(simpleRange[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return { validFrom: `${y}-${mm}-${simpleRange[1].padStart(2, '0')}`, validUntil: `${y}-${mm}-${simpleRange[2].padStart(2, '0')}` };
    }
  }

  return {};
}

function extractBankNames(text: string): string[] {
  const BANKS: [RegExp, string][] = [
    [/BANCO\s+NACION|BNA/i, 'Banco de la Nación Argentina'],
    [/PATAGONIA/i, 'Banco Patagonia'],
    [/SANTANDER/i, 'Banco Santander'],
    [/GALICIA/i, 'Banco Galicia'],
    [/BBVA/i, 'BBVA'],
    [/MACRO/i, 'Banco Macro'],
    [/SUPERVIELLE/i, 'Banco Supervielle'],
    [/CIUDAD/i, 'Banco Ciudad'],
    [/CREDICOOP/i, 'Banco Credicoop'],
    [/ICBC/i, 'ICBC'],
    [/HIPOTECARIO/i, 'Banco Hipotecario'],
    [/COMAFI/i, 'Banco Comafi'],
    [/PROVINCIA/i, 'Banco Provincia de Buenos Aires'],
  ];
  const found: string[] = [];
  for (const [re, name] of BANKS) if (re.test(text) && !found.includes(name)) found.push(name);
  return found;
}

function extractWalletNames(text: string): string[] {
  const t = normStr(text);
  const wallets: string[] = [];
  if (/MERCADO\s*PAGO|MERCADOPAGO/.test(t)) wallets.push('Mercado Pago');
  if (/\bMODO\b/.test(t)) wallets.push('MODO');
  if (/CUENTA\s+DNI/.test(t)) wallets.push('Cuenta DNI');
  if (/NARANJA\s+X/.test(t)) wallets.push('Naranja X');
  if (/MI\s+CARREFOUR|CARREFOUR\s+BANCO/.test(t)) wallets.push('Mi Carrefour');
  if (/CLUB\s+LA\s+NACION/.test(t)) wallets.push('Club La Nación');
  return wallets;
}

function extractValidDays(text: string): number {
  const t = text.toLowerCase();
  if (/todos los días|lunes a domingo/i.test(t)) return 127;
  if (/lunes a viernes/i.test(t)) return 0b0111110;

  const D: Record<string, number> = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6 };
  const rm = t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:a|hasta)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i);
  if (rm) {
    const [s, e] = [D[rm[1]], D[rm[2]]];
    let mask = 0;
    if (s <= e) { for (let i = s; i <= e; i++) mask |= 1 << i; }
    else { for (let i = s; i <= 6; i++) mask |= 1 << i; for (let i = 0; i <= e; i++) mask |= 1 << i; }
    return mask;
  }

  let mask = 0;
  if (t.includes('domingo')) mask |= 1;
  if (t.includes('lunes'))   mask |= 2;
  if (t.includes('martes'))  mask |= 4;
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= 8;
  if (t.includes('jueves'))  mask |= 16;
  if (t.includes('viernes')) mask |= 32;
  if (t.includes('sábado') || t.includes('sabado')) mask |= 64;
  if (t.includes('fin de semana')) mask |= 65;
  return mask || 127;
}

function extractCap(text: string): { value: number; period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' } | null {
  const t = normStr(text);
  const match = t.match(/TOPE[^$\d]*\$?\s*([\d.]+)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/\./g, ''));
  if (isNaN(value) || value <= 0) return null;
  // Descartar valores que parezcan un año (2020-2035) — confusión con fechas en el texto
  if (value >= 2020 && value <= 2035) return null;
  let period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined;
  if (/SEMANA/.test(t)) period = 'WEEKLY';
  else if (/MES/.test(t)) period = 'MONTHLY';
  else if (/DIA/.test(t)) period = 'DAILY';
  return { value, period };
}

function extractAccountType(text: string): string {
  const t = normStr(text);
  if (/JUBILAD|PENSIONAD/.test(t)) return 'JUBILADO';
  if (/PLAN\s+SUELDO|HABERES|ASALARIADO/.test(t)) return 'HABERES';
  if (/\bANSES\b/.test(t)) return 'ANSES';
  return 'ANY';
}

function parsePromos(fullText: string): ScrapedPromo[] {
  const promos: ScrapedPromo[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const textsToProcess = [fullText.replace(/\r/g, '')];

  for (const bodyText of textsToProcess) {
    if (bodyText.length < 50) continue;

    const discounts = extractDiscounts(bodyText);
    if (discounts.length === 0) continue;

    const bankNames = extractBankNames(bodyText);
    const walletNames = extractWalletNames(bodyText);
    if (bankNames.length === 0 && walletNames.length === 0) continue;

    const { validFrom, validUntil, specificDates } = extractDates(bodyText);

    // Filtrar expiradas
    if (validUntil && !specificDates && validUntil < today) continue;

    const capInfo = extractCap(bodyText);
    const validDays = extractValidDays(bodyText);
    const accountType = extractAccountType(bodyText);
    const stackable = /NO\s+ACUMULABLE/i.test(bodyText) ? false : undefined;
    const paymentChannel = /\bQR\b|\bMODO\b/.test(normStr(bodyText)) ? 'QR' : 'ANY';

    const cardNetworks = (() => {
      const t = normStr(bodyText);
      const isCredit = /CREDITO/.test(t), isDebit = /DEBITO/.test(t);
      const ct: 'CREDIT' | 'DEBIT' | null = isCredit && isDebit ? null : isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : null;
      const r: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
      if (/\bVISA\b/.test(t)) r.push({ network: 'Visa', type: ct });
      if (/MASTERCARD/.test(t)) r.push({ network: 'Mastercard', type: ct });
      return r;
    })();

    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    let title = lines.length > 0 ? lines[0] : bodyText.slice(0, 60).trim();
    if (bankNames.length > 0 && !title.toUpperCase().includes(bankNames[0].toUpperCase())) {
      title = `${bankNames[0]} - ${title}`;
    } else if (walletNames.length > 0 && !title.toUpperCase().includes(walletNames[0].toUpperCase())) {
      title = `${walletNames[0]} - ${title}`;
    }

    for (const disc of discounts) {
      promos.push({
        title: title.replace(/\s+/g, ' '),
        description: title,
        sourceText: bodyText.slice(0, 8000),
        sourceUrl: SOURCE_URL,
        discount: String(disc.value),
        discountType: disc.type as any,
        cap: capInfo?.value,
        capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
        capTarget: capInfo ? 'USER' : null,
        minPurchase: undefined,
        stackable,
        singleUse: undefined,
        validFrom, validUntil, specificDates,
        validDays,
        bankNames: bankNames.length > 0 ? bankNames : undefined,
        walletNames: walletNames.length > 0 ? walletNames : undefined,
        cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
        cardType: null,
        paymentChannel: paymentChannel as any,
        accountType: accountType as any,
        storeName: 'Carrefour',
        categoria: 'Supermercados',
      });
    }

    console.log(`[Carrefour] ✅ "${title.slice(0, 60)}" → ${discounts.map(d => `${d.value}%`).join(', ')} | días: ${validDays}`);
  }

  return promos;
}

export const CarrefourScraper: Scraper = {
  name: 'Carrefour',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Carrefour] Iniciando scraper...');
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage();

      await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

      const CARD_SEL = '.valtech-carrefourar-bank-promotions-0-x-cardBox';
      await page.waitForSelector(CARD_SEL, { timeout: 35000 }).catch(() =>
        console.warn('[Carrefour] Selector de cards no encontrado, intentando con fallback')
      );

      const cardTexts = await page.$$eval(CARD_SEL, els =>
        els.map(el => (el as HTMLElement).innerText?.trim() ?? '')
      ).catch(() => []);

      let promos: ScrapedPromo[] = [];
      
      if (cardTexts.length > 0) {
        for (const cardText of cardTexts) {
          promos.push(...parsePromos(cardText));
        }
      } else {
        const fullText = await page.evaluate(() => document.body.innerText).catch(() => '');
        promos = parsePromos(fullText);
      }
      
      await page.close();




      console.log(`[Carrefour Scraper V1] ${promos.length} promos encontradas`);
      return promos;

    } finally {
      await browser.close();
    }
  },
};

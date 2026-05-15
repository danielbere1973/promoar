// Diarco Scraper V1
// Fuente: https://www.diarco.com.ar/promociones/
// Estructura WordPress: h2 para secciones y títulos, details/p para legales
// Categoría: Supermercados

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://www.diarco.com.ar/promociones/';

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

function isPromoTitle(text: string): boolean {
  const t = text.trim();
  if (t.length < 5) return false;
  if (t.includes(' - ') || t.includes(' \u2013 ')) return true;
  if (/^(banco|modo|mercado\s+pago|personal pay|naranja|diarco club|billeteras?)/i.test(t)) return true;
  return false;
}

function extractDiscounts(text: string): Array<{ value: number; type: string }> {
  const results: Array<{ value: number; type: string }> = [];
  const normText = normStr(text);

  // Porcentajes de descuento/reintegro en variantes:
  // "X% DE DESCUENTO", "X% REINTEGRO", "REINTEGRO DEL X%", "X% VÍA REINTEGRO"
  const pctMatches = execAll(/(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO)/g, normText);
  for (const m of pctMatches) {
    const v = parseFloat(m[1]);
    if (v <= 0 || v > 100) continue;
    const type = /REINTEGRO|REEMBOLSO/.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }

  // Variante inversa: "REINTEGRO DEL X%" o "REINTEGRO DE X%"
  const reintegroAlt = execAll(/REINTEGRO\s+(?:DEL?|VIA)\s+(\d+(?:\.\d+)?)\s*%/g, normText);
  for (const m of reintegroAlt) {
    const v = parseFloat(m[1]);
    if (v > 0 && v <= 100 && !results.find(r => r.value === v && r.type === 'PERCENTAGE_REINTEGRO'))
      results.push({ value: v, type: 'PERCENTAGE_REINTEGRO' });
  }

  // Cuotas sin interés en varias formas
  const csiMatches = execAll(/(\d+)(?:\s+Y\s+(\d+))?\s+CUOTAS?\s+(?:SIN\s+INTERES|CERO\s+INTERES|SIN\s+INTER)/g, normText);
  for (const m of csiMatches) {
    const maxV = Math.max(parseInt(m[1]), m[2] ? parseInt(m[2]) : 0);
    if (!results.find(r => r.value === maxV && r.type === 'CUOTAS_SIN_INTERES')) {
      results.push({ value: maxV, type: 'CUOTAS_SIN_INTERES' });
    }
  }

  // Fallback: si hay CFTNA: 0% o CFT: 0% y se menciona X cuotas
  if (results.length === 0 && /CFTNA:\s*0%|CFT:\s*0%|TNA[^.]*0,00%/i.test(text)) {
    const cuotasMatch = normText.match(/(\d+)\s+CUOTAS?/);
    if (cuotasMatch) {
      const v = parseInt(cuotasMatch[1]);
      if (v >= 2 && v <= 24) results.push({ value: v, type: 'CUOTAS_SIN_INTERES' });
    }
  }

  return results;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string } {
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

  const numericRange = normText.match(
    /(?:DEL?|DESDE\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRange) {
    return { validFrom: parseNumDate(numericRange[1]), validUntil: parseNumDate(numericRange[2]) };
  }

  const simpleRange = normText.match(/\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (simpleRange) {
    const month = MONTHS[simpleRange[3].toLowerCase()];
    const y = simpleRange[4] ? parseInt(simpleRange[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return {
        validFrom: `${y}-${mm}-${simpleRange[1].padStart(2, '0')}`,
        validUntil: `${y}-${mm}-${simpleRange[2].padStart(2, '0')}`,
      };
    }
  }

  const vigencia = normText.match(/VIGENTE[^.]*?(\d{1,2}\/\d{1,2}\/\d{2,4})[^.]*?(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (vigencia) {
    return { validFrom: parseNumDate(vigencia[1]), validUntil: parseNumDate(vigencia[2]) };
  }

  return {};
}

function extractCap(text: string): { value: number; period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' } | null {
  const t = normStr(text);
  const match = t.match(/TOPE[^$\n]*\$\s*([\d.]+)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/\./g, ''));
  if (isNaN(value) || value <= 0) return null;
  let period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined;
  if (/SEMANA/.test(t)) period = 'WEEKLY';
  else if (/MES/.test(t)) period = 'MONTHLY';
  else if (/DIA/.test(t)) period = 'DAILY';
  return { value, period };
}

function extractMinPurchase(text: string): number | null {
  const match = text.match(/(?:COMPRA\s+M[ÍI]NIMA|M[ÍI]NIMO\s+DE\s+COMPRA|A\s+PARTIR\s+DE)\s*:?\s*\$\s*([\d.]+)/i);
  if (match) return parseFloat(match[1].replace(/\./g, ''));
  return null;
}

function extractValidDays(text: string): number {
  const t = text.toLowerCase();
  const DAY_TO_BIT: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
  };

  if (/todos los días|todos los dias|lunes a domingo/i.test(t)) return 127;

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
  if (t.includes('domingo'))                               mask |= 1 << 0;
  if (t.includes('lunes'))                                mask |= 1 << 1;
  if (t.includes('martes'))                               mask |= 1 << 2;
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= 1 << 3;
  if (t.includes('jueves'))                               mask |= 1 << 4;
  if (t.includes('viernes'))                              mask |= 1 << 5;
  if (t.includes('sábado') || t.includes('sabado'))      mask |= 1 << 6;
  if (t.includes('fin de semana'))                        mask |= (1 << 6) | (1 << 0);

  return mask || 127;
}

function extractBankName(title: string): string | null {
  const BANKS: [RegExp, string][] = [
    [/hipotecario/i, 'Banco Hipotecario'],
    [/naci[oó]n|bna\+?/i, 'Banco de la Nación Argentina'],
    [/macro/i, 'Banco Macro'],
    [/credicoop/i, 'Banco Credicoop'],
    [/galicia/i, 'Banco Galicia'],
    [/ciudad/i, 'Banco Ciudad'],
    [/comafi/i, 'Banco Comafi'],
    [/chubut/i, 'Banco Chubut'],
    [/supervielle/i, 'Banco Supervielle'],
    [/bbva/i, 'BBVA'],
    [/santander/i, 'Banco Santander'],
    [/icbc/i, 'ICBC'],
    [/patagonia/i, 'Banco Patagonia'],
    [/corrientes/i, 'Banco de Corrientes'],
    [/columbia/i, 'Banco Columbia'],
    [/provincia/i, 'Banco Provincia'],
  ];
  for (const [regex, name] of BANKS) {
    if (regex.test(title)) return name;
  }
  return null;
}

function extractWalletNames(text: string): string[] {
  const t = normStr(text);
  const wallets: string[] = [];
  if (/MERCADO\s*PAGO|MERCADOPAGO/.test(t)) wallets.push('Mercado Pago');
  if (/\bMODO\b/.test(t)) wallets.push('MODO');
  if (/CUENTA\s+DNI/.test(t)) wallets.push('Cuenta DNI');
  if (/PERSONAL\s+PAY/.test(t)) wallets.push('Personal Pay');
  if (/NARANJA\s+X/.test(t)) wallets.push('Naranja X');
  if (/\bUAL[AÁ]\b/.test(t)) wallets.push('Ualá');
  return wallets;
}

function extractCardNetworks(text: string): Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> {
  const t = normStr(text);
  const results: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
  const isCredit = /TARJETA\s+DE\s+CREDITO|\bCREDITO\b/.test(t);
  const isDebit = /TARJETA\s+DE\s+DEBITO|\bDEBITO\b/.test(t);
  const cardType: 'CREDIT' | 'DEBIT' | null = isCredit && isDebit ? null : isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : null;

  if (/\bVISA\b/.test(t)) results.push({ network: 'Visa', type: cardType });
  if (/MASTERCARD/.test(t)) results.push({ network: 'Mastercard', type: cardType });
  if (/\bCABAL\b/.test(t)) results.push({ network: 'Cabal', type: cardType });
  if (/AMERICAN\s+EXPRESS|\bAMEX\b/.test(t)) results.push({ network: 'American Express', type: 'CREDIT' });
  if (/NARANJA\s+X/.test(t)) results.push({ network: 'Naranja X', type: 'CREDIT' });

  return results;
}

function extractPaymentChannel(text: string): string {
  const t = normStr(text);
  if (/\bQR\b/.test(t) || /\bMODO\b/.test(t)) return 'QR';
  if (/\bNFC\b|CONTACTLESS|SIN\s+CONTACTO/.test(t)) return 'NFC';
  if (/TRANSFERENCIA/.test(t)) return 'TRANSFERENCIA';
  if (/DINERO\s+EN\s+CUENTA/.test(t)) return 'DINERO_EN_CUENTA';
  return 'ANY';
}

function extractAccountType(text: string): string {
  const t = normStr(text);
  if (/JUBILAD|PENSIONAD/.test(t)) return 'JUBILADO';
  if (/ASALARIADO|HABERES|COBRA\s+HABERES|PLAN\s+SUELDO/.test(t)) return 'HABERES';
  if (/\bANSES\b/.test(t)) return 'ANSES';
  return 'ANY';
}

function extractStoreName(sectionHeader: string): string {
  const h = sectionHeader.toLowerCase();
  if (h.includes('barrio') && h.includes('mayorista')) return 'Diarco';
  if (h.includes('barrio')) return 'Diarco Barrio';
  if (h.includes('mayorista')) return 'Diarco Mayorista';
  return 'Diarco';
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const DiarcoScraper: Scraper = {
  name: 'Diarco',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Diarco] Obteniendo página de promociones...');
    const { data: html } = await axios.get(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PromoAR/1.0)' },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const promos: ScrapedPromo[] = [];
    const seenKeys = new Set<string>(); // Para deduplicar

    $('.e-loop-item.promocion').each((i, el) => {
      const textBlock = $(el).text().replace(/\s+/g, ' ').trim();
      if (textBlock.length < 50) return;

      const titleElements = $(el).find('h2, h3').map((_, e) => $(e).text().trim()).get();
      // The store name section is usually one of the h2
      const sectionHeader = titleElements.find(t => /v[aá]lido\s+en/i.test(t)) || '';
      const storeName = extractStoreName(sectionHeader);

      // Find the main title (e.g. "Banco Nación - Miércoles")
      const titleRaw = [...titleElements].reverse().find(t => isPromoTitle(t)) || titleElements[0] || textBlock.substring(0, 50);

      const legalesText = textBlock;
      const descText = titleElements.filter(t => t !== titleRaw && t !== sectionHeader).join(' | ');




      // Note: we removed the DOM sibling traversal since .e-loop-item.promocion contains all text

        if (!legalesText) return;

        const discounts = extractDiscounts(legalesText);
        if (discounts.length === 0) {
          const fromTitle = extractDiscounts(titleRaw);
          if (fromTitle.length === 0) return;
          discounts.push(...fromTitle);
        }

        const { validFrom, validUntil } = extractDates(legalesText);
        const capInfo = extractCap(legalesText);
        const minPurchase = extractMinPurchase(legalesText);
        const bankName = extractBankName(titleRaw);
        const walletNames = extractWalletNames(titleRaw + ' ' + legalesText);
        const cardNetworks = extractCardNetworks(legalesText);
        const validDays = extractValidDays(titleRaw + ' ' + legalesText);
        const paymentChannel = extractPaymentChannel(titleRaw + ' ' + legalesText);
        const accountType = extractAccountType(titleRaw + ' ' + legalesText);
        const stackable = /NO\s+ACUMULABLE/i.test(legalesText) ? false : undefined;

        for (const discountInfo of discounts) {
          const dedupeKey = `${titleRaw}|${discountInfo.value}|${discountInfo.type}|${storeName}`;
          if (seenKeys.has(dedupeKey)) continue;
          seenKeys.add(dedupeKey);

          const promo: ScrapedPromo = {
            title: titleRaw.replace(/\s+/g, ' '),
            description: descText || titleRaw,
            sourceText: legalesText.slice(0, 8000),
            sourceUrl: SOURCE_URL,
            discount: String(discountInfo.value),
            discountType: discountInfo.type as any,
            cap: capInfo?.value,
            capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
            capTarget: capInfo ? 'USER' : null,
            minPurchase: minPurchase ?? undefined,
            stackable,
            singleUse: undefined,
            validFrom,
            validUntil,
            specificDates: undefined,
            validDays,
            bankNames: bankName ? [bankName] : undefined,
            walletNames: walletNames.length > 0 ? walletNames : undefined,
            cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
            cardType: null,
            paymentChannel: paymentChannel as any,
            accountType: accountType as any,
            storeName,
            categoria: 'Supermercados',
          };

          promos.push(promo);
        }

        console.log(`[Diarco] ✅ "${titleRaw}" → ${discounts.map(d => `${d.value} ${d.type}`).join(', ')} | ${storeName} | días: ${validDays}`);
    });

    console.log(`[Diarco Scraper V1] ${promos.length} promos encontradas`);
    return promos;
  },
};

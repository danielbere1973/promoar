// cencosud-helpers.ts
// Funciones compartidas para el grupo Cencosud (Jumbo, Disco, Vea)
// Misma lógica de parsing que coto.ts pero adaptada para bloques numerados VTEX.

import { ScrapedPromo, CardNetworkWithType } from './types';

// ─── helpers ──────────────────────────────────────────────────────────────────

export function execAll(regex: RegExp, text: string): RegExpExecArray[] {
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(regex.source, regex.flags);
  while ((m = re.exec(text)) !== null) results.push(m);
  return results;
}

export function normStr(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── extractDates ─────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function parseSpanishDate(dayNum: string, monthName: string, year?: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const y = year ? parseInt(year) : new Date().getFullYear();
  return `${y}-${String(month).padStart(2, '0')}-${String(parseInt(dayNum)).padStart(2, '0')}`;
}

export function extractDates(text: string): { validFrom?: string; validUntil?: string; specificDates?: string[] } {
  const currentYear = new Date().getFullYear();
  const normText = text.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const parseNum = (s: string) => {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || String(currentYear);
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  };

  const stripped = normText
    .replace(/\b(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\b/g, ' ')
    .replace(/\s+/g, ' ');

  const specificDates: string[] = [];

  const monthRefs = execAll(/\bDE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/g, stripped);
  for (const mr of monthRefs) {
    const monthName = mr[1].toLowerCase();
    const month = MONTHS[monthName];
    if (!month) continue;
    const year = mr[2] ? parseInt(mr[2]) : currentYear;

    const before = stripped.substring(0, mr.index!);
    const sentenceStart = Math.max(0, before.lastIndexOf('.') + 1, before.length - 80);
    const segment = before.substring(sentenceStart);

    const nums = execAll(/\b(\d{1,2})\b/g, segment);
    for (const nm of nums) {
      const dayNum = parseInt(nm[1]);
      if (dayNum < 1 || dayNum > 31) continue;
      const precedingChars = segment.substring(Math.max(0, nm.index! - 4), nm.index!);
      if (/\bAL\s*$/.test(precedingChars)) continue;
      if (nm[1].length === 4) continue;

      const iso = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      if (!specificDates.includes(iso)) specificDates.push(iso);
    }
  }

  specificDates.sort();

  if (specificDates.length > 0) {
    return {
      specificDates,
      validFrom: specificDates[0],
      validUntil: specificDates[specificDates.length - 1],
    };
  }

  const numericRangeMatch = normText.match(
    /(?:V[AÁ]LIDO|VIGENCIA|DEL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRangeMatch) {
    return {
      validFrom: parseNum(numericRangeMatch[1]),
      validUntil: parseNum(numericRangeMatch[2]),
    };
  }

  const simpleRangeMatch = normText.match(
    /\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/
  );
  if (simpleRangeMatch) {
    const monthName = simpleRangeMatch[3].toLowerCase();
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

  const rangeMatch = normText.match(
    /(?:DESDE\s+EL|DEL)\s+(\d{1,2})(?:\s+DE)?\s+([A-Z]+)(?:\s+(?:DE)?\s*(\d{4}))?\s+(?:AL|HASTA\s+EL)\s+(\d{1,2})(?:\s+DE)?\s+([A-Z]+)(?:\s+(?:DE)?\s*(\d{4}))?/
  );
  if (rangeMatch) {
    const y1 = rangeMatch[3] ? parseInt(rangeMatch[3]) : currentYear;
    const y2 = rangeMatch[6] ? parseInt(rangeMatch[6]) : currentYear;
    const from = parseSpanishDate(rangeMatch[1], rangeMatch[2], String(y1));
    const until = parseSpanishDate(rangeMatch[4], rangeMatch[5], String(y2));
    return { validFrom: from ?? undefined, validUntil: until ?? undefined };
  }

  return {};
}

// ─── extractDiscounts (plural) ────────────────────────────────────────────────
export function extractDiscounts(text: string): { value: number; type: string }[] {
  const results: { value: number; type: string }[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)/gi;
  const matches = execAll(pattern, text);
  for (const m of matches) {
    const v = parseFloat(m[1]);
    const keyword = m[0].toUpperCase();
    const type =
      keyword.includes('REINTEGRO') || keyword.includes('REEMBOLSO')
        ? 'PERCENTAGE_REINTEGRO'
        : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) {
      results.push({ value: v, type });
    }
  }
  return results;
}

// ─── extractCap ───────────────────────────────────────────────────────────────
export function extractCap(text: string): {
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
export function extractMinPurchase(text: string): number | null {
  const match = text.match(
    /(?:COMPRAS?\s+(?:A\s+PARTIR\s+DE|DESDE|MAYOR(?:ES)?\s+O\s+IGUAL(?:ES)?\s+A|M[ÍI]NIM[OA](?:\s+DE)?)|MONTO\s+M[ÍI]NIM[OA](?:\s+DE)?\s*COMPRA|CONSUMO\s+M[ÍI]NIM[OA]|COMPRA\s+M[ÍI]NIMA)\s*:?\s*\$\s*([\d.,]+)/i
  );
  if (match) return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

// ─── extractValidDays ─────────────────────────────────────────────────────────
export function extractValidDays(text: string): number {
  let t = text.toLowerCase();
  t = t.replace(/de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?(?: y de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?)?,? de lunes a sábados?\.?/gi, '');

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

  if (
    t.includes('todos los días') ||
    t.includes('todos los dias') ||
    t.includes('de lunes a sábado') ||
    t.includes('de lunes a sabado') ||
    t.includes('de lunes a domingo')
  ) return 127;

  return 127; // Default: todos los días
}

// ─── extractBankNames ─────────────────────────────────────────────────────────
export function extractBankNames(text: string): string[] {
  const t = text.toUpperCase();

  const BANK_RE =
    /BANCO|BRUBANK|NARANJA|RIPIO|POMELO|PATAGONIA|SUPERVIELLE|COMAFI|CITY|GALICIA|MACRO|BBVA|ICBC|CIUDAD|SANTANDER|HIPOTECARIO|CREDICOOP|NACI[OÓ]N|BNA|COLUMBIA|ENTRE\s+R[ÍI]OS|SANTA\s+FE|SAN\s+JUAN|SANTA\s+CRUZ|CORRIENTES|CHACO|TUCUM[AÁ]N|NEUQU[EÉ]N|MENDOZA|SALTA|FORMOSA|JUJUY|MISIONES|CATAMARCA|RIOJA|ITAU|HSBC/i;

  const listPatterns = [
    /EMITIDAS?\s+POR(?:\s+LOS?\s+SIGUIENTES?\s+BANCOS?)?[\s:]+([^.]{5,400})/gi,
    /SIGUIENTES?\s+BANCOS?\s+(?:SELECCIONADOS?|PARTICIPANTES?)[\s:]+([^.]+)/gi,
    /BANCOS?\s+PARTICIPANTES?[\s:]+([^.]+)/gi,
    /(?:TARJETAS?\s+DE\s+CR[EÉ]DITO|TARJETAS?\s+DE\s+D[EÉ]BITO)\s+EMITIDAS?\s+POR[\s:]+([^.]+)/gi,
  ];

  const allNames = new Set<string>();

  for (const pattern of listPatterns) {
    const matches = execAll(pattern, t);
    for (const m of matches) {
      const chunk = m[1];
      const parts = chunk.split(/[,;]/);
      for (const part of parts) {
        const cleaned = part.trim()
          .replace(/\s*\d+[,.]?\d*\s*(?:CUOTAS?|SIN\s+INTER[EÉ]S).*/i, '')
          .replace(/^(Y|E)\s+/i, '')
          .replace(/TARJETAS?\s+(?:VISA|MASTERCARD|AMERICAN\s+EXPRESS|CABAL)\s*/gi, '')
          .replace(/\s+Y\s*$/i, '')
          .trim();
        if (cleaned.length > 2 && BANK_RE.test(cleaned)) {
          allNames.add(cleaned);
        }
      }
    }
  }

  // Fallback: menciones individuales de banco
  if (allNames.size === 0) {
    const singleMatches = execAll(
      /(?:BANCO\s+[A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+)?|BBVA|BRUBANK|NARANJA\s+X|GALICIA|MACRO|ICBC|SANTANDER|CREDICOOP|SUPERVIELLE|COMAFI|PATAGONIA|HIPOTECARIO)/gi,
      t
    );
    for (const m of singleMatches) {
      const name = m[0].trim().replace(/S\.A\..*/, '').trim();
      if (name.length > 2) allNames.add(name);
    }
  }

  return Array.from(allNames)
    .map(n => n.trim())
    .filter(n => n.length > 2);
}

// ─── extractWalletNames ───────────────────────────────────────────────────────
export function extractWalletNames(text: string): string[] {
  const t = text.toUpperCase();
  const wallets: string[] = [];
  if (/MERCADO\s+PAGO|MERCADOPAGO/.test(t)) wallets.push('Mercado Pago');
  if (/\bMODO\b/.test(t)) wallets.push('MODO');
  if (/CUENTA\s+DNI/.test(t)) wallets.push('Cuenta DNI');
  if (/PERSONAL\s+PAY/.test(t)) wallets.push('Personal Pay');
  if (/NARANJA\s+X/.test(t)) wallets.push('Naranja X');
  if (/\bUAL[AÁ]\b/.test(t)) wallets.push('Ualá');
  if (/\bBRUBANK\b/.test(t)) wallets.push('Brubank');
  if (/\bBIIM\b/.test(t)) wallets.push('Biim');
  return wallets;
}

// ─── extractCardNetworks ──────────────────────────────────────────────────────
export function extractCardNetworks(text: string): CardNetworkWithType[] {
  let t = text.toUpperCase();
  t = t.replace(/(?:NO\s+APLICA|NI\s+PARA|EXCLUYE|NO\s+V[AÁ]LIDO)[^.]{0,100}?(?:AMERICAN\s+EXPRESS|AMEX|VISA|MASTERCARD|CABAL|MAESTRO)/gi, '');

  const results: CardNetworkWithType[] = [];

  const hasCredit = /TARJETAS?\s+DE\s+CR[EÉ]DITO|\bCR[EÉ]DITO\b/.test(t);
  const hasDebit = /TARJETAS?\s+DE\s+D[EÉ]BITO|\bD[EÉ]BITO\b/.test(t);
  const cardType: 'CREDIT' | 'DEBIT' | null = hasCredit && !hasDebit ? 'CREDIT' : hasDebit && !hasCredit ? 'DEBIT' : null;

  if (/MASTERCARD/.test(t)) results.push({ network: 'MASTERCARD', type: cardType });
  if (/\bVISA\b/.test(t)) results.push({ network: 'VISA', type: cardType });
  if (/\bCABAL\b/.test(t)) results.push({ network: 'CABAL', type: cardType });
  if (/AMERICAN\s+EXPRESS|\bAMEX\b/.test(t)) results.push({ network: 'AMERICAN EXPRESS', type: cardType });
  if (/\bMAESTRO\b/.test(t)) results.push({ network: 'MAESTRO', type: cardType });

  return results;
}

// ─── extractAccountType ───────────────────────────────────────────────────────
export function extractAccountType(text: string): string {
  const t = text.toUpperCase();
  if (/JUBILAD|PENSIONAD/.test(t)) return 'JUBILADO';
  if (/PLAN\s+SUELDO|COBRANDO\s+HABERES|\bHABERES\b|CUENTA\s+SUELDO/.test(t)) return 'HABERES';
  if (/\bANSES\b|BENEFICIARIOS\s+ANSES/.test(t)) return 'ANSES';
  return 'ANY';
}

// ─── parsePromos ──────────────────────────────────────────────────────────────
// Parser principal para los legales del grupo Cencosud.
// Bloques numerados: "1) TÍTULO PROMO..."
export function parsePromos(fullText: string, storeName: string, sourceUrl: string): ScrapedPromo[] {
  const promos: ScrapedPromo[] = [];

  // Patrón: bloques numerados "N) TEXTO..."
  const blockPattern = /(?:^|\n)\s*(\d{1,3})\)\s+([A-ZÁÉÍÓÚÑ][^]*?)(?=\n\s*\d{1,3}\)|\s*$)/g;
  const blocks = execAll(blockPattern, fullText.replace(/\r/g, ''));

  for (const block of blocks) {
    const bodyText = block[2].trim();
    if (bodyText.length < 50) continue;

    // Ignorar bloques irrelevantes
    if (/ELECTRODOM[EÉ]STICO|INDUMENTARIA|ESPECIAL\s+DE\s+LA\s+SEMANA|PRECIO\s+DESTACADO/i.test(bodyText) &&
      !/BANCO|TARJETA|MODO|MERCADO\s+PAGO|REINTEGRO/i.test(bodyText)) continue;

    const discounts = extractDiscounts(bodyText);
    if (discounts.length === 0) continue;

    const bankNames = extractBankNames(bodyText);
    const walletNames = extractWalletNames(bodyText);
    if (bankNames.length === 0 && walletNames.length === 0) continue;

    const { validFrom, validUntil, specificDates } = extractDates(bodyText);
    const capInfo = extractCap(bodyText);
    const minPurchase = extractMinPurchase(bodyText);
    const cardNetworks = extractCardNetworks(bodyText);
    const validDays = extractValidDays(bodyText);
    const accountType = extractAccountType(bodyText);
    const stackable = /NO\s+ACUMULABLE/i.test(bodyText) ? false : undefined;

    // Título: primera oración del bloque (hasta el primer punto o 80 chars)
    const titleMatch = bodyText.match(/^([^.]{10,80})/);
    const title = titleMatch ? titleMatch[1].trim() : bodyText.slice(0, 60).trim();

    for (const disc of discounts) {
      promos.push({
        title: title.replace(/\s+/g, ' '),
        description: title,
        sourceText: bodyText.slice(0, 8000),
        sourceUrl,
        discount: String(disc.value),
        discountType: disc.type as any,
        cap: capInfo?.value,
        capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
        capTarget: capInfo ? 'USER' : null,
        minPurchase: minPurchase ?? undefined,
        stackable,
        singleUse: undefined,
        validFrom,
        validUntil,
        specificDates,
        validDays,
        bankNames: bankNames.length > 0 ? bankNames : undefined,
        walletNames: walletNames.length > 0 ? walletNames : undefined,
        cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
        cardType: null,
        paymentChannel: /\bQR\b|\bMODO\b/.test(normStr(bodyText)) ? 'QR' : 'ANY' as any,
        accountType: accountType as any,
        storeName,
        categoria: 'Supermercados',
      });
    }
  }

  return promos;
}

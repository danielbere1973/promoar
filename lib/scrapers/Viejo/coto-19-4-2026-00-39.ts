import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://coto.com.ar/legales/';

// Helper: simula matchAll sin requerir --downlevelIteration
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

function parseSpanishDate(dayNum: string, monthName: string, year?: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const y = year ? parseInt(year) : new Date().getFullYear();
  return `${y}-${String(month).padStart(2, '0')}-${String(parseInt(dayNum)).padStart(2, '0')}`;
}

// ─── extractDates ─────────────────────────────────────────────────────────────
// FIX: rangeMatch ahora devuelve validFrom correctamente.
// FIX: numericListMatch mejorado para separar bien las fechas.
function extractDates(text: string): { validFrom?: string; validUntil?: string; specificDates?: string[] } {

  const currentYear = new Date().getFullYear();
  const specificMatches: string[] = [];

  // 1. Lista de fechas numéricas: "VÁLIDA PARA LOS LUNES 06/04/2026, 13/04/2026 Y 27/04/2026"
  const numericListMatch = text.match(
    /(?:V[AÁ]LIDA?\s+PARA\s+LOS?\s+[A-ZÁÉÍÓÚÑ\s]{0,20}?\s*)((?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*[,y]\s*))+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i
  );
  if (numericListMatch) {
    const rawDates = numericListMatch[1].split(/[\s,y]+/i).filter(d => /\d{1,2}\/\d{1,2}/.test(d));
    for (const d of rawDates) {
      const parts = d.split('/');
      if (parts.length < 2) continue;
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2] || String(currentYear);
      if (year.length === 2) year = '20' + year;
      const iso = `${year}-${month}-${day}`;
      if (!specificMatches.includes(iso)) specificMatches.push(iso);
    }
    if (specificMatches.length > 0) return { specificDates: specificMatches };
  }

  // 2. Rango numérico con fechas completas: "VÁLIDO DEL 01/04/2026 AL 30/04/2026"
  const numericRangeMatch = text.match(
    /(?:V[AÁ]LIDO|VIGENCIA|DEL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  );
  if (numericRangeMatch) {
    const parseNumeric = (s: string) => {
      const parts = s.split('/');
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = '20' + y;
      return `${y}-${m}-${d}`;
    };
    return {
      validFrom: parseNumeric(numericRangeMatch[1]),
      validUntil: parseNumeric(numericRangeMatch[2]),
    };
  }

  // 2b. Rango simple sin año: "DEL 1 AL 30 DE ABRIL" o "MARTES DEL 1 AL 30 DE ABRIL DE 2026"
  // Patrón: número + AL/HASTA + número + DE + mes
  const simpleRangeMatch = text.match(
    /\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+DE\s+(\d{4}))?/i
  );
  if (simpleRangeMatch) {
    const d1 = simpleRangeMatch[1].padStart(2, '0');
    const d2 = simpleRangeMatch[2].padStart(2, '0');
    const monthName = simpleRangeMatch[3].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTHS[monthName];
    const y = simpleRangeMatch[4] ? parseInt(simpleRangeMatch[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return {
        validFrom: `${y}-${mm}-${d1}`,
        validUntil: `${y}-${mm}-${d2}`,
      };
    }
  }

  // 3. Rango en español con mes explícito: "DESDE EL 1 DE ABRIL AL 30 DE ABRIL DE 2026"
  const rangeMatch = text.match(
    /(?:DESDE\s+EL|DEL)\s+(\d{1,2})(?:\s+DE)?\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+(?:DE)?\s*(\d{4}))?\s+(?:AL|HASTA\s+EL)\s+(\d{1,2})(?:\s+DE)?\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+(?:DE)?\s*(\d{4}))?/i
  );
  if (rangeMatch) {
    const y1 = rangeMatch[3] ? parseInt(rangeMatch[3]) : currentYear;
    const y2 = rangeMatch[6] ? parseInt(rangeMatch[6]) : currentYear;
    const from = parseSpanishDate(rangeMatch[1], rangeMatch[2], String(y1));
    const until = parseSpanishDate(rangeMatch[4], rangeMatch[5], String(y2));
    return { validFrom: from ?? undefined, validUntil: until ?? undefined };
  }

  // 3b. Rango mismo mes: "SABADO 11 DE ABRIL HASTA EL DOMINGO 12 DE ABRIL DE 2026"
  // Dos días distintos del mismo mes en specificDates
  const sameMonthRangeMatch = text.match(
    /(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+DE\s+(\d{4}))?\s+HASTA\s+EL\s+(?:[A-ZÁÉÍÓÚÑ]+\s+)?(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+DE\s+(\d{4}))?/i
  );
  if (sameMonthRangeMatch) {
    const monthName1 = sameMonthRangeMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const monthName2 = sameMonthRangeMatch[5].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month1 = MONTHS[monthName1];
    const month2 = MONTHS[monthName2];
    const y1 = sameMonthRangeMatch[3] ? parseInt(sameMonthRangeMatch[3]) : currentYear;
    const y2 = sameMonthRangeMatch[6] ? parseInt(sameMonthRangeMatch[6]) : currentYear;
    const dates: string[] = [];
    if (month1) dates.push(`${y1}-${String(month1).padStart(2,'0')}-${sameMonthRangeMatch[1].padStart(2,'0')}`);
    if (month2) dates.push(`${y2}-${String(month2).padStart(2,'0')}-${sameMonthRangeMatch[4].padStart(2,'0')}`);
    if (dates.length > 0) return { specificDates: dates };
  }

  // 4. Bloque "VÁLIDO/VIGENCIA ... LOS DÍAS ..." con fechas específicas en español
  // FIX: Ahora captura patrones como "SÁBADO 18, DOMINGO 19 Y LUNES 20 DE ABRIL DE 2026"
  //      ignorando los nombres de días y extrayendo solo los números + mes.
  const blockMatch = text.match(
    /(?:V[AÁ]LID[AO]|VIGENCIA|VIGENTE)[^.]*?(?:EL?|LOS?)\s+D[ÍI]AS?\s+([^.]{5,300})/i
  );
  if (blockMatch) {

    // En extractDates, al inicio del bloque blockMatch:
    const blockText = blockMatch[1].toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quitar tildes
    // Extraer mes y año del bloque (buscar el primer mes mencionado)
    const mesAnioMatch = blockText.match(/DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/i);
    const mesGlobal = mesAnioMatch ? mesAnioMatch[1].toLowerCase() : null;
    const anioGlobal = mesAnioMatch && mesAnioMatch[2] ? parseInt(mesAnioMatch[2]) : currentYear;
    const monthGlobal = mesGlobal ? MONTHS[mesGlobal] : null;

    if (monthGlobal) {
      // Extraer todos los números que preceden al mes (ignorando nombres de días)
      // Patrón: "SÁBADO 18, DOMINGO 19 Y LUNES 20 DE ABRIL" → [18, 19, 20]
      const beforeMes = blockText.split(/DE\s+[A-Z]+/)[0];
      const dayNumbers = execAll(/\b(\d{1,2})\b/g, beforeMes)
        .map(m => parseInt(m[1]))
        .filter(n => n >= 1 && n <= 31);
      for (const d of dayNumbers) {
        const iso = `${anioGlobal}-${String(monthGlobal).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!specificMatches.includes(iso)) specificMatches.push(iso);
      }
    }

    // Fallback: Fechas individuales "X DE MES" o "X Y Y DE MES"
    if (specificMatches.length === 0) {
      const monthMatches = execAll(/(\d{1,2})(?:\s+Y\s+(\d{1,2}))?\s+DE\s+(\w+)(?:\s+DE\s+(\d{4}))?/gi, blockText);
      for (const m of monthMatches) {
        const monthName = m[3].toLowerCase();
        const month = MONTHS[monthName];
        if (month) {
          const y = m[4] ? parseInt(m[4]) : currentYear;
          const iso1 = `${y}-${String(month).padStart(2, '0')}-${String(parseInt(m[1])).padStart(2, '0')}`;
          if (!specificMatches.includes(iso1)) specificMatches.push(iso1);
          if (m[2]) {
            const iso2 = `${y}-${String(month).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`;
            if (!specificMatches.includes(iso2)) specificMatches.push(iso2);
          }
        }
      }
    }
  }

  return { specificDates: specificMatches.length > 0 ? specificMatches : undefined };
}

// ─── extractDiscount ──────────────────────────────────────────────────────────
function extractDiscount(text: string): { value: number; type: string } | null {
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)/i
  );
  if (match) {
    const v = parseFloat(match[1]);
    const keyword = match[0].toUpperCase();
    const type =
      keyword.includes('REINTEGRO') || keyword.includes('REEMBOLSO')
        ? 'PERCENTAGE_REINTEGRO'
        : 'PERCENTAGE_DESCUENTO';
    return { value: v, type };
  }
  return null;
}

// ─── extractSegmentedDiscounts ────────────────────────────────────────────────
// Detecta descuentos diferenciados por segmento y genera entradas separadas.
// Ej: "20% para clientes Galicia Standard y 25% para clientes Galicia Eminent"
interface SegmentDiscount {
  value: number;
  type: string;
  segment: string;
}

const SEGMENT_KEYWORDS = [
  'standard', 'classic', 'eminent', 'select', 'premier', 'black', 'platinum',
  'gold', 'signature', 'infinite', 'elite', 'priority', 'visa infinite',
  'mastercard black', 'mastercard platinum', 'visa platinum', 'visa gold',
  'jubilad', 'pensionad', 'haberes', 'sueldo', 'anses',
];

function extractSegmentedDiscounts(text: string): SegmentDiscount[] {
  const results: SegmentDiscount[] = [];
  // Captura: "X% de [descuento|reintegro] ... para clientes/usuarios [segmento]"
  const pattern = /(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)[^.]{0,150}?(?:PARA\s+CLIENTES?\s+|PARA\s+USUARIOS?\s+|PARA\s+CUENTAS?\s+)([^,.]{3,60}?)(?=[,.\n]|\s+Y\s+\d|\s+PARA\s+|\s*$)/gi;
  const matches = execAll(pattern, text);
  for (const m of matches) {
    const v = parseFloat(m[1]);
    const segmentText = m[2].trim();
    const keyword = m[0].toUpperCase();
    const type =
      keyword.includes('REINTEGRO') || keyword.includes('REEMBOLSO')
        ? 'PERCENTAGE_REINTEGRO'
        : 'PERCENTAGE_DESCUENTO';
    const hasSegment = SEGMENT_KEYWORDS.some(k => segmentText.toLowerCase().includes(k));
    if (hasSegment) {
      results.push({ value: v, type, segment: segmentText });
    }
  }
  return results;
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

  // Limpieza de avisos legales de horarios de envío que confunden el extractor de rango
  t = t.replace(/de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?(?: y de \d{1,2}:\d{2} a \d{1,2}:\d{2} hs\.?)?,? de lunes a sábados?\.?/gi, '');

  const DAY_TO_BIT: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2,
    'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5,
    'sábado': 6, 'sabado': 6,
  };

  // Rango: "lunes a jueves", "viernes a domingo"
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

// ─── extractPaymentChannel ────────────────────────────────────────────────────
function extractPaymentChannel(text: string): string {
  // Remover exclusiones comunes para evitar falsos positivos
  let t = text.toUpperCase();
  t = t.replace(/NO\s+APLICA.*?NFC/g, '')
    .replace(/EXCLUYE.*?NFC/g, '')
    .replace(/EXCLUSIVO\s+PAGANDO\s+CON\s+QR/g, 'QR') // Reforzar QR si es exclusivo
    .replace(/NO\s+V[AÁ]LIDO.*?NFC/g, '');

  const hasNFC = /NFC|CONTACTLESS|SIN\s+CONTACTO|APPLE\s+PAY|GOOGLE\s+PAY|\bTAP\b/.test(t);
  const hasQR = /\bQR\b|ESCANEANDO.*?C[OÓ]DIGO|C[OÓ]DIGO.*?ESCANEANDO/.test(t);
  const hasTransfer = /TRANSFERENCIA/.test(t);
  const hasAccountBalance = /DINERO\s+EN\s+CUENTA|SALDO\s+EN\s+CUENTA/.test(t);
  const isModo = /\bMODO\b/.test(t);

  if (hasNFC && hasQR) return 'ANY';
  if (hasNFC) return 'NFC';
  if (hasQR || isModo) return 'QR'; // MODO es intrínsecamente QR en supermercados
  if (hasTransfer) return 'TRANSFERENCIA';
  if (hasAccountBalance) return 'DINERO_EN_CUENTA';
  return 'ANY';
}

// ─── extractAccountType ───────────────────────────────────────────────────────
// FIX: antes se definía pero nunca se llamaba en run(). Ahora se llama correctamente.
function extractAccountType(text: string): string {
  const t = text.toUpperCase();
  if (/JUBILAD|PENSIONAD/.test(t)) return 'JUBILADO';
  if (/PLAN\s+SUELDO|COBRANDO\s+HABERES|\bHABERES\b|CUENTA\s+SUELDO/.test(t)) return 'HABERES';
  if (/\bANSES\b|BENEFICIARIOS\s+ANSES/.test(t)) return 'ANSES';
  return 'ANY';
}

// ─── extractWalletNames ───────────────────────────────────────────────────────
function extractWalletNames(text: string): string[] {
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

// ─── extractStackable ─────────────────────────────────────────────────────────
// FIX: antes se usaba en run() sin ser extraído del texto.
function extractStackable(text: string): boolean | undefined {
  const t = text.toUpperCase();
  if (/NO\s+(?:ES\s+)?ACUMULABLE|NO\s+ACUMULA|NO\s+COMBINABLE/.test(t)) return false;
  if (/(?:ES\s+)?ACUMULABLE|SE\s+ACUMULA/.test(t)) return true;
  return undefined;
}

// ─── extractSingleUse ─────────────────────────────────────────────────────────
function extractSingleUse(text: string): boolean | undefined {
  const t = text.toUpperCase();
  if (/USO\s+[ÚU]NICO|UNA\s+(?:SOLA\s+)?VEZ\s+POR\s+(?:SEMANA|MES|D[ÍI]A)|UN\s+SOLO\s+USO/.test(t)) return true;
  return undefined;
}

// ─── extractBankNames ─────────────────────────────────────────────────────────
function extractBankNames(text: string): string[] {
  const t = text.toUpperCase();

  const BANK_RE =
    /BANCO|BRUBANK|NARANJA|RIPIO|POMELO|PATAGONIA|SUPERVIELLE|COMAFI|CITY|GALICIA|MACRO|BBVA|ICBC|CIUDAD|SANTANDER|HIPOTECARIO|CREDICOOP|NACI[OÓ]N|BNA|COLUMBIA|ENTRE\s+R[ÍI]OS|SANTA\s+FE|SAN\s+JUAN|SANTA\s+CRUZ|CORRIENTES|CHACO|TUCUM[AÁ]N|NEUQU[EÉ]N|MENDOZA|SALTA|FORMOSA|JUJUY|MISIONES|CATAMARCA|RIOJA|ITAU|HSBC/i;

  const listPatterns = [
    /EMITIDAS?\s+POR(?:\s+LOS?\s+SIGUIENTES?\s+BANCOS?)?[\s:]+([^.]{5,400})/gi,
    /PARA\s+APPLE\s+PAY[\s:]+([^.]+?)(?:PARA\s+GOOGLE\s+PAY|PARA\s+MODO|\.)/gi,
    /PARA\s+GOOGLE\s+PAY[\s:]+([^.]+?)(?:PARA\s+MODO|PARA\s+APPLE|BILLETERAS?|\.)/gi,
    /PARA\s+MODO[^:]*[\s:]+([^.]+?)(?:BILLETERAS?|DURANTE|\.)/gi,
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

// ─── extractCardType ──────────────────────────────────────────────────────────
// FIX: antes usaba .includes() con patrones regex (que no funcionan así). Ahora usa /regex/.test().
function extractCardType(text: string): string | null {
  const t = text.toUpperCase();
  if (/TODOS\s+LOS\s+MEDIOS\s+DE\s+PAGO/.test(t)) return null;
  if (/TARJETAS?\s+DE\s+CR[EÉ]DITO/.test(t)) return 'CREDIT';
  if (/TARJETAS?\s+DE\s+D[EÉ]BITO/.test(t)) return 'DEBIT';
  if (/TARJETA\s+PREPAGA|PREPAID/.test(t)) return 'PREPAID';
  if (/\bCR[EÉ]DITO\b/.test(t)) return 'CREDIT';
  if (/\bD[EÉ]BITO\b/.test(t)) return 'DEBIT';
  return 'CREDIT'; // Default
}

// ─── extractCardNetwork ───────────────────────────────────────────────────────
function extractCardNetwork(text: string): string | null {
  let t = text.toUpperCase();

  // Remover exclusiones primero para evitar falsos positivos
  t = t.replace(/(?:NO\s+APLICA|NI\s+PARA|EXCLUYE|NO\s+V[AÁ]LIDO)[^.]{0,100}?(?:AMERICAN\s+EXPRESS|AMEX|VISA|MASTERCARD|CABAL|MAESTRO)/gi, '');

  if (/TODOS\s+LOS\s+MEDIOS\s+DE\s+PAGO/.test(t)) return null;
  if (/MASTERCARD/.test(t) && /\bVISA\b/.test(t)) return null; // Ambas → sin restricción
  if (/MASTERCARD/.test(t)) return 'MASTERCARD';
  if (/\bVISA\b/.test(t)) return 'VISA';
  if (/\bCABAL\b/.test(t)) return 'CABAL';
  if (/AMERICAN\s+EXPRESS|\bAMEX\b/.test(t)) return 'AMERICAN EXPRESS';
  if (/\bMAESTRO\b/.test(t)) return 'MAESTRO';
  return null;
}

// ─── extractProvinces ─────────────────────────────────────────────────────────
function extractProvinces(text: string): string[] {
  const t = text.toUpperCase()
    .replace(/BS\.?\s?AS\.?/g, 'BUENOS AIRES')
    .replace(/C\.?A\.?B\.?A\.?/g, 'CABA');

  if (
    /TODA\s+LA\s+REP[UÚ]BLICA\s+ARGENTINA|TODAS\s+LAS\s+SUCURSALES|[AÁ]MBITO\s+NACIONAL|TODO\s+EL\s+PA[ÍI]S/.test(t)
  ) {
    return ['Todas'];
  }

  const allProvinces = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
    'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
    'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
    'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
  ];

  const found = allProvinces.filter(p => {
    const norm = p
      .toUpperCase()
      .replace(/[Á]/g, 'A').replace(/[É]/g, 'E').replace(/[Í]/g, 'I')
      .replace(/[Ó]/g, 'O').replace(/[Ú]/g, 'U');
    return t.includes(norm);
  });

  return found.length > 0 ? found : ['Todas'];
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────

export const CotoScraper: Scraper = {
  name: 'Coto',

  async run(): Promise<ScrapedPromo[]> {
    const { data: html } = await axios.get(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PromoAR/1.0)' },
      timeout: 15000,
    });
    const $ = cheerio.load(html);
    const fullText = $('body').text();

    // Coto separa cada promo con el patrón ** TITULO **
    const titlePattern = /\*\*\s*([^*]+?)\s*\*\*/g;
    const matches = execAll(titlePattern, fullText);
    const promos: ScrapedPromo[] = [];

    for (let i = 0; i < matches.length; i++) {
      const titleMatch = matches[i];
      const title = titleMatch[1].trim();

      // Ignorar títulos irrelevantes
      if (title.length < 5 || /promo rodados|publicidad/i.test(title)) continue;

      // Cuerpo: texto entre este ** ** y el siguiente (o fin de página)
      const start = titleMatch.index! + titleMatch[0].length;
      const end = matches[i + 1] ? matches[i + 1].index! : fullText.length;
      const bodyText = fullText.slice(start, end).trim();

      // ── Extracción de datos ───────────────────────────────────────────────
      const { validFrom, validUntil, specificDates } = extractDates(bodyText);
      const capInfo = extractCap(bodyText);
      const minPurchase = extractMinPurchase(bodyText);
      const bankNames = extractBankNames(bodyText);
      const walletNames = extractWalletNames(title + ' ' + bodyText);
      const cardNetwork = extractCardNetwork(title) || extractCardNetwork(bodyText) || undefined;
      const cardType = extractCardType(title + ' ' + bodyText);
      const validDays = extractValidDays(title + ' ' + bodyText);
      const paymentChannel = extractPaymentChannel(title + ' ' + bodyText);
      const provinces = extractProvinces(bodyText);
      const accountType = extractAccountType(title + ' ' + bodyText); // FIX: antes no se llamaba
      const stackable = extractStackable(bodyText);                   // FIX: antes era undefined
      const singleUse = extractSingleUse(bodyText);

      // ── Segmentos ─────────────────────────────────────────────────────────
      // Si hay descuentos diferenciados por segmento → generamos una promo por segmento.
      const segmentedDiscounts = extractSegmentedDiscounts(title + ' ' + bodyText);

      if (segmentedDiscounts.length > 1) {
        for (const seg of segmentedDiscounts) {
          promos.push({
            title: `${title.replace(/\s+/g, ' ')} – ${seg.segment}`,
            description: bodyText.slice(0, 2000).trim(),
            sourceText: bodyText.slice(0, 8000).trim(), // Condiciones completas
            sourceUrl: SOURCE_URL,
            discount: String(seg.value),
            discountType: seg.type,
            segment: seg.segment,
            cap: capInfo?.value,
            capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
            capTarget: capInfo?.target,
            minPurchase: minPurchase ?? undefined,
            stackable,
            singleUse,
            validFrom,
            validUntil,
            specificDates: specificDates?.length ? specificDates : undefined,
            validDays,
            bankNames: bankNames.length > 0 ? bankNames : undefined,
            walletNames: walletNames.length > 0 ? walletNames : undefined,
            cardNetworkName: cardNetwork,
            cardType,
            paymentChannel,
            accountType,
            provinces,
            storeName: 'Coto',
            categoria: 'Supermercados',
          });
        }
        continue;
      }

      // ── Descuento único (o sin segmento diferenciado) ─────────────────────
      const discountInfo =
        extractDiscount(bodyText) ||
        extractDiscount(title) ||
        (segmentedDiscounts.length === 1 ? segmentedDiscounts[0] : null);

      // Si no tiene descuento claro lo saltamos (puede revisarse en el futuro para cuotas, etc.)
      if (!discountInfo) continue;

      promos.push({
        title: title.replace(/\s+/g, ' '),
        description: bodyText.slice(0, 2000).trim(),
        sourceText: bodyText.slice(0, 8000).trim(), // Condiciones completas
        sourceUrl: SOURCE_URL,
        discount: String(discountInfo.value),
        discountType: discountInfo.type,
        segment: segmentedDiscounts.length === 1 ? segmentedDiscounts[0].segment : undefined,
        cap: capInfo?.value,
        capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
        capTarget: capInfo?.target,
        minPurchase: minPurchase ?? undefined,
        stackable,
        singleUse,
        validFrom,
        validUntil,
        specificDates: specificDates?.length ? specificDates : undefined,
        validDays,
        bankNames: bankNames.length > 0 ? bankNames : undefined,
        walletNames: walletNames.length > 0 ? walletNames : undefined,
        cardNetworkName: cardNetwork,
        cardType,
        paymentChannel,
        accountType,
        provinces,
        storeName: 'Coto',
        categoria: 'Supermercados',
      });
    }

    console.log(`[Coto Scraper V3] Encontradas ${promos.length} promos`);
    return promos;
  },
};

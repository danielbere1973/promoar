import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://coto.com.ar/legales/';

// Helper: simulate matchAll without requiring --downlevelIteration
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
const DAY_NAMES: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
  'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6,
};

function parseSpanishDate(dayNum: string, monthName: string, year?: string): string | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  const y = year ? parseInt(year) : new Date().getFullYear();
  return `${y}-${String(month).padStart(2, '0')}-${String(parseInt(dayNum)).padStart(2, '0')}`;
}

function extractDates(text: string): { validFrom?: string; validUntil?: string; specificDates?: string[] } {
  const t = text.toUpperCase();
  const currentYear = new Date().getFullYear();
  const specificMatches: string[] = [];

  // Capturamos el bloque de vigencia primario
  const blockMatch = text.match(/(?:V[AÁ]LID[AO]|VIGENCIA|VIGENTE)[^.]*?(?:EL?|LOS?)\s+D[ÍI]AS?\s+([^.]{5,100})/i);
  if (blockMatch) {
    const blockText = blockMatch[1].toUpperCase();
    const monthMatches = execAll(/(\d{1,2})(?:\s+Y\s+(\d{1,2}))?\s+DE\s+(\w+)(?:\s+DE\s+(\d{4}))?/gi, blockText);
    for (const m of monthMatches) {
      const monthName = m[3].toLowerCase();
      const month = MONTHS[monthName];
      if (month) {
        const y = m[4] ? parseInt(m[4]) : currentYear;
        // First day
        const iso1 = `${y}-${String(month).padStart(2, '0')}-${String(parseInt(m[1])).padStart(2, '0')}`;
        if (!specificMatches.includes(iso1)) specificMatches.push(iso1);
        // Second day if "X Y Y"
        if (m[2]) {
          const iso2 = `${y}-${String(month).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`;
          if (!specificMatches.includes(iso2)) specificMatches.push(iso2);
        }
      }
    }
    // Simple numbers followed by comma or "y" before a "DE [MES]"
    // e.g. "11, 12 Y 13 DE MAYO"
    const multiDayMatch = blockText.match(/((?:\d{1,2}(?:\s*,\s*|\s+Y\s+))+\d{1,2})\s+DE\s+(\w+)/i);
    if (multiDayMatch) {
      const days = multiDayMatch[1].split(/[,y]/i).map(d => d.trim()).filter(Boolean);
      const monthName = multiDayMatch[2].toLowerCase();
      const month = MONTHS[monthName];
      if (month) {
        for (const d of days) {
          const iso = `${currentYear}-${String(month).padStart(2, '0')}-${String(parseInt(d)).padStart(2, '0')}`;
          if (!specificMatches.includes(iso)) specificMatches.push(iso);
        }
      }
    }
  }

  // Check if it's a range "DESDE EL X DE MES (AL|HASTA EL) Y DE MES DE AÑO"
  const rangeMatch = text.match(/(?:DESDE EL|DEL)\s+(\d{1,2})(?:\s+DE)?\s+(\w+)(?:\s+(?:DE)?\s*(\d{4}))?\s+(?:AL|HASTA\s+EL)\s+(\d{1,2})(?:\s+DE)?\s+(\w+)(?:\s+(?:DE)?\s*(\d{4}))?/i);
  if (rangeMatch) {
    const y1 = rangeMatch[3] ? parseInt(rangeMatch[3]) : currentYear;
    const y2 = rangeMatch[6] ? parseInt(rangeMatch[6]) : currentYear;
    const from = parseSpanishDate(rangeMatch[1], rangeMatch[2], String(y1));
    const until = parseSpanishDate(rangeMatch[4], rangeMatch[5], String(y2));

    return { validUntil: until || undefined, specificDates: specificMatches.length > 0 ? specificMatches : undefined };
  }

  // Check for numeric range "VÁLIDO DEL DD/MM/AA AL DD/MM/AA"
  const numericRangeMatch = text.match(/(?:V[AÁ]LIDO|VIGENCIA|DEL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
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
      specificDates: specificMatches.length > 0 ? specificMatches : undefined 
    };
  }

  // Check for lists of numeric dates "VÁLIDA PARA LOS LUNES 06/04/2026, 13/04/2026 Y 27/04/2026"
  const numericListMatch = text.match(/(?:V[AÁ]LIDA PARA LOS [^0-9]*)((?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?:\s*,\s*|\s+Y\s+))+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (numericListMatch) {
    const dates = numericListMatch[1].split(/[,y]/i).map(d => d.trim()).filter(Boolean);
    for (const d of dates) {
      const parts = d.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2] || String(currentYear);
      if (year.length === 2) year = '20' + year;
      const iso = `${year}-${month}-${day}`;
      if (!specificMatches.includes(iso)) specificMatches.push(iso);
    }
  }

  return { specificDates: specificMatches.length > 0 ? specificMatches : undefined };
}

function extractDiscount(text: string): { value: number; type: string } | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:DE\s+)?(?:DESCUENTO|AHORRO|REINTEGRO|REEMBOLSO|BONIFICACI[OÓ]N)/i);
  if (match) {
    const v = parseFloat(match[1]);
    const keyword = match[0].toUpperCase();
    const type = keyword.includes('DESCUENTO') ? 'PERCENTAGE_DESCUENTO' : 'PERCENTAGE_REINTEGRO';
    return { value: v, type };
  }
  return null;
}

function extractCap(text: string): { value: number; target?: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION'; period?: 'WEEKLY' | 'MONTHLY' | 'DAILY' } | null {
  // "TOPE DE REINTEGRO: $15.000", "TOPE MENSUAL $20.000", "TOPE DE DEVOLUCIÓN $13.000"
  const match = text.match(/TOPE[^$\n]*\$\s*([\d.,]+)/i);
  if (match) {
    const val = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    const t = text.toUpperCase();
    let target: 'USER' | 'CARD' | 'ACCOUNT' | 'TRANSACCION' | undefined;
    let period: 'WEEKLY' | 'MONTHLY' | 'DAILY' | undefined;

    if (t.includes('USUARIO') || t.includes('CLIENTE')) target = 'USER';
    else if (t.includes('TARJETA')) target = 'CARD';
    else if (t.includes('CUENTA')) target = 'ACCOUNT';
    else if (t.includes('TRANSACCI') || t.includes('OPERACI')) target = 'TRANSACCION';

    if (t.includes('SEMANAL') || t.includes('POR SEMANA')) period = 'WEEKLY';
    else if (t.includes('MENSUAL') || t.includes('POR MES')) period = 'MONTHLY';
    else if (t.includes('DIARIO') || t.includes('POR DIA')) period = 'DAILY';

    return { value: val, target, period };
  }
  return null;
}

function extractMinPurchase(text: string): number | null {
  // "COMPRAS A PARTIR DE $50.000", "MONTO MÍNIMO DE COMPRA $60.000", "COMPRA MÍNIMA $60.000"
  const match = text.match(/(?:COMPRAS?\s+(?:A PARTIR DE|DESDE|MAYOR(?:ES)?\s+O\s+IGUAL(?:ES)?\s+A|M[ÍI]NIM[OA](?:\s+DE\s+COMPRA)?)|MONTO\s+M[ÍI]NIM[OA]\s+DE\s+COMPRA|CONSUMO\s+M[ÍI]NIM[OA])\s+\$\s*([\d.,]+)/i);
  if (match) {
    return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }
  return null;
}

function extractValidDays(text: string): number {
  const t = text.toLowerCase();
  const DAYS_ORDER = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado'];
  const DAY_TO_BIT = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6 };

  // 1. Detección de rangos: "lunes a jueves", "jueves a domingo", etc.
  const rangeMatch = t.match(/(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+(?:a|hasta)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i);
  if (rangeMatch) {
    const startIdx = DAY_TO_BIT[rangeMatch[1] as keyof typeof DAY_TO_BIT];
    const endIdx = DAY_TO_BIT[rangeMatch[2] as keyof typeof DAY_TO_BIT];
    let mask = 0;
    
    if (startIdx <= endIdx) {
      for (let i = startIdx; i <= endIdx; i++) mask |= (1 << i);
    } else {
      // Rango que cruza el fin de semana (ej: viernes a lunes)
      for (let i = startIdx; i <= 6; i++) mask |= (1 << i);
      for (let i = 0; i <= endIdx; i++) mask |= (1 << i);
    }
    return mask;
  }

  let mask = 0;
  if (t.includes('domingo')) mask |= (1 << 0);
  if (t.includes('lunes')) mask |= (1 << 1);
  if (t.includes('martes')) mask |= (1 << 2);
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= (1 << 3);
  if (t.includes('jueves')) mask |= (1 << 4);
  if (t.includes('viernes')) mask |= (1 << 5);
  if (t.includes('sábado') || t.includes('sabado')) mask |= (1 << 6);
  if (t.includes('fin de semana')) mask |= (1 << 6) | (1 << 0); // sáb + dom

  // Si encontramos días específicos (aunque no sean un rango explícito), los usamos
  if (mask > 0) return mask;

  // Caso especial Jubilados
  if (t.includes('jubilad') || t.includes('pensionad')) return (1 << 4);

  // Fallback "todos los días"
  if (t.includes('todos los días') || t.includes('todos los dias') || t.includes('de lunes a sábado') || t.includes('de lunes a sabado')) return 127;
  
  return 127; // Default
}

function extractPaymentChannel(text: string): string {
  const t = text.toUpperCase();
  const hasNFC = t.includes('"NFC"') || t.includes('CONTACTLESS') || t.includes('SIN CONTACTO') || t.includes('APPLE PAY') || t.includes('GOOGLE PAY');
  const hasQR = t.includes('QR') || (t.includes('ESCANEANDO') && t.includes('CÓDIGO'));
  if (hasNFC && !hasQR) return 'NFC';
  if (hasQR && !hasNFC) return 'QR';
  return 'ANY';
}

function extractAccountType(text: string): string {
  const t = text.toUpperCase();
  if (t.includes('JUBILAD') || t.includes('PENSIONAD')) return 'JUBILADO';
  if (t.includes('SUELDO') || t.includes('HABERES') || t.includes('PLAN SUELDO') || t.includes('COBRANDO HABERES')) return 'HABERES';
  if (t.includes('ANSES') || t.includes('BENEFICIARIOS ANSES')) return 'ANSES';
  return 'ANY';
}

function extractWalletNames(text: string): string[] {
  const t = text.toUpperCase();
  const wallets = [];
  if (t.includes('MERCADO PAGO') || t.includes('MERCADOPAGO')) wallets.push('Mercado Pago');
  if (t.includes('MODO')) wallets.push('MODO');
  if (t.includes('CUENTA DNI')) wallets.push('Cuenta DNI');
  if (t.includes('PERSONAL PAY')) wallets.push('Personal Pay');
  if (t.includes('NARANJA X') && (t.includes('APP') || t.includes('BILLETERA'))) wallets.push('Naranja X');
  return wallets;
}

function extractProvinces(text: string): string[] {
  const t = text.toUpperCase()
    .replace(/BS\.?\s?AS\.?/g, 'BUENOS AIRES')
    .replace(/C\.?A\.?B\.?A\.?/g, 'CABA');
  
  const allProvinces = [
    'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
  ];
  
  const found = allProvinces.filter(p => {
    const norm = p.toUpperCase()
      .replace(/[Á]/g, 'A').replace(/[É]/g, 'E').replace(/[Í]/g, 'I').replace(/[Ó]/g, 'O').replace(/[Ú]/g, 'U');
    return t.includes(norm);
  });

  if (found.length > 0) return found;

  if (t.includes('TODA LA REPÚBLICA ARGENTINA') || t.includes('TODAS LAS SUCURSALES') || t.includes('ÁMBITO NACIONAL')) {
    return ['Todas'];
  }
  
  return ['Todas']; // Default for Coto
}

function extractBankNames(text: string): string[] {
  const banks: string[] = [];
  // Buscar lista de bancos tras patrones comunes
  const listPatterns = [
    /EMITIDAS? POR(?:\s+LOS SIGUIENTES BANCOS)?[:]\s*([^.]+)/gi,
    /PARA APPLE PAY:\s*([^.]+?)(?:PARA GOOGLE PAY|PARA MODO|\.)/gi,
    /PARA GOOGLE PAY:\s*([^.]+?)(?:PARA MODO|PARA APPLE|BILLETERAS|\.)/gi,
    /PARA MODO[^:]*:\s*([^.]+?)(?:BILLETERAS|DURANTE|\.)/gi,
    /SIGUIENTES BANCOS SELECCIONADOS:\s*([^.]+)/gi,
  ];

  const allNames = new Set<string>();
  for (const pattern of listPatterns) {
    const matches = execAll(pattern, text);
    for (const m of matches) {
      const chunk = m[1];
      // Split by common delimiters and filter known bank keywords
      const parts = chunk.split(/[,;]/);
      for (const part of parts) {
        const cleaned = part.trim()
          .replace(/\s*\d+[,.]?\d*\s*(?:CUOTAS?|SIN)?.*/i, '') // remove trailing text
          .replace(/^(Y|E)\s+/i, '')
          .trim();
        if (cleaned.length > 3 && cleaned.match(/BANCO|BRUBANK|NARANJA|RIPIO|POMELO|PATAGONIA|SUPERVIELLE|COMAFI|CITY|GALICIA|MACRO|BBVA|ICBC|CIUDAD|SANTANDER|HIPOTECARIO|CREDICOOP|BNA|NACION|SUPERVIELLE|COLUMBIA|COMAFI|ENTRE RÍOS|ENTRE RIOS|SANTA FE|SAN JUAN|SANTA CRUZ|CORRIENTES/i)) {
          // Normalize bank name: keep "BANCO X" or just "X"
          const bankName = cleaned
            .replace(/TARJETAS?\s+(?:VISA|MASTERCARD|AMERICAN EXPRESS|CABAL)\s*/gi, '')
            .replace(/\s+Y\s*$/i, '')
            .trim();
          if (bankName.length > 2) allNames.add(bankName);
        }
      }
    }
  }
  
  // Single bank mention "BANCO ICBC", "BANCO CIUDAD" etc  
  if (allNames.size === 0) {
    const singleBank = text.match(/(?:BANCO|BBVA|BRUBANK|NARANJA X)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ\s]+(?:S\.A\.)?/i);
    if (singleBank) allNames.add(singleBank[0].trim().replace(/S\.A\..*/, '').trim());
  }

  return Array.from(allNames).map(n => n.trim()).filter(n => n.length > 2);
}

function extractCardType(text: string): string | null {
  const t = text.toUpperCase();
  if (t.includes('TODOS LOS MEDIOS DE PAGO')) return null;
  if (t.includes('TARJETAS? DE CR[EÉ]DITO') || t.includes('TARJETA DE CRÉDITO') || t.includes('TARJETA DE CREDITO')) return 'CREDIT';
  if (t.includes('TARJETAS? DE D[EÉ]BITO') || t.includes('TARJETA DE DÉBITO') || t.includes('TARJETA DE DEBITO')) return 'DEBIT';
  if (t.includes('PREPAGA') || t.includes('PREPAID')) return 'PREPAID';
  // Check title keywords
  if (text.toUpperCase().includes('CRÉDITO') || text.toUpperCase().includes('CREDITO')) return 'CREDIT';
  if (text.toUpperCase().includes('DÉBITO') || text.toUpperCase().includes('DEBITO')) return 'DEBIT';
  return 'CREDIT';
}

function extractCardNetwork(text: string): string | null {
  const t = text.toUpperCase();
  if (t.includes('TODOS LOS MEDIOS DE PAGO')) return null;
  if (t.includes('MASTERCARD') && t.includes('VISA')) return null; // Both — don't restrict
  if (t.includes('MASTERCARD')) return 'MASTERCARD';
  if (t.includes('VISA')) return 'VISA';
  if (t.includes('CABAL')) return 'CABAL';
  if (t.includes('AMERICAN EXPRESS') || t.includes('AMEX')) return 'AMERICAN EXPRESS';
  if (t.includes('MAESTRO')) return 'MAESTRO';
  return null;
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
    
    // Extraemos todo el texto de la página
    const fullText = $('body').text();

    // Dividimos por el patrón ** TITULO ** que Coto usa como separador de promos
    // El título está entre ** (puede tener espacios internos)
    const titlePattern = /\*\*\s*([^*]+?)\s*\*\*/g;
    const matches = execAll(titlePattern, fullText);

    const promos: ScrapedPromo[] = [];

    for (let i = 0; i < matches.length; i++) {
      const titleMatch = matches[i];
      const title = titleMatch[1].trim();
      
      // Ignoramos títulos demasiado cortos o que son claramente no-promos
      if (title.length < 5 || title.toLowerCase().includes('promo rodados')) continue;

      // El cuerpo de la promo es el texto entre este ** ** y el próximo (o fin de página)
      const start = titleMatch.index! + titleMatch[0].length;
      const end = matches[i + 1] ? matches[i + 1].index! : fullText.length;
      const bodyText = fullText.slice(start, end).trim();

      // Descuento
      const discountInfo = extractDiscount(bodyText) || extractDiscount(title);
      if (!discountInfo) continue; // Si no tiene descuento claro, la ignoramos

      // Fechas
      const { validFrom, validUntil, specificDates } = extractDates(bodyText);
      
      // Tope
      const capInfo = extractCap(bodyText);

      // Mínimo de compra
      const minPurchase = extractMinPurchase(bodyText);

      // Bancos (puede ser múltiples)
      const bankNames = extractBankNames(bodyText);

      // Red de tarjeta
      const cardNetworkName = extractCardNetwork(title) || extractCardNetwork(bodyText) || undefined;

      // Tipo de tarjeta
      const cardType = extractCardType(title + ' ' + bodyText);

      // Días válidos
      const validDays = extractValidDays(title + ' ' + bodyText);

      // Canal de pago
      const paymentChannel = extractPaymentChannel(title + ' ' + bodyText);

      // Billeteras
      const walletNames = extractWalletNames(title + ' ' + bodyText);

      // Provincias
      const provinces = extractProvinces(bodyText);

      promos.push({
        title: title.replace(/\s+/g, ' '),
        description: bodyText.slice(0, 2000).trim(), // Aumentado para evitar cortes
        sourceText: bodyText.slice(0, 6000).trim(),  // Aumentado para referencia completa
        sourceUrl: SOURCE_URL,
        discount: String(discountInfo.value),
        discountType: discountInfo.type,
        cap: capInfo ? capInfo.value : undefined,
        capPeriod: capInfo?.period || (capInfo ? 'MONTHLY' : undefined),
        capTarget: capInfo?.target || undefined,
        minPurchase: minPurchase || undefined,
        stackable,
        validFrom: validFrom,
        validUntil: validUntil,
        specificDates: specificDates && specificDates.length > 0 ? specificDates : undefined,
        validDays,
        bankNames: bankNames.length > 0 ? bankNames : undefined,
        walletNames: walletNames.length > 0 ? walletNames : undefined,
        cardNetworkName,
        cardType,
        paymentChannel,
        accountType,
        provinces,
        storeName: 'Coto',
        categoria: 'Supermercados',
      });
    }

    console.log(`[Coto Scraper V2] Encontradas ${promos.length} promos con título ** **`);
    return promos;
  },
};

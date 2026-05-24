// ChangoMas Scraper V3
// Fuente: https://www.masonline.com.ar/promociones-bancarias
// Nota: ChangoMas fue rebrandeado como "Más Online" (masonline.com.ar)
// Técnica: Playwright (SPA VTEX) — itera banco por banco
// Clase CSS: .valtech-gdn-banks-promotions-0-x-card
//             .valtech-gdn-banks-promotions-0-x-entitiesItem

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { extractProvinces } from './bank-helpers';

const SOURCE_URL = 'https://www.masonline.com.ar/promociones-bancarias';

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
    if (v <= 0 || v > 100) continue;
    const type = /REINTEGRO|REEMBOLSO/.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
    if (!results.find(r => r.value === v && r.type === type)) results.push({ value: v, type });
  }

  const csiMatches = execAll(/(\d+)(?:\s+Y\s+(\d+))?\s+CUOTAS?\s+(?:SIN\s+INTERES|CERO\s+INTERES|SIN\s+INTER)/g, t);
  for (const m of csiMatches) {
    const maxV = Math.max(parseInt(m[1]), m[2] ? parseInt(m[2]) : 0);
    if (!results.find(r => r.value === maxV && r.type === 'CUOTAS_SIN_INTERES'))
      results.push({ value: maxV, type: 'CUOTAS_SIN_INTERES' });
  }

  // Detectar "X cuotas" aunque no diga explícitamente "sin interés"
  // Ej: "4 cuotas" dentro de contexto de 0% CFT
  if (results.length === 0 && /CFT:\s*0%|TNA:\s*0%/i.test(text)) {
    const cuotasMatch = text.match(/(\d+)\s+cuotas/i);
    if (cuotasMatch) {
      const v = parseInt(cuotasMatch[1]);
      if (v >= 2 && v <= 24) results.push({ value: v, type: 'CUOTAS_SIN_INTERES' });
    }
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

  const numericRange = normText.match(
    /(?:DEL?|DESDE\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRange) return { validFrom: parseNumDate(numericRange[1]), validUntil: parseNumDate(numericRange[2]) };

  const simpleRange = normText.match(/\bDEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (simpleRange) {
    const month = MONTHS[simpleRange[3].toLowerCase()];
    const y = simpleRange[4] ? parseInt(simpleRange[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return { validFrom: `${y}-${mm}-${simpleRange[1].padStart(2, '0')}`, validUntil: `${y}-${mm}-${simpleRange[2].padStart(2, '0')}` };
    }
  }

  // Meses sueltos: "abril de 2026"
  const monthOnly = normText.match(/\bDE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (monthOnly) {
    const month = MONTHS[monthOnly[1].toLowerCase()];
    if (month) {
      const y = monthOnly[2] ? parseInt(monthOnly[2]) : currentYear;
      const mm = String(month).padStart(2, '0');
      return { validFrom: `${y}-${mm}-01`, validUntil: `${y}-${mm}-30` };
    }
  }

  return {};
}

function extractBankNames(text: string): string[] {
  const BANKS: [RegExp, string][] = [
    [/HIPOTECARIO/i, 'Banco Hipotecario'],
    [/BANCO\s+NACION|BNA\+?/i, 'Banco de la Nación Argentina'],
    [/\bMACRO\b/i, 'Banco Macro'],
    [/CREDICOOP/i, 'Banco Credicoop'],
    [/GALICIA/i, 'Banco Galicia'],
    [/BANCO\s+CIUDAD/i, 'Banco Ciudad'],
    [/COMAFI/i, 'Banco Comafi'],
    [/SUPERVIELLE/i, 'Banco Supervielle'],
    [/\bBBVA\b/i, 'BBVA'],
    [/SANTANDER/i, 'Banco Santander'],
    [/\bICBC\b/i, 'ICBC'],
    [/PATAGONIA/i, 'Banco Patagonia'],
    [/CORRIENTES/i, 'Banco de Corrientes'],
    [/COLUMBIA/i, 'Banco Columbia'],
    [/PROVINCIA/i, 'Banco Provincia'],
  ];
  const found: string[] = [];
  for (const [re, name] of BANKS)
    if (re.test(text) && !found.includes(name)) found.push(name);
  return found;
}

function extractWalletNames(text: string): string[] {
  const t = normStr(text);
  const wallets: string[] = [];
  if (/MERCADO\s*PAGO|MERCADOPAGO/.test(t)) wallets.push('Mercado Pago');
  if (/\bMODO\b/.test(t)) wallets.push('MODO');
  if (/CUENTA\s+DNI/.test(t)) wallets.push('Cuenta DNI');
  if (/PERSONAL\s+PAY/.test(t)) wallets.push('Personal Pay');
  if (/NARANJA\s+X/.test(t)) wallets.push('Naranja X');
  if (/\bANSES\b/.test(t)) wallets.push('ANSES');
  return wallets;
}

function extractValidDays(text: string): number {
  const t = text.toLowerCase();
  const D: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
  };
  if (/todos los días|lunes a domingo/i.test(t)) return 127;
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
  if (t.includes('lunes')) mask |= 2;
  if (t.includes('martes')) mask |= 4;
  if (t.includes('miércoles') || t.includes('miercoles')) mask |= 8;
  if (t.includes('jueves')) mask |= 16;
  if (t.includes('viernes')) mask |= 32;
  if (t.includes('sábado') || t.includes('sabado')) mask |= 64;
  if (t.includes('fin de semana')) mask |= 65;
  return mask || 127;
}

function extractCap(text: string): { value: number; period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' } | null {
  const t = normStr(text);
  // ChangoMas usa "Tope $X" o "hasta $X"
  const match = t.match(/(?:TOPE|HASTA)\s*\$\s*([\d.,]+)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  if (isNaN(value) || value <= 0) return null;
  let period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | undefined;
  if (/SEMANA/.test(t)) period = 'WEEKLY';
  else if (/MES/.test(t)) period = 'MONTHLY';
  else if (/DIA/.test(t)) period = 'DAILY';
  return { value, period };
}

function extractMinPurchase(text: string): number | null {
  const match = text.match(/(?:M[ÍI]NIMO\s+DE\s+COMPRA|COMPRA\s+M[ÍI]NIMA|A\s+PARTIR\s+DE|M[ÍI]NIMO)\s*:?\s*\$\s*([\d.,]+)/i);
  if (match) return parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

function processBlock(bodyText: string, seenTitles: Set<string>): ScrapedPromo[] {
  if (bodyText.length < 30) return [];
  if (/EXTRA\s+CASH|SERVICIO\s+EXTRA|DESCRIPCION\s+DE\s+SERVICIOS/i.test(bodyText) &&
      !/BANCO|TARJETA|MODO|REINTEGRO|DESCUENTO|\d+%/i.test(bodyText)) return [];

  const discounts = extractDiscounts(bodyText);
  if (discounts.length === 0) return [];

  const bankNames = extractBankNames(bodyText);
  const walletNames = extractWalletNames(bodyText);
  if (bankNames.length === 0 && walletNames.length === 0) return [];

  const { validFrom, validUntil, specificDates } = extractDates(bodyText);
  const capInfo = extractCap(bodyText);
  const minPurchase = extractMinPurchase(bodyText);
  const t = normStr(bodyText);
  const isCredit = /CREDITO/.test(t), isDebit = /DEBITO/.test(t);
  const ct: 'CREDIT' | 'DEBIT' | null = isCredit && isDebit ? null : isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : null;
  const cardNetworks: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
  if (/\bVISA\b/.test(t)) cardNetworks.push({ network: 'Visa', type: ct });
  if (/MASTERCARD/.test(t)) cardNetworks.push({ network: 'Mastercard', type: ct });
  if (/\bCABAL\b/.test(t)) cardNetworks.push({ network: 'Cabal', type: ct });

  const validDays = extractValidDays(bodyText);
  const stackable = /NO\s+ACUMULABLE/i.test(bodyText) ? false : undefined;
  // Construir título descriptivo desde entidades detectadas
  let title: string;
  const allEntities = [...bankNames, ...walletNames];
  if (allEntities.length > 0) {
    const entityStr = allEntities.join(' + ');
    const discStr = discounts.map(d => d.type.includes('CUOTAS') ? `${d.value} CSI` : `${d.value}%`).join('/');
    // Extraer día(s) del texto para el título
    const dayMatches: string[] = [];
    if (/lunes/i.test(bodyText)) dayMatches.push('lunes');
    if (/martes/i.test(bodyText)) dayMatches.push('martes');
    if (/miércoles|miercoles/i.test(bodyText)) dayMatches.push('miércoles');
    if (/jueves/i.test(bodyText)) dayMatches.push('jueves');
    if (/viernes/i.test(bodyText)) dayMatches.push('viernes');
    if (/sábado|sabado/i.test(bodyText)) dayMatches.push('sábados');
    if (/domingo/i.test(bodyText)) dayMatches.push('domingos');
    const daysStr = dayMatches.length > 0 && dayMatches.length < 7 ? ` - ${dayMatches.join(', ')}` : '';
    title = `${entityStr} - ${discStr}${daysStr}`;
  } else {
    const titleMatch = bodyText.match(/^([^\n.]{10,80})/);
    title = (titleMatch ? titleMatch[1].trim() : bodyText.slice(0, 60).trim());
  }
  title = title.replace(/\s+/g, ' ').trim();

  const dedupeKey = `${title}|${discounts.map(d => d.value + d.type).join(',')}`;
  if (seenTitles.has(dedupeKey)) return [];
  seenTitles.add(dedupeKey);

  return discounts.map(disc => ({
    title,
    description: title,
    sourceText: bodyText.slice(0, 8000),
    sourceUrl: SOURCE_URL,
    discount: String(disc.value),
    discountType: disc.type as any,
    cap: capInfo?.value,
    capPeriod: capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
    capTarget: capInfo ? 'USER' : null,
    minPurchase: minPurchase ?? undefined,
    stackable,
    singleUse: undefined,
    validFrom, validUntil, specificDates,
    validDays,
    bankNames: bankNames.length > 0 ? bankNames : undefined,
    walletNames: walletNames.length > 0 ? walletNames : undefined,
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    cardType: null,
    paymentChannel: /\bQR\b|\bMODO\b/.test(normStr(bodyText)) ? 'QR' : 'ANY' as any,
    accountType: /ANSES|AUH/i.test(bodyText) ? 'ANSES' : /JUBILAD|PENSIONAD/i.test(bodyText) ? 'JUBILADO' : 'ANY' as any,
    storeName: 'ChangoMas',
    categoria: 'Supermercados',
    provinces: extractProvinces(bodyText),
  }));
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────
export const ChangoMasScraper: Scraper = {
  name: 'ChangoMas',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[ChangoMas] Iniciando scraper V3 (masonline.com.ar)...');
    const browser = await chromium.launch({ headless: true });
    const promos: ScrapedPromo[] = [];
    const seenTitles = new Set<string>();

    try {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();

      console.log('[ChangoMas] Navegando a', SOURCE_URL);
      await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(5000);

      // Obtener texto de todas las cards visibles en vista inicial (Por Día)
      const CARD_SEL = '.valtech-gdn-banks-promotions-0-x-cardBox';
      const BANK_BTN_SEL = '.valtech-gdn-banks-promotions-0-x-entitiesItem';

      // Esperar a que aparezcan las cards
      await page.waitForSelector(CARD_SEL, { timeout: 15000 }).catch(() =>
        console.warn('[ChangoMas] Selector de cards no encontrado, intentando con fallback')
      );

      // Función helper para extraer texto de todas las cards visibles
      const extractCards = async (label: string) => {
        const cardTexts: string[] = await page.$$eval(CARD_SEL, els =>
          els.map(el => (el as HTMLElement).innerText?.trim() ?? '')
        ).catch(() => []);

        for (const cardText of cardTexts) {
          const found = processBlock(cardText, seenTitles);
          for (const p of found) {
            promos.push(p);
            console.log(`[ChangoMas] ✅ [${label}] "${p.title.slice(0, 50)}" → ${p.discount} ${p.discountType}`);
          }
        }
      };

      // Primera extracción: vista inicial (Por Día)
      await extractCards('Por Día');

      // Obtener lista de bancos/entidades del filtro
      const bankButtons = await page.$$(BANK_BTN_SEL).catch(() => []);
      console.log(`[ChangoMas] Botones de banco encontrados: ${bankButtons.length}`);

      // Iterar cada botón de banco
      for (let i = 0; i < bankButtons.length; i++) {
        try {
          const buttons = await page.$$(BANK_BTN_SEL);
          if (i >= buttons.length) break;
          const btnLabel = await buttons[i].innerText().catch(() => `banco-${i}`);
          await buttons[i].click();
          await page.waitForTimeout(2000);
          await extractCards(btnLabel.trim());
        } catch (e) {
          console.warn(`[ChangoMas] Error en botón ${i}:`, e);
        }
      }

      // Fallback: si no se encontraron cards por selector, usar texto completo
      if (promos.length === 0) {
        console.warn('[ChangoMas] No se encontraron cards por selector CSS, usando texto completo como fallback');
        const fullText = await page.evaluate(() => document.body.innerText).catch(() => '');
        if (fullText.length > 300) {
          // Dividir por saltos dobles de línea
          const blocks = fullText.split(/\n{2,}/).filter(b => b.length > 50);
          for (const block of blocks) {
            const found = processBlock(block, seenTitles);
            promos.push(...found);
          }
        }
      }

    } finally {
      await browser.close();
    }

    console.log(`[ChangoMas Scraper V3] ${promos.length} promos encontradas`);
    return promos;
  },
};

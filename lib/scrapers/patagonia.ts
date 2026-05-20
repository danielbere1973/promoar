// Banco Patagonia Scraper V3
// Fuente: https://ahorrosybeneficios.bancopatagonia.com.ar/ahorrosybeneficios/
// Técnica: HTTP puro + parsing HTML estructurado (Magento)
// Cada promo tiene clases CSS específicas con todos los datos

import { Scraper, ScrapedPromo } from './types';
import { dedup, extractDates } from './bank-helpers';

const BASE_URL  = 'https://ahorrosybeneficios.bancopatagonia.com.ar/ahorrosybeneficios';
const JS_URL    = 'https://ahorrosybeneficios.bancopatagonia.com.ar/pub/media/mageplaza/search/ahorrosybeneficios_0.js';
const BANK_NAME = 'Banco Patagonia';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html',
};

function attr(html: string, tag: string, attrName: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*${attrName}="([^"]*)"`, 'i'));
  return m ? m[1].trim() : '';
}

function tagText(html: string, selector: string): string {
  const m = html.match(new RegExp(`class="${selector}"[^>]*>([^<]*)<`, 'i'));
  if (m) return m[1].trim();
  // try with extra attributes
  const m2 = html.match(new RegExp(`class='${selector}'[^>]*>([^<]*)<`, 'i'));
  return m2 ? m2[1].trim() : '';
}

function extractByClass(html: string, className: string): string {
  const re = new RegExp(`class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)<\/div>`, 'i');
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function parsePercentage(html: string): number | null {
  const m = html.match(/list-benef-price-percentage[^>]*>([\s\S]*?)<span>%<\/span>/i);
  if (!m) return null;
  const num = m[1].replace(/<[^>]+>/g, '').trim();
  const v = parseFloat(num);
  return v > 0 && v <= 100 ? v : null;
}

function parseCuotas(html: string): number | null {
  const m = html.match(/col-data-cuota[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  const c = text.match(/(\d+)\s*(?:cuotas?|csi)/i);
  return c ? parseInt(c[1]) : null;
}

function parseCap(blockHtml: string): number | null {
  const m = blockHtml.match(/data-th="Tope">Tope:\s*\$([\d.,]+)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
}

function parseCards(blockHtml: string): Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> {
  const nets: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
  const walletNames: string[] = [];
  const imgMatches = blockHtml.matchAll(/<img[^>]*alt="([^"]+)"[^>]*>/gi);
  for (const m of imgMatches) {
    const alt = m[1].trim();
    const lower = alt.toLowerCase();
    if (lower.includes('modo'))                    walletNames.push('MODO');
    else if (lower.includes('mercado pago'))       walletNames.push('MercadoPago');
    else if (lower.includes('visa') && lower.includes('déb')) nets.push({ network: 'Visa', type: 'DEBIT' });
    else if (lower.includes('visa'))               nets.push({ network: 'Visa', type: 'CREDIT' });
    else if (lower.includes('mastercard') && lower.includes('déb')) nets.push({ network: 'Mastercard', type: 'DEBIT' });
    else if (lower.includes('mastercard'))         nets.push({ network: 'Mastercard', type: 'CREDIT' });
    else if (lower.includes('amex') || lower.includes('american express')) nets.push({ network: 'American Express Banco', type: 'CREDIT' });
    else if (lower.includes('cabal'))              nets.push({ network: 'Cabal', type: null });
  }
  return nets;
}

function parseWallets(blockHtml: string): string[] {
  const wallets: string[] = [];
  const imgMatches = blockHtml.matchAll(/<img[^>]*alt="([^"]+)"[^>]*>/gi);
  for (const m of imgMatches) {
    const alt = m[1].toLowerCase();
    if (alt.includes('modo') && !wallets.includes('MODO'))               wallets.push('MODO');
    if (alt.includes('mercado pago') && !wallets.includes('MercadoPago')) wallets.push('MercadoPago');
    if ((alt.includes('google pay') || alt.includes('gpay')) && !wallets.includes('GPay')) wallets.push('GPay');
    if (alt.includes('apple pay') && !wallets.includes('Apple Pay'))     wallets.push('Apple Pay');
  }
  return wallets;
}

function parseValidDays(diasText: string): number {
  const t = diasText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/todos los dias|lunes a domingo/.test(t)) return 127;
  const D: Record<string, number> = {
    'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sabado': 6,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(D)) {
    if (t.includes(day)) mask |= 1 << bit;
  }
  return mask || 127;
}

function parseAccountType(destacText: string, skuText: string): 'ANY' | 'HABERES' | 'JUBILADO' {
  const t = (destacText + ' ' + skuText).toLowerCase();
  if (/plan sueldo|haberes|cuenta sueldo/i.test(t) && /jubilad|pensionad/i.test(t)) return 'HABERES';
  if (/plan sueldo|haberes|cuenta sueldo/i.test(t)) return 'HABERES';
  if (/jubilad|pensionad/i.test(t)) return 'JUBILADO';
  return 'ANY';
}

function detectCategoria(storeName: string, categoryAlt: string): string {
  const text = (storeName + ' ' + categoryAlt).toLowerCase();
  if (/super|mercado|hipermercado|coto|jumbo|carrefour|disco|dia\b/.test(text)) return 'Supermercados';
  if (/combustible|nafta|ypf|shell|axion/.test(text)) return 'Combustible';
  if (/gastronom|restauran|comida|cafe|delivery|food/.test(text)) return 'Gastronomía';
  if (/farmacia|drogueria|salud/.test(text)) return 'Farmacias';
  if (/indumentaria|ropa|moda|calzado|zapateria/.test(text)) return 'Indumentaria';
  if (/tecnolog|electro|celular|computadora/.test(text)) return 'Tecnología';
  if (/mascota|petshop|veterinaria/.test(text)) return 'Mascotas';
  if (/transporte|taxi|remis|colectivo|subte/.test(text)) return 'Transporte';
  if (/heladeria/.test(text)) return 'Heladerías';
  if (/hogar|mueble|deco|ferreteria/.test(text)) return 'Hogar';
  if (/cine|teatro|entretenimiento|espectaculo/.test(text)) return 'Entretenimiento';
  if (/belleza|peluqueria|estetica|cosmet/.test(text)) return 'Salud y Belleza';
  if (/deporte|gimnasio|fitness/.test(text)) return 'Deportes';
  if (/juguete/.test(text)) return 'Jugueterías';
  if (/libreria|libro/.test(text)) return 'Librerías';
  if (/viaje|turismo|hotel|aero|vuelo/.test(text)) return 'Viajes y Turismo';
  if (/shopping|paseo|mall/.test(text)) return 'Shoppings';
  if (/auto|vehiculo|taller|neumatico/.test(text)) return 'Automotores';
  return 'Otros';
}

const SEGMENT_CLASSES = [
  { cls: 'list-benef1', name: 'Patagonia Clásica', spanCls: 'misc-clasica' },
  { cls: 'list-benef2', name: 'Patagonia Plus',    spanCls: 'misc-plus' },
  { cls: 'list-benef3', name: 'Patagonia Singular', spanCls: 'misc-singular' },
];

async function fetchPromoPage(slug: string, storeName: string): Promise<ScrapedPromo[]> {
  const url = `${BASE_URL}/${slug}`;
  try {
    const res  = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const html = await res.text();

    // Título
    const titleM = html.match(/class="name">([^<]+)<\/div>/i);
    const title  = titleM ? titleM[1].trim() : storeName;

    // Días y vigencia
    const diasM   = html.match(/class="dias">([^<]+)<\/div>/i);
    const vigM    = html.match(/class="vigencia">\s*([^<]+)\s*<\/div>/i);
    const validDays = parseValidDays(diasM ? diasM[1] : '');
    const { validFrom, validUntil } = extractDates(vigM ? vigM[1] : '');

    // Account type
    const destacM   = html.match(/class="grilla-destaque">([^<]+)<\/div>/i);
    const skuM      = html.match(/itemprop="sku">([^<]+)<\/div>/i);
    const accountType = parseAccountType(destacM ? destacM[1] : '', skuM ? skuM[1] : '');
    const destacText  = destacM ? destacM[1].toLowerCase() : '';
    const globalNFC   = /nfc|sin contacto|contactless/i.test(destacText);
    const globalQR    = /qr|codigo qr|modo/i.test(destacText);

    // Redes detectadas desde el grilla-destaque (ej: "Exclusivo TC Visa pagando con NFC")
    const destacNets: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];
    if (/\bvisa\b/i.test(destacText)) destacNets.push({ network: 'Visa', type: /d[eé]b/i.test(destacText) ? 'DEBIT' : 'CREDIT' });
    if (/mastercard/i.test(destacText)) destacNets.push({ network: 'Mastercard', type: /d[eé]b/i.test(destacText) ? 'DEBIT' : 'CREDIT' });
    if (/amex|american express/i.test(destacText)) destacNets.push({ network: 'American Express Banco', type: 'CREDIT' });

    // Logo de la promo
    const logoM = html.match(/class="gallery-placeholder__image"[^>]*src="([^"]+)"/i);
    const storeLogoUrl = logoM ? logoM[1] : undefined;

    // Categoría desde íconos
    const catImgM = html.match(/class="product-categories">([\s\S]*?)<\/div>/i);
    const catAlt  = catImgM ? (catImgM[1].match(/alt="([^"]+)"/i)?.[1] || '') : '';
    const categoria = detectCategoria(storeName, catAlt);

    // Legales completos desde #popup-modal
    const popupM = html.match(/<div[^>]*id="popup-modal"[^>]*>([\s\S]*?)<\/div>/i);
    const fullLegal = popupM ? popupM[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim() : '';

    // Tipo de descuento desde legales
    const legales = html.replace(/<[^>]+>/g, ' ');
    const isReintegro = /reintegro|reembolso/i.test(legales);
    const discountType = isReintegro ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';

    const promos: ScrapedPromo[] = [];

    // Extraer todos los bloques list-benef-N (número variable)
    const allBlocks: Array<{ block: string; segName: string }> = [];
    const allBlocksRe = /class="list-benef list-benef\d+"[\s\S]*?(?=class="list-benef list-benef\d+"|$)/gi;
    let bm: RegExpExecArray | null;
    while ((bm = allBlocksRe.exec(html)) !== null) {
      const b = bm[0];
      // Un bloque puede tener 1 o varios segmentos combinados
      if (/misc-clasica/i.test(b)) allBlocks.push({ block: b, segName: 'Patagonia Clásica' });
      if (/misc-plus/i.test(b))    allBlocks.push({ block: b, segName: 'Patagonia Plus' });
      if (/misc-singular/i.test(b)) allBlocks.push({ block: b, segName: 'Patagonia Singular' });
    }

    // Iterar segmentos encontrados
    for (const { block, segName: segmentName } of allBlocks) {
      const seg = SEGMENT_CLASSES.find(s => s.name === segmentName);
      if (!seg) continue;

      const pct     = parsePercentage(block);
      const cuotas  = parseCuotas(block);
      if (!pct && !cuotas) continue;

      const cap     = parseCap(block);
      const blockNets = parseCards(block);
      const nets = blockNets.length > 0 ? blockNets : destacNets;
      const wallets = parseWallets(block);

      const base: Partial<ScrapedPromo> = {
        storeName:     title,
        description:   title,
        sourceText:    fullLegal || title,
        sourceUrl:     url,
        validFrom,
        validUntil,
        validDays,
        cap:           cap ?? null,
        capPeriod:     cap ? 'MONTHLY' : undefined,
        bankNames:     [BANK_NAME],
        cardNetworks:  nets.length > 0 ? nets : undefined,
        walletNames:   wallets.length > 0 ? wallets : undefined,
        categoria,
        paymentChannel: globalNFC ? 'NFC' : globalQR ? 'QR' : 'ANY',
        segment:       segmentName,
        accountType,
        storeLogoUrl,
      };

      if (pct) {
        promos.push({
          ...base,
          title:        `${pct}% ${isReintegro ? 'reintegro' : 'descuento'} – ${title} (${segmentName})`,
          discount:     String(pct),
          discountType: discountType as any,
        } as ScrapedPromo);
      }
      if (cuotas) {
        promos.push({
          ...base,
          title:        `${cuotas} cuotas sin interés – ${title} (${segmentName})`,
          discount:     String(cuotas),
          discountType: 'CUOTAS_SIN_INTERES' as any,
        } as ScrapedPromo);
      }
    }

    // Fallback si no hay segmentos estructurados
    if (promos.length === 0) {
      const pctM = legales.match(/(\d+)\s*%\s*(?:de\s+)?(?:descuento|reintegro|reembolso)/i);
      if (pctM) {
        const pct = parseFloat(pctM[1]);
        const nets = parseCards(html);
        const wallets = parseWallets(html);
        promos.push({
          storeName: title, title: `${pct}% ${isReintegro ? 'reintegro' : 'descuento'} – ${title}`,
          description: title, sourceText: title, sourceUrl: url,
          discount: String(pct), discountType: discountType as any,
          validFrom, validUntil, validDays, cap: null,
          bankNames: [BANK_NAME], cardNetworks: nets.length > 0 ? nets : undefined,
          walletNames: wallets.length > 0 ? wallets : undefined,
          categoria, paymentChannel: 'ANY', accountType, storeLogoUrl,
        } as ScrapedPromo);
      }
    }

    return promos;
  } catch {
    return [];
  }
}

export const PatagoniaScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Patagonia] Iniciando scraper V3 (HTML estructurado)...');

    const jsRes  = await fetch(JS_URL, { headers: HEADERS });
    const jsText = await jsRes.text();
    const match  = jsText.match(/mp_products_search = (\[[\s\S]*?\]);/);
    if (!match) { console.error('[Patagonia] No se pudo parsear el JS'); return []; }

    const items: Array<{ value: string; u: string }> = JSON.parse(match[1]);
    console.log(`[Patagonia] ${items.length} promos en el JS`);

    const BATCH = 15;
    const allPromos: ScrapedPromo[] = [];

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(item => fetchPromoPage(item.u, item.value.trim()))
      );
      for (const r of results) allPromos.push(...r);
      process.stdout.write(`\r  ${Math.min(i + BATCH, items.length)}/${items.length}`);
    }
    console.log();

    const result = dedup(allPromos);
    console.log(`[PatagoniaScraper] Total: ${result.length} promos`);
    return result;
  },
};

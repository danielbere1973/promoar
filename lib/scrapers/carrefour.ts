// Carrefour Scraper V3
// REST API: Master Data BP (Bank Promotions) entity
// Sin Playwright — JSON estructurado con campos exactos

import { Scraper, ScrapedPromo } from './types';
import { extractProvinces } from './bank-helpers';

const SOURCE_URL = 'https://www.carrefour.com.ar/descuentos-bancarios';
const MD_URL = 'https://www.carrefour.com.ar/api/dataentities/BP/search';
const FIELDS = [
  'id', 'title', 'sub_title', 'discount_percentage',
  'discounts_amount_installments', 'discounts_text_installments', 'discount_text_info',
  'img_card', 'img_card_2', 'img_card_3', 'img_card_4', 'img_card_5', 'img_card_6',
  'order', 'active_from', 'active_to', 'active', 'validText',
  'hyper', 'market', 'ecommerce', 'express', 'maxi', 'legal',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
].join(',');

// Mapas de imagen → entidad
const IMG_BANK: Record<string, string> = {
  'bna.png':           'Banco de la Nación Argentina',
  'bbva.png':          'BBVA',
  'galicia.png':       'Banco Galicia',
  'santander.png':     'Banco Santander',
  'macro.png':         'Banco Macro',
  'patagonia.png':                       'Banco Patagonia',
  'patagonia.webp':                      'Banco Patagonia',
  '-_promo-bancaria_patagonia (1).webp': 'Banco Patagonia',
  'supervielle.png':                     'Banco Supervielle',
  'ciudad.png':                          'Banco Ciudad',
  'credicoop.png':                       'Banco Credicoop',
  'icbc.png':                            'ICBC',
  'provincia.png':                       'Banco Provincia de Buenos Aires',
  'hipotecario.png':                     'Banco Hipotecario',
  'comafi.png':                          'Banco Comafi',
  'hsbc.png':                            'HSBC',
  'naranja.png':                         'Naranja X',
  'naranjax-logoxxx.png':               'Naranja X',
};

const IMG_WALLET: Record<string, string> = {
  'mercadopago.png':              'Mercado Pago',
  'mercadopago.webp':             'Mercado Pago',
  'mercado-pago -1.webp':         'Mercado Pago',
  'mercado-pago -1 (1).webp':     'Mercado Pago',
  'logo-modo.png':                'MODO',
  'modo.png':                     'MODO',
  'cuenta-digital.webp':          'Carrefour Banco',
  'cuentadigital.webp':           'Carrefour Banco',
  'credito.png':                  'Carrefour Banco',
  'carrefour-banco.webp':         'Carrefour Banco',
  'carrefour-banco (2).webp':     'Carrefour Banco',
  'carrefour-credito (1).webp':   'Carrefour Banco',
  'cuenta_dni.png':               'Cuenta DNI',
};

const IMG_NETWORK: Record<string, { network: string; type: 'CREDIT' | 'DEBIT' | null }> = {
  'mc.webp':         { network: 'Mastercard', type: 'CREDIT' },
  'mastercard.webp': { network: 'Mastercard', type: 'CREDIT' },
  'visa.webp':       { network: 'Visa', type: 'CREDIT' },
  'visa.png':        { network: 'Visa', type: 'CREDIT' },
  'amex.webp':       { network: 'American Express Banco', type: 'CREDIT' },
  'amex.png':        { network: 'American Express Banco', type: 'CREDIT' },
};

function imgKey(filename: string | null | undefined): string {
  return (filename ?? '').toLowerCase().split('/').pop() ?? '';
}

function parseDays(doc: Record<string, any>): number {
  const map: Record<string, number> = {
    sunday: 1, monday: 2, tuesday: 4, wednesday: 8,
    thursday: 16, friday: 32, saturday: 64,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(map)) {
    if (doc[day] === true || doc[day] === 'true') mask |= bit;
  }
  return mask || 127;
}

function parseCap(subTitle: string | null): { cap: number | null; capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null } {
  if (!subTitle) return { cap: null, capPeriod: null };
  const t = subTitle.toUpperCase();
  if (/SIN\s+TOPE/.test(t)) return { cap: null, capPeriod: null };

  const match = t.match(/TOPE[^$\d]*\$?\s*([\d.,]+)/);
  if (!match) return { cap: null, capPeriod: null };
  const cap = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  if (!cap || cap <= 0) return { cap: null, capPeriod: null };

  let capPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null = null;
  if (/SEMANAL|SEMANA/.test(t)) capPeriod = 'WEEKLY';
  else if (/MENSUAL|MES/.test(t)) capPeriod = 'MONTHLY';
  else if (/DIARIO|DIA/.test(t)) capPeriod = 'DAILY';
  else capPeriod = 'MONTHLY';

  return { cap, capPeriod };
}

function buildStoreNote(doc: Record<string, any>): string {
  const parts: string[] = [];
  if (doc['hyper'])     parts.push('Hipermercados');
  if (doc['market'])    parts.push('Market');
  if (doc['express'])   parts.push('Express');
  if (doc['maxi'])      parts.push('Maxi');
  if (doc['ecommerce']) parts.push('Online');
  return parts.join(', ');
}

async function fetchPromos(): Promise<any[]> {
  const now = new Date().toISOString().slice(0, 19);
  const where = `active=true AND active_from < ${now} AND active_to > ${now}`;
  const url = `${MD_URL}?_schema=mdv1&_fields=${encodeURIComponent(FIELDS)}&_where=${encodeURIComponent(where)}&_sort=order+ASC&_size=999`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': SOURCE_URL,
      'REST-Range': 'resources=0-998',
    },
  });

  if (!res.ok) throw new Error(`Carrefour Master Data HTTP ${res.status}`);
  return res.json();
}

export const CarrefourScraper: Scraper = {
  name: 'Carrefour',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Carrefour] Consultando Master Data BP...');
    const documents = await fetchPromos();
    console.log(`[Carrefour] ${documents.length} promos recibidas`);

    const promos: ScrapedPromo[] = [];

    for (const doc of documents) {
      const title = (doc['title'] ?? '') as string;
      const subTitle = (doc['sub_title'] ?? '') as string;

      // Descuento: porcentaje o cuotas sin interés
      const pct = doc['discount_percentage'] ? parseFloat(String(doc['discount_percentage'])) : null;
      const csiCount = doc['discounts_amount_installments'] ? parseInt(String(doc['discounts_amount_installments'])) : null;

      let discountValue: number | null = null;
      let discountType = 'PERCENTAGE_DESCUENTO';
      let isCsi = false;

      if (csiCount && csiCount > 1) {
        discountValue = csiCount;
        discountType = 'CUOTAS_SIN_INTERES';
        isCsi = true;
      } else if (pct) {
        discountValue = pct;
        discountType = /reintegro|ahorro|cashback|devoluc/i.test(title + subTitle)
          ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      } else {
        // fallback: buscar en título
        const csiMatch = title.match(/(\d+)\s*cuotas?\s+sin\s+inter[eé]s/i);
        if (csiMatch) {
          discountValue = parseInt(csiMatch[1]);
          discountType = 'CUOTAS_SIN_INTERES';
          isCsi = true;
        }
      }

      if (!discountValue) {
        console.log(`[Carrefour] Sin descuento, saltando: ${title.slice(0, 50)}`);
        continue;
      }

      // Fechas
      const validFrom = doc['active_from'] ? new Date(doc['active_from']) : new Date();
      const validUntil = doc['active_to'] ? new Date(doc['active_to']) : null;

      // Días
      const validDays = parseDays(doc);

      // Tope
      const { cap, capPeriod } = parseCap(subTitle);

      // Entidades desde los logos (img_card..img_card_6)
      const imgs = [
        doc['img_card'], doc['img_card_2'], doc['img_card_3'],
        doc['img_card_4'], doc['img_card_5'], doc['img_card_6'],
      ].map(v => imgKey(v));

      const bankNames: string[] = [];
      const walletNames: string[] = [];
      const cardNetworks: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];

      for (const img of imgs) {
        if (!img) continue;
        if (IMG_BANK[img] && !bankNames.includes(IMG_BANK[img])) bankNames.push(IMG_BANK[img]);
        else if (IMG_WALLET[img] && !walletNames.includes(IMG_WALLET[img])) walletNames.push(IMG_WALLET[img]);
        else if (IMG_NETWORK[img]) cardNetworks.push(IMG_NETWORK[img]);
      }

      // Redes desde el título si no se detectaron por imagen
      if (cardNetworks.length === 0) {
        if (/mastercard/i.test(title)) cardNetworks.push({ network: 'Mastercard', type: 'CREDIT' });
        if (/\bvisa\b/i.test(title)) cardNetworks.push({ network: 'Visa', type: 'CREDIT' });
        if (/american\s+express|amex/i.test(title)) cardNetworks.push({ network: 'American Express Banco', type: 'CREDIT' });
      }

      // Bancos/billeteras desde el título y subtítulo como fallback
      if (bankNames.length === 0 && walletNames.length === 0) {
        const searchText = `${title} ${subTitle ?? ''}`;
        if (/mercado\s*pago|dinero\s+en\s+cuenta/i.test(searchText)) walletNames.push('Mercado Pago');
        else if (/\bmodo\b/i.test(searchText)) walletNames.push('MODO');
        else if (/cuenta\s+dni/i.test(searchText)) walletNames.push('Cuenta DNI');
        else if (/club\s+la\s+naci[oó]n/i.test(searchText)) walletNames.push('Club La Nacion');
        else if (/naranja\s*x/i.test(searchText)) bankNames.push('Naranja X');
        else if (/patagonia/i.test(searchText)) bankNames.push('Banco Patagonia');
        else if (/galicia/i.test(searchText)) bankNames.push('Banco Galicia');
        else if (/santander/i.test(searchText)) bankNames.push('Banco Santander');
        else if (/bbva/i.test(searchText)) bankNames.push('BBVA');
        else if (/macro/i.test(searchText)) bankNames.push('Banco Macro');
        else if (/\bbna\b/i.test(searchText)) bankNames.push('Banco de la Nación Argentina');
      }

      if (bankNames.length === 0 && walletNames.length === 0) {
        const unknownImgs = imgs.filter(Boolean).join(', ');
        console.log(`[Carrefour] Sin entidad detectada, saltando: "${title}" | imgs: ${unknownImgs || 'ninguna'}`);
        continue;
      }

      // Canal de pago
      let paymentChannel: 'QR' | 'ANY' = 'ANY';
      if (/\bMODO\b/i.test(title + subTitle) || walletNames.includes('MODO')) paymentChannel = 'QR';

      // Canal de venta
      const storeNote = buildStoreNote(doc);
      const isOnlineOnly = doc['ecommerce'] && !doc['hyper'] && !doc['market'] && !doc['express'] && !doc['maxi'];
      const isFisicaOnly = !doc['ecommerce'] && (doc['hyper'] || doc['market'] || doc['express'] || doc['maxi']);
      const salesChannel: 'ONLINE' | 'FISICA' | null = isOnlineOnly ? 'ONLINE' : isFisicaOnly ? 'FISICA' : null;

      const description = [title, subTitle, storeNote].filter(Boolean).join(' | ');

      promos.push({
        title: title.trim(),
        description,
        sourceText: doc['legal'] ?? '',
        sourceUrl: SOURCE_URL,
        discount: String(discountValue),
        discountType: discountType as any,
        cap,
        capPeriod: capPeriod ?? undefined,
        capTarget: cap ? 'USER' : null,
        minPurchase: undefined,
        stackable: /acumulable/i.test(doc['legal'] ?? '') && !/no\s+acumulable/i.test(doc['legal'] ?? '') ? true : undefined,
        singleUse: undefined,
        validFrom,
        validUntil,
        specificDates: undefined,
        validDays,
        bankNames: bankNames.length > 0 ? bankNames : undefined,
        walletNames: walletNames.length > 0 ? walletNames : undefined,
        cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
        cardType: null,
        paymentChannel,
        accountType: 'ANY',
        storeName: 'Carrefour',
        salesChannel,
        categoria: 'Supermercados',
        provinces: extractProvinces(doc['legal'] ?? ''),
      });

      console.log(`[Carrefour] ✅ "${title.slice(0, 55)}" → ${discountValue}${isCsi ? ' CSI' : '%'} | ${[...bankNames, ...walletNames].join(', ')} | días: ${validDays}`);
    }

    console.log(`[Carrefour] ${promos.length} promos procesadas`);
    return promos;
  },
};

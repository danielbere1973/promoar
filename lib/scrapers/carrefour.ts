// Carrefour Scraper V2
// API GraphQL VTEX: _v/public/graphql/v1?operationName=GetPromotions
// Sin Playwright — JSON estructurado con campos exactos

import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://www.carrefour.com.ar/descuentos-bancarios';
const GRAPHQL_URL = 'https://www.carrefour.com.ar/_v/public/graphql/v1';
const QUERY_HASH = 'cdedb2142b133164ce61b85e94287592451ebee4a2fbede815e09336d40d29ae';

// Mapas de imagen → entidad
const IMG_BANK: Record<string, string> = {
  'bna.png':           'Banco de la Nación Argentina',
  'bbva.png':          'BBVA',
  'galicia.png':       'Banco Galicia',
  'santander.png':     'Banco Santander',
  'macro.png':         'Banco Macro',
  'patagonia.png':     'Banco Patagonia',
  'supervielle.png':   'Banco Supervielle',
  'ciudad.png':        'Banco Ciudad',
  'credicoop.png':     'Banco Credicoop',
  'icbc.png':          'ICBC',
  'provincia.png':     'Banco Provincia de Buenos Aires',
  'hipotecario.png':   'Banco Hipotecario',
  'comafi.png':        'Banco Comafi',
  'hsbc.png':          'HSBC',
  'naranja.png':       'Naranja X',
};

const IMG_WALLET: Record<string, string> = {
  'mercadopago.png':      'Mercado Pago',
  'mercadopago.webp':     'Mercado Pago',
  'logo-modo.png':        'MODO',
  'modo.png':             'MODO',
  'cuenta-digital.webp':  'Carrefour Banco',
  'cuentadigital.webp':   'Carrefour Banco',
  'credito.png':          'Carrefour Banco',
  'carrefour-banco.webp': 'Carrefour Banco',
};

const IMG_NETWORK: Record<string, { network: string; type: 'CREDIT' | 'DEBIT' | null }> = {
  'mc.webp':         { network: 'Mastercard', type: 'CREDIT' },
  'mastercard.webp': { network: 'Mastercard', type: 'CREDIT' },
  'visa.webp':       { network: 'Visa', type: 'CREDIT' },
  'visa.png':        { network: 'Visa', type: 'CREDIT' },
  'amex.webp':       { network: 'American Express', type: 'CREDIT' },
  'amex.png':        { network: 'American Express', type: 'CREDIT' },
};

function imgKey(filename: string | null | undefined): string {
  return (filename ?? '').toLowerCase().split('/').pop() ?? '';
}

function parseDays(fields: Record<string, string>): number {
  const map: Record<string, number> = {
    sunday: 1, monday: 2, tuesday: 4, wednesday: 8,
    thursday: 16, friday: 32, saturday: 64,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(map)) {
    if (fields[day] === 'true') mask |= bit;
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

function buildStoreNote(fields: Record<string, string>): string {
  const parts: string[] = [];
  if (fields['hyper'] === 'true')     parts.push('Hipermercados');
  if (fields['market'] === 'true')    parts.push('Market');
  if (fields['express'] === 'true')   parts.push('Express');
  if (fields['maxi'] === 'true')      parts.push('Maxi');
  if (fields['ecommerce'] === 'true') parts.push('Online');
  return parts.join(', ');
}

async function fetchPromos(): Promise<any[]> {
  const now = new Date().toISOString().slice(0, 19);
  const vars = Buffer.from(JSON.stringify({
    where: `active=true AND ((active_from < ${now}) AND (active_to > ${now}))`,
    account: 'carrefourar',
  })).toString('base64');

  const extensions = JSON.stringify({
    persistedQuery: {
      version: 1,
      sha256Hash: QUERY_HASH,
      sender: 'valtech.carrefourar-bank-promotions@0.x',
      provider: 'vtex.store-graphql@2.x',
    },
    variables: vars,
  });

  const url = `${GRAPHQL_URL}?workspace=master&maxAge=short&appsEtag=remove&domain=store&locale=es-AR&operationName=GetPromotions&variables=%7B%7D&extensions=${encodeURIComponent(extensions)}`;

  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': SOURCE_URL,
    },
  });

  if (!res.ok) throw new Error(`Carrefour API HTTP ${res.status}`);
  const data = await res.json();
  return data?.data?.documents ?? [];
}

export const CarrefourScraper: Scraper = {
  name: 'Carrefour',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Carrefour] Consultando API GraphQL...');
    const documents = await fetchPromos();
    console.log(`[Carrefour] ${documents.length} promos recibidas`);

    const promos: ScrapedPromo[] = [];

    for (const doc of documents) {
      // Convertir array de fields a objeto plano
      const f: Record<string, string> = {};
      for (const field of doc.fields ?? []) {
        f[field.key] = field.value === 'null' ? '' : (field.value ?? '');
      }

      // Descuento
      const pct = f['discount_percentage'] ? parseFloat(f['discount_percentage']) : null;
      const title = f['title'] ?? '';
      const subTitle = f['sub_title'] ?? '';

      // Cuotas sin interés desde el título si no hay porcentaje
      let discountValue = pct;
      let discountType = 'PERCENTAGE_DESCUENTO';
      let isCsi = false;

      if (!discountValue) {
        const csiMatch = title.match(/(\d+)\s*cuotas?\s+sin\s+inter[eé]s/i);
        if (csiMatch) {
          discountValue = parseInt(csiMatch[1]);
          discountType = 'CUOTAS_SIN_INTERES';
          isCsi = true;
        }
      } else {
        discountType = /reintegro|ahorro|cashback|devoluc/i.test(title + subTitle)
          ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      }

      if (!discountValue) {
        console.log(`[Carrefour] Sin descuento, saltando: ${title.slice(0, 50)}`);
        continue;
      }

      // Fechas
      const validFrom = f['active_from'] ? new Date(f['active_from']) : new Date();
      const validUntil = f['active_to'] ? new Date(f['active_to']) : null;

      // Días
      const validDays = parseDays(f);

      // Tope
      const { cap, capPeriod } = parseCap(subTitle);

      // Entidades desde los logos (img_card, img_card_2, img_card_3...)
      const imgs = [f['img_card'], f['img_card_2'], f['img_card_3'], f['img_card_4']].map(imgKey);

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
        if (/american\s+express|amex/i.test(title)) cardNetworks.push({ network: 'American Express', type: 'CREDIT' });
      }

      if (bankNames.length === 0 && walletNames.length === 0) {
        console.log(`[Carrefour] Sin entidad detectada, saltando: ${title.slice(0, 50)}`);
        continue;
      }

      // Canal de pago
      let paymentChannel: 'QR' | 'ANY' = 'ANY';
      if (/\bMODO\b/i.test(title + subTitle) || walletNames.includes('MODO')) paymentChannel = 'QR';

      // Nota de sucursal y canal de venta
      const storeNote = buildStoreNote(f)
      const isOnlineOnly = f['ecommerce'] === 'true' && f['hyper'] !== 'true' && f['market'] !== 'true' && f['express'] !== 'true' && f['maxi'] !== 'true'
      const isFisicaOnly = f['ecommerce'] !== 'true' && (f['hyper'] === 'true' || f['market'] === 'true' || f['express'] === 'true' || f['maxi'] === 'true')
      const salesChannel: 'ONLINE' | 'FISICA' | null = isOnlineOnly ? 'ONLINE' : isFisicaOnly ? 'FISICA' : null

      const description = [title, subTitle, storeNote].filter(Boolean).join(' | ');

      promos.push({
        title: title.trim(),
        description,
        sourceText: f['legal'] ?? '',
        sourceUrl: SOURCE_URL,
        discount: String(discountValue),
        discountType: discountType as any,
        cap,
        capPeriod: capPeriod ?? undefined,
        capTarget: cap ? 'USER' : null,
        minPurchase: undefined,
        stackable: /acumulable/i.test(f['legal'] ?? '') && !/no\s+acumulable/i.test(f['legal'] ?? '') ? true : undefined,
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
      });

      console.log(`[Carrefour] ✅ "${title.slice(0, 55)}" → ${discountValue}${isCsi ? ' CSI' : '%'} | ${[...bankNames, ...walletNames].join(', ')} | días: ${validDays}`);
    }

    console.log(`[Carrefour] ${promos.length} promos procesadas`);
    return promos;
  },
};

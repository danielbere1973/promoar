// Banco Ciudad Scraper
// Fuente: https://www.bancociudad.com.ar/beneficios/
// Técnica: captura rubros del /inicializacion, usa rubroId para categorizar correctamente.

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { buildPromos, dedup, RawBankPromo, normStr, detectCategoria } from './bank-helpers';

const BASE_URL    = 'https://www.bancociudad.com.ar/beneficios/';
const API_URL     = 'https://www.bancociudad.com.ar/beneficios_rest/beneficios/busqueda';

const BANK_NAME   = 'Banco Ciudad';
const PAGE_SIZE   = 12;
const MAX_PAGES   = 95;

// Promos que no aparecen en busqueda general (rubros especiales como "Exclusivo Buepp")
const SPECIAL_IDS = [13934, 14443, 14412];

function parseDiasMask(dias: string): number {
  if (!dias) return 127;
  // Formato: 7 chars posición por día: L M(mar) M(mie) J V S D
  const bits = [1, 2, 3, 4, 5, 6, 0]; // bit index para cada posición
  let mask = 0;
  for (let i = 0; i < Math.min(dias.length, 7); i++) {
    if (dias[i] !== '-') mask |= 1 << bits[i];
  }
  return mask || 127;
}

// Mapeo de nombre de rubro de Ciudad → nuestra categoría en DB
const RUBRO_A_CATEGORIA: Record<string, string> = {
  'gastronomia':               'Gastronomía',
  'restaurantes':              'Gastronomía',
  'bares':                     'Gastronomía',
  'cafeterias':                'Gastronomía',
  'carniceria':                'Gastronomía',
  'heladerias':                'Heladerías',
  'supermercados':             'Supermercados',
  'almacenes':                 'Supermercados',
  'mayoristas':                'Supermercados',
  'farmacias':                 'Farmacias',
  'perfumerias':               'Salud y Belleza',
  'opticas':                   'Salud y Belleza',
  'salud':                     'Salud y Belleza',
  'belleza':                   'Salud y Belleza',
  'automotor y combustible':   '',  // mixto → detectCategoria
  'combustibles':              'Combustible',
  'automotor':                 'Automotores',
  'nafta':                     'Combustible',
  'tecnologia':                'Tecnología',
  'electronica':               'Tecnología',
  'computacion':               'Tecnología',
  'celulares':                 'Tecnología',
  'indumentaria':              'Indumentaria',
  'calzado':                   'Indumentaria',
  'moda':                      'Indumentaria',
  'deportes':                  'Deportes',
  'bicicleterias':             'Deportes',
  'gym':                       'Deportes',
  'fitness':                   'Deportes',
  'petshop':                   'Petshops',
  'mascotas':                  'Petshops',
  'veterinaria':               'Petshops',
  'hogar':                     'Hogar',
  'decoracion':                'Hogar',
  'muebles':                   'Hogar',
  'colchonerias':              'Hogar',
  'transporte':                '',  // mixto → detectCategoria por comercio
  'subte':                     'Transporte',
  'turismo':                   'Viajes y Turismo',
  'viajes':                    'Viajes y Turismo',
  'aereas':                    'Viajes y Turismo',
  'aerolineas':                'Viajes y Turismo',
  'entretenimiento':           'Entretenimiento',
  'cines':                     'Entretenimiento',
  'teatro':                    'Entretenimiento',
  'jugueterias':               'Jugueterías',
  'librerias':                 'Librerías',
  'shoppings':                 'Shoppings',
  'otros':                     'Otros',
  'exclusivo buepp':           'Supermercados',
  'buepp':                     'Supermercados',
  'Desayuno':                   'Gastronomía',
  
};

function mapRubro(rubroNombre: string): string {
  const n = normStr(rubroNombre).toLowerCase();
  for (const [key, val] of Object.entries(RUBRO_A_CATEGORIA)) {
    if (n.includes(key) || key.includes(n)) return val;
  }
  return '';
}

// Mapeo de letra de día en "dias" → nombre completo
const DIAS_MAP: Record<string, string> = {
  L: 'Lunes', M: 'Martes', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo',
};

function parseDias(item: any): string {
  if (item.todos_dias) return 'todos los días';
  const dias: string = item.dias ?? '';
  const names: string[] = [];
  for (let i = 0; i < dias.length; i++) {
    const ch = dias[i];
    if (ch === 'M' && i === 2) { names.push('Miércoles'); continue; }
    if (DIAS_MAP[ch]) names.push(DIAS_MAP[ch]);
  }
  return names.join(', ');
}

function parseItem(item: any, rubroMap: Map<number, string>): RawBankPromo | null {
  const storeName = item.comercio_nombre ?? item.nombreComercio ?? item.comercio?.nombre ?? item.name ?? '';
  if (!storeName) return null;

  const descuento = Number(item.descuento ?? 0);
  const cuotas    = Number(item.cuotas ?? 0);

  // Categoría desde el rubroId del item
  const rubroNombre = rubroMap.get(item.rubroId) ?? '';
  const categoria   = mapRubro(rubroNombre) || detectCategoria(storeName);

  // Medios de pago → wallets y redes
  const WALLET_KEYWORDS = ['buepp', 'guepp', 'app ciudad', 'modo', 'mercado pago', 'personal pay', 'cuenta dni', 'naranja x'];
  const isWallet = (name: string) => { const n = name.toLowerCase(); return WALLET_KEYWORDS.some(k => n.includes(k)); };
  const mediosPago: any[] = Array.isArray(item.medios_pago) ? item.medios_pago : [];
  const allNames = mediosPago.map(m => String(m.nombre).trim());
  const walletNames = allNames.filter(isWallet);
  const cardNames   = allNames.filter(n => !isWallet(n));

  // Extraer redes de tarjetas directamente de los nombres
  const cardNetworks = cardNames.map(name => {
    const n = name.toUpperCase();
    let network = null;
    if (n.includes('VISA')) network = 'Visa';
    else if (n.includes('MASTER')) network = 'Mastercard';
    else if (n.includes('MAESTRO')) network = 'Maestro';
    else if (n.includes('CABAL')) network = 'Cabal';
    
    const type = n.includes('DEBITO') ? 'DEBIT' : n.includes('CREDITO') ? 'CREDIT' : null;
    return network ? { network, type } : null;
  }).filter(Boolean);

  // Detectar Buepp específicamente para setear el canal QR
  const isBuepp = walletNames.some(w => w.toLowerCase().includes('buepp'));
  const paymentChannel = isBuepp ? 'QR' : 'ANY';

  const diasText = parseDias(item);

  const text = [
    descuento > 0 ? `${descuento}% de descuento` : '',
    cuotas > 0    ? `${cuotas} cuotas sin interés` : '',
    item.resumen  ?? '',
    diasText,
    ...walletNames,
    ...cardNames,
  ].filter(Boolean).join(' ');

  if (!text) return null;

  const logoPath = item.comercio?.logo ?? item.logo ?? '';
  const promoId = item.id ?? item.idBeneficio ?? item.beneficio_id ?? null;
  const promoUrl = promoId ? `https://www.bancociudad.com.ar/beneficios/detalle/${promoId}` : undefined;
  const legalText = [item.resumen, item.descripcion, item.leyenda, item.legal].filter(Boolean).join(' ').trim();
  return {
    storeName: storeName.trim(),
    text: text.trim(),
    walletNames: walletNames.length > 0 ? walletNames : undefined,
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    paymentChannel,
    _categoria: categoria || undefined,
    _storeLogoUrl: logoPath ? `https://www.bancociudad.com.ar/beneficios_rest/beneficios/${logoPath}` : undefined,
    _sourceUrl: promoUrl,
    _sourceText: legalText || text,
  } as any;
}

export const BancoCiudadScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[BancoCiudad] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const allRaw: Array<RawBankPromo & { _categoria?: string }> = [];
    const rubroMap = new Map<number, string>(); // rubroId → nombre

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'es-AR',
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      let capturedBody: any = null;
      let capturedHeaders: Record<string, string> = {};
      let firstPageItems: any[] = [];

      page.on('request', (req) => {
        if (req.url().includes('busqueda') && req.method() === 'POST') {
          capturedHeaders = req.headers();
          const raw = req.postData();
          if (raw) { try { capturedBody = JSON.parse(raw); } catch {} }
        }
      });

      page.on('response', async (res) => {
        const url = res.url();

        // Capturar rubros del inicializacion
        if (url.includes('inicializacion') && res.request().method() === 'POST') {
          try {
            const json = await res.json();
            const personas = json?.retorno?.rubros_por_cliente?.find((r: any) => r.tipo_cliente === 'PERSONA');
            const rubros: any[] = personas?.rubros ?? json?.retorno?.rubros ?? [];
            for (const r of rubros) {
              if (r.id != null && r.nombre) rubroMap.set(Number(r.id), r.nombre);
            }
            console.log(`[BancoCiudad] Rubros capturados: ${rubroMap.size}`);
            if (rubroMap.size > 0) {
              console.log('[BancoCiudad] Rubros:', Array.from(rubroMap.entries()).map(([id, n]) => `${id}=${n}`).join(', '));
            }
          } catch {}
        }

        // Capturar página 1
        if (url.includes('busqueda') && res.request().method() === 'POST') {
          try {
            const json = await res.json();
            const items: any[] = json?.retorno?.beneficios ?? [];
            if (items.length > 0 && firstPageItems.length === 0) {
              firstPageItems = items;
              console.log(`[BancoCiudad] Página 1 (browser): ${items.length} items`);
            }
          } catch {}
        }
      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2000);

      for (const item of firstPageItems) {
        const raw = parseItem(item, rubroMap);
        if (raw) allRaw.push(raw as any);
      }

      if (!capturedBody) {
        console.log('[BancoCiudad] No se capturó body del POST');
        await context.close();
        return [];
      }

      const baseBody = JSON.parse(JSON.stringify(capturedBody));
      baseBody.data.tamano_pagina = PAGE_SIZE;
      baseBody.data.destacado     = false;

      for (let pagina = 2; pagina <= MAX_PAGES; pagina++) {
        const body = JSON.parse(JSON.stringify(baseBody));
        body.data.numero_pagina = pagina;

        let response;
        try {
          response = await context.request.post(API_URL, {
            headers: { ...capturedHeaders, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            data: body,
          });
        } catch {
          console.log(`[BancoCiudad] Página ${pagina}: error de red, fin`);
          break;
        }

        if (!response.ok()) {
          console.log(`[BancoCiudad] Página ${pagina}: HTTP ${response.status()}, fin`);
          break;
        }

        let json: any;
        try { json = await response.json(); } catch { break; }

        const beneficios: any[] = json?.retorno?.beneficios ?? [];
        if (!Array.isArray(beneficios) || beneficios.length === 0) {
          console.log(`[BancoCiudad] Página ${pagina}: vacía, fin`);
          break;
        }

        console.log(`[BancoCiudad] Página ${pagina}: ${beneficios.length} items`);
        for (const item of beneficios) {
          const raw = parseItem(item, rubroMap);
          if (raw) allRaw.push(raw as any);
        }

        if (beneficios.length < PAGE_SIZE) {
          console.log(`[BancoCiudad] Última página alcanzada`);
          break;
        }
      }

      // Fetch promos especiales navegando la página de detalle (evita 403/500)
      const detailPage = await context.newPage();
      for (const id of SPECIAL_IDS) {
        try {
          console.log(`[BancoCiudad] Navegando promo especial ${id}...`);
          let capturedDetail: any = null;

          detailPage.on('response', async (res) => {
            if (res.url().includes(`beneficios/${id}`) || res.url().includes(`beneficios_rest/beneficios/${id}`)) {
              try { capturedDetail = await res.json(); } catch {}
            }
          });

          await detailPage.goto(`https://www.bancociudad.com.ar/beneficios/detalle/${id}`, {
            waitUntil: 'networkidle', timeout: 20000
          });
          await detailPage.waitForTimeout(1000);

          const ben = capturedDetail?.retorno?.beneficio;
          const com = capturedDetail?.retorno?.comercio;
          console.log(`[BancoCiudad] Promo especial ${id}: ben=${!!ben} com=${com?.nombre}`);
          if (!ben || !com?.nombre) continue;

          const item = {
            ...ben,
            comercio_nombre: com.nombre,
            comercio: { logo: com.logo ?? '' },
            rubroId: ben.idRubro ?? ben.rubroId,
          };

          const raw = parseItem(item, rubroMap);
          if (raw) {
            allRaw.push({ ...raw, _validDays: parseDiasMask(ben.dias ?? '') } as any);
            console.log(`[BancoCiudad] Promo especial ${id}: ${com.nombre} OK`);
          }
        } catch (e) {
          console.error(`[BancoCiudad] Error promo especial ${id}:`, e);
        }
      }
      await detailPage.close();

      await context.close();
    } finally {
      await browser.close();
    }

    console.log(`[BancoCiudad] Total raw: ${allRaw.length} items`);

    const promos: ScrapedPromo[] = [];
    for (const raw of allRaw) {
      const built = buildPromos(raw, BANK_NAME, BASE_URL, {
        walletNames: (raw as any).walletNames,
        cardNetworks: (raw as any).cardNetworks,
        paymentChannel: (raw as any).paymentChannel,
      });
      if ((raw as any)._categoria) {
        for (const p of built) p.categoria = (raw as any)._categoria;
      }
      if ((raw as any)._storeLogoUrl) {
        for (const p of built) p.storeLogoUrl = (raw as any)._storeLogoUrl;
      }
      if ((raw as any)._sourceUrl) {
        for (const p of built) p.sourceUrl = (raw as any)._sourceUrl;
      }
      if ((raw as any)._sourceText) {
        for (const p of built) p.sourceText = (raw as any)._sourceText;
      }
      if ((raw as any)._validDays != null) {
        for (const p of built) p.validDays = (raw as any)._validDays;
      }
      promos.push(...built);
    }

    const result = dedup(promos);
    console.log(`[BancoCiudadScraper] Total: ${result.length} promos`);
    return result;
  },
};

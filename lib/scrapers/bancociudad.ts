// Banco Ciudad Scraper
// Fuente: https://www.bancociudad.com.ar/beneficios/
// Técnica: captura rubros del /inicializacion, usa rubroId para categorizar.
// Rubros "Exclusivo Buepp" se scrapeán por rubroId específico (no SPECIAL_IDS hardcodeados).

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { buildPromos, dedup, RawBankPromo, normStr, detectCategoria } from './bank-helpers';

const BASE_URL    = 'https://www.bancociudad.com.ar/beneficios/';
const API_URL     = 'https://www.bancociudad.com.ar/beneficios_rest/busqueda';

const BANK_NAME   = 'Banco Ciudad';
const PAGE_SIZE   = 12;
const MAX_PAGES   = 105;

function parseDiasMask(dias: string): number {
  if (!dias) return 127;
  // 7 chars: L M(mar) M(mie) J V S D → bits 1-6,0
  const bits = [1, 2, 3, 4, 5, 6, 0];
  let mask = 0;
  for (let i = 0; i < Math.min(dias.length, 7); i++) {
    if (dias[i] !== '-') mask |= 1 << bits[i];
  }
  return mask || 127;
}

const RUBRO_A_CATEGORIA: Record<string, string> = {
  'gastronomia':              'Gastronomía',
  'restaurantes':             'Gastronomía',
  'bares':                    'Gastronomía',
  'cafeterias':               'Gastronomía',
  'carniceria':               'Gastronomía',
  'desayuno':                 'Gastronomía',
  'fast food':                'Gastronomía',
  'heladerias':               'Heladerías',
  'supermercados':            'Supermercados',
  'almacenes':                'Supermercados',
  'mayoristas':               'Supermercados',
  'farmacias':                'Farmacias',
  'perfumerias':              'Salud y Belleza',
  'opticas':                  'Salud y Belleza',
  'salud':                    'Salud y Belleza',
  'belleza':                  'Salud y Belleza',
  'combustibles':             'Combustible',
  'nafta':                    'Combustible',
  'automotor y combustible':  '',
  'automotor':                'Automotores',
  'tecnologia':               'Tecnología',
  'electronica':              'Tecnología',
  'computacion':              'Tecnología',
  'celulares':                'Tecnología',
  'indumentaria':             'Indumentaria',
  'calzado':                  'Indumentaria',
  'moda':                     'Indumentaria',
  'deportes':                 'Deportes',
  'bicicleterias':            'Deportes',
  'gym':                      'Deportes',
  'fitness':                  'Deportes',
  'petshop':                  'Petshops',
  'mascotas':                 'Petshops',
  'veterinaria':              'Petshops',
  'hogar':                    'Hogar',
  'decoracion':               'Hogar',
  'muebles':                  'Hogar',
  'colchonerias':             'Hogar',
  'subte':                    'Transporte',
  'transporte':               '',
  'turismo':                  'Viajes y Turismo',
  'viajes':                   'Viajes y Turismo',
  'aereas':                   'Viajes y Turismo',
  'aerolineas':               'Viajes y Turismo',
  'entretenimiento':          'Entretenimiento',
  'cines':                    'Entretenimiento',
  'teatro':                   'Entretenimiento',
  'jugueterias':              'Jugueterías',
  'librerias':                'Librerías',
  'shoppings':                'Shoppings',
  'otros':                    'Otros',
  'exclusivo buepp':          '',   // se determina por comercio
  'buepp':                    '',
};

function mapRubro(rubroNombre: string): string {
  const n = normStr(rubroNombre).toLowerCase();
  for (const [key, val] of Object.entries(RUBRO_A_CATEGORIA)) {
    if (n.includes(key) || key.includes(n)) return val;
  }
  return '';
}

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

// Medios de pago → wallets y redes de tarjeta
function parseMediosPago(mediosPago: any[]): {
  walletNames: string[];
  cardNetworks: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }>;
  hasWalletOnly: boolean;
} {
  const BUEPP_KEYWORDS = ['buepp', 'guepp', 'güepp', 'app ciudad', 'app banco ciudad'];
  const MODO_KEYWORDS  = ['modo'];
  const WALLET_KEYWORDS = [...BUEPP_KEYWORDS, ...MODO_KEYWORDS, 'mercado pago', 'personal pay', 'cuenta dni', 'naranja x'];

  const walletNames: string[] = [];
  const cardNetworks: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }> = [];

  for (const mp of mediosPago) {
    const name = String(mp.nombre ?? '').trim();
    const n = name.toLowerCase();

    if (BUEPP_KEYWORDS.some(k => n.includes(k))) {
      if (!walletNames.includes('BUEPP')) walletNames.push('BUEPP');
      continue;
    }
    if (MODO_KEYWORDS.some(k => n.includes(k))) {
      if (!walletNames.includes('MODO')) walletNames.push('MODO');
      continue;
    }
    if (WALLET_KEYWORDS.some(k => n.includes(k))) {
      walletNames.push(name);
      continue;
    }

    // Tarjeta
    const nu = n.toUpperCase ? n.toUpperCase() : n;
    let network: string | null = null;
    if (/VISA/.test(nu))    network = 'Visa';
    else if (/MASTER/.test(nu)) network = 'Mastercard';
    else if (/MAESTRO/.test(nu)) network = 'Maestro';
    else if (/CABAL/.test(nu))  network = 'Cabal';

    if (network) {
      const type: 'CREDIT' | 'DEBIT' | null =
        /DEBITO/.test(nu) ? 'DEBIT' : /CREDITO/.test(nu) ? 'CREDIT' : null;
      cardNetworks.push({ network, type });
    }
  }

  const hasWalletOnly = walletNames.length > 0 && cardNetworks.length === 0;
  return { walletNames, cardNetworks, hasWalletOnly };
}

// Detectar si hay un bonus por tipo de cuenta (haberes, jubilados)
function parseAccountType(item: any): 'HABERES' | 'JUBILADO' | 'ANY' {
  const texts = [
    item.resumen, item.descripcion, item.leyenda, item.legal,
    ...(item.bonificaciones ?? []).map((b: any) => b.descripcion ?? ''),
  ].filter(Boolean).join(' ').toLowerCase();

  if (/habere|sueldo|acredita.*sueldo|sueldo.*acredita|caja de ahorros sueldo/.test(texts)) return 'HABERES';
  if (/jubilad|pension|anses/.test(texts)) return 'JUBILADO';
  return 'ANY';
}

interface ParsedItem {
  storeName: string;
  descuento: number;
  cuotas: number;
  diasText: string;
  diasMask: number;
  walletNames: string[];
  cardNetworks: Array<{ network: string; type: 'CREDIT' | 'DEBIT' | null }>;
  hasWalletOnly: boolean;
  accountType: 'HABERES' | 'JUBILADO' | 'ANY';
  categoria: string;
  logoUrl?: string;
  sourceUrl?: string;
  legalText: string;
  // Bonus adicional por haberes (campo separado en algunos beneficios Ciudad)
  bonusHaberes?: number;
}

function parseItem(item: any, rubroMap: Map<number, string>): ParsedItem | null {
  const storeName = (item.comercio_nombre ?? item.nombreComercio ?? item.comercio?.nombre ?? item.name ?? '').trim();
  if (!storeName) return null;

  const descuento = Number(item.descuento ?? 0);
  const cuotas    = Number(item.cuotas ?? 0);
  if (!descuento && !cuotas) return null;

  const rubroNombre = rubroMap.get(item.rubroId) ?? '';
  const catFromRubro = mapRubro(rubroNombre);
  const catFromName  = detectCategoria(storeName);
  // Si el rubro dice Combustible pero el nombre no es una empresa de combustible conocida,
  // ignorar el rubro y usar la detección por nombre (evita que comercios vecinos queden mal)
  const FUEL_NAMES = /\bYPF\b|\bSHELL\b|\bAXION\b|\bPETROBRAS\b|\bWICO\b|\bGULF\b|\bDAPSA\b|\bPDVSA\b|\bGNC\b|\bPUMA\s+ENERGY\b|ESTACION|NAFTA|COMBUSTIBLE|SURTIDOR/i;
  const categoria = (catFromRubro === 'Combustible' && !FUEL_NAMES.test(storeName))
    ? (catFromName || '')
    : (catFromRubro || catFromName);

  const mediosPago: any[] = Array.isArray(item.medios_pago) ? item.medios_pago : [];
  const { walletNames, cardNetworks, hasWalletOnly } = parseMediosPago(mediosPago);

  const accountType = parseAccountType(item);

  // Detectar bonus por haberes en bonificaciones
  let bonusHaberes: number | undefined;
  if (item.bonificaciones && Array.isArray(item.bonificaciones)) {
    for (const b of item.bonificaciones) {
      const bDesc = (b.descripcion ?? '').toLowerCase();
      if (/habere|sueldo/.test(bDesc)) {
        const m = String(b.porcentaje ?? '').match(/\d+/);
        if (m) bonusHaberes = parseInt(m[0]);
      }
    }
  }

  const diasText  = parseDias(item);
  const diasMask  = parseDiasMask(item.dias ?? '');

  const logoPath = item.comercio?.logo ?? item.logo ?? '';
  const promoId  = item.id ?? item.idBeneficio ?? item.beneficio_id ?? null;
  const sourceUrl = promoId ? `https://www.bancociudad.com.ar/beneficios/detalle/${promoId}` : undefined;
  const legalText = [item.resumen, item.descripcion, item.leyenda, item.legal]
    .filter(Boolean).join(' ').trim();

  return {
    storeName,
    descuento,
    cuotas,
    diasText,
    diasMask,
    walletNames,
    cardNetworks,
    hasWalletOnly,
    accountType,
    bonusHaberes,
    categoria: categoria || '',
    logoUrl: logoPath ? `https://www.bancociudad.com.ar/beneficios_rest/beneficios/${logoPath}` : undefined,
    sourceUrl,
    legalText,
  };
}

// Convierte un ParsedItem en ScrapedPromo(s)
// Una promo puede generar hasta 3 entradas:
//  1. Acceso por billetera (BUEPP/MODO) → walletNames, bankNames=['Banco Ciudad']
//  2. Acceso por tarjeta → bankNames=['Banco Ciudad'], cardNetworks
//  3. Bonus haberes (si existe) → accountType='HABERES', descuento adicional
function buildScrapedPromos(p: ParsedItem): ScrapedPromo[] {
  const result: ScrapedPromo[] = [];

  const baseDiscount = p.descuento > 0 ? {
    discount: String(p.descuento),
    discountType: 'PERCENTAGE_DESCUENTO',
    title: `${p.descuento}% descuento – ${p.storeName}`,
  } : p.cuotas > 0 ? {
    discount: String(p.cuotas),
    discountType: 'CUOTAS_SIN_INTERES',
    title: `${p.cuotas} cuotas sin interés – ${p.storeName}`,
  } : null;

  if (!baseDiscount) return [];

  const base: Partial<ScrapedPromo> = {
    storeName: p.storeName,
    storeLogoUrl: p.logoUrl,
    description: p.legalText || `${baseDiscount.title}. ${p.diasText}.`,
    sourceText: p.legalText,
    sourceUrl: p.sourceUrl,
    validDays: p.diasMask,
    categoria: p.categoria || undefined,
    bankNames: [BANK_NAME],
  };

  // 1. Acceso por billeteras (BUEPP, MODO, etc.)
  if (p.walletNames.length > 0) {
    result.push({
      ...base,
      ...baseDiscount,
      walletNames: p.walletNames,
      cardNetworks: undefined,
      paymentChannel: 'QR',
      // bankNames siempre incluye Banco Ciudad → la promo aparece en ambos filtros
      accountType: p.accountType !== 'ANY' ? p.accountType : undefined,
    } as ScrapedPromo);
  }

  // 2. Acceso por tarjetas tradicionales (si las hay)
  if (p.cardNetworks.length > 0) {
    result.push({
      ...base,
      ...baseDiscount,
      walletNames: undefined,
      cardNetworks: p.cardNetworks,
      paymentChannel: 'TARJETA_FISICA',
      accountType: p.accountType !== 'ANY' ? p.accountType : undefined,
    } as ScrapedPromo);
  }

  // 3. Si no hay ni wallets ni tarjetas → promo genérica de Banco Ciudad
  if (p.walletNames.length === 0 && p.cardNetworks.length === 0) {
    result.push({
      ...base,
      ...baseDiscount,
      walletNames: undefined,
      cardNetworks: undefined,
      paymentChannel: 'ANY',
      accountType: p.accountType !== 'ANY' ? p.accountType : undefined,
    } as ScrapedPromo);
  }

  // 4. Bonus por haberes (% adicional que aplica solo con cuenta sueldo)
  if (p.bonusHaberes && p.bonusHaberes > 0) {
    const bonusBase = {
      ...base,
      discount: String(p.bonusHaberes),
      discountType: 'PERCENTAGE_DESCUENTO',
      title: `+${p.bonusHaberes}% adicional haberes – ${p.storeName}`,
      accountType: 'HABERES' as const,
      walletNames: p.walletNames.length > 0 ? p.walletNames : undefined,
      cardNetworks: p.cardNetworks.length > 0 ? p.cardNetworks : undefined,
      paymentChannel: p.walletNames.length > 0 ? 'QR' : 'ANY' as any,
    };
    result.push(bonusBase as ScrapedPromo);
  }

  return result;
}

export const BancoCiudadScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[BancoCiudad] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    const allParsed: ParsedItem[] = [];
    const rubroMap = new Map<number, string>();
    let bueppRubroId: number | null = null;

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

      page.on('request', req => {
        if (req.url().includes('busqueda') && req.method() === 'POST') {
          capturedHeaders = req.headers();
          const raw = req.postData();
          if (raw) { try { capturedBody = JSON.parse(raw); } catch {} }
        }
      });

      page.on('response', async res => {
        const url = res.url();

        if (url.includes('inicializacion') && res.request().method() === 'POST') {
          try {
            const json = await res.json();
            const personas = json?.retorno?.rubros_por_cliente?.find((r: any) => r.tipo_cliente === 'PERSONA');
            const rubros: any[] = personas?.rubros ?? json?.retorno?.rubros ?? [];
            for (const r of rubros) {
              if (r.id != null && r.nombre) {
                rubroMap.set(Number(r.id), r.nombre);
                if (normStr(r.nombre).toLowerCase().includes('buepp')) {
                  bueppRubroId = Number(r.id);
                  console.log(`[BancoCiudad] Rubro BUEPP encontrado: ${r.id} = "${r.nombre}"`);
                }
              }
            }
            console.log(`[BancoCiudad] Rubros capturados: ${rubroMap.size}`);
          } catch {}
        }

      });

      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2000);

      // El primer POST que dispara la carga de la página es el de "destacados"
      // (body distinto, shape viejo). El listado completo real solo se pide tras
      // clickear "Ver todos los beneficios" — hay que forzar ese click para
      // capturar el body/shape correcto (palabra_clave, quotas, zona, aplica_tienda,
      // tipo_cliente en mayúsculas) que la paginación necesita.
      try {
        await page.locator('text=Ver todos los beneficios').first().click({ timeout: 10000 });
        await page.waitForTimeout(2000);
      } catch {
        console.log('[BancoCiudad] No se pudo clickear "Ver todos los beneficios"');
      }

      if (!capturedBody) {
        console.log('[BancoCiudad] No se capturó body del POST');
        await context.close();
        return [];
      }

      const baseBody = JSON.parse(JSON.stringify(capturedBody));
      baseBody.data.tamano_pagina = PAGE_SIZE;
      baseBody.data.destacado     = false;
      baseBody.data.numero_pagina = 1;

      // Función auxiliar para buscar con parámetros específicos
      const fetchPage = async (pagina: number, rubroId?: number | null) => {
        const body = JSON.parse(JSON.stringify(baseBody));
        body.data.numero_pagina = pagina;
        if (rubroId != null) body.data.rubroId = rubroId;
        else delete body.data.rubroId;

        let response;
        try {
          response = await context.request.post(API_URL, {
            headers: { ...capturedHeaders, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            data: body,
          });
        } catch {
          return null;
        }

        if (!response.ok()) return null;
        try {
          const json = await response.json();
          return json?.retorno?.beneficios as any[] ?? [];
        } catch {
          return null;
        }
      };

      // ── Paginación general (sin filtro de rubro) ──────────────────────────
      // Arranca en 1: firstPageItems (destacados) queda descartado a partir de
      // acá, la paginación real completa se pide desde cero con el body correcto.
      for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
        const beneficios = await fetchPage(pagina);
        if (!beneficios || beneficios.length === 0) {
          console.log(`[BancoCiudad] Página ${pagina}: vacía, fin`);
          break;
        }

        console.log(`[BancoCiudad] Página ${pagina}: ${beneficios.length} items`);
        for (const item of beneficios) {
          const parsed = parseItem(item, rubroMap);
          if (parsed) allParsed.push(parsed);
        }

        if (beneficios.length < PAGE_SIZE) {
          console.log('[BancoCiudad] Última página alcanzada');
          break;
        }
      }

      // ── Rubro "Exclusivo Buepp" (si se encontró el rubroId) ─────────────
      if (bueppRubroId != null) {
        console.log(`[BancoCiudad] Scrapeando rubro Exclusivo Buepp (id=${bueppRubroId})...`);
        for (let pagina = 1; pagina <= MAX_PAGES; pagina++) {
          const beneficios = await fetchPage(pagina, bueppRubroId);
          if (!beneficios || beneficios.length === 0) {
            console.log(`[BancoCiudad] Buepp página ${pagina}: vacía, fin`);
            break;
          }

          console.log(`[BancoCiudad] Buepp página ${pagina}: ${beneficios.length} items`);
          for (const item of beneficios) {
            const parsed = parseItem(item, rubroMap);
            if (parsed) allParsed.push(parsed);
          }

          if (beneficios.length < PAGE_SIZE) break;
        }
      } else {
        console.log('[BancoCiudad] Rubro BUEPP no detectado en init; omitiendo rubro especial.');
      }

      await context.close();
    } finally {
      await browser.close();
    }

    console.log(`[BancoCiudad] Total items parseados: ${allParsed.length}`);

    // Deduplicar por storeName + descuento + dias
    const seen = new Set<string>();
    const promos: ScrapedPromo[] = [];
    for (const parsed of allParsed) {
      const key = `${parsed.storeName}|${parsed.descuento}|${parsed.cuotas}|${parsed.diasMask}`;
      if (seen.has(key)) continue;
      seen.add(key);
      promos.push(...buildScrapedPromos(parsed));
    }

    console.log(`[BancoCiudadScraper] Total: ${promos.length} promos`);
    return promos;
  },
};

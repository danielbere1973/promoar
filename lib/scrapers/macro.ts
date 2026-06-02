// Banco Macro Scraper — Completamente Automático
// F5 BIG-IP detecta Playwright headless → browser VISIBLE requerido.
//
// El scraper hace todo solo:
// 1. Abre el browser
// 2. Navega a "Todas las categorías"
// 3. Recorre todas las páginas automáticamente
// 4. Visita el detalle de cada promo para obtener redes de tarjeta, topes, etc.
// 5. Cierra el browser

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { extractCap } from './cencosud-helpers';

const PAGE_URL      = 'https://www.macro.com.ar/beneficios?d=Any';
const API_BASE      = 'https://apipublic.macro.com.ar/v1/card-benefits';
const CATALOG_BASE  = `${API_BASE}/provinces/AR-0`;
const DETAIL_BASE   = API_BASE;
const BANK_NAME     = 'Banco Macro';
const PAGE_WAIT     = 6000;  // ms entre páginas para que cargue la API (más tiempo en CI)
const LIST_CODE     = 'beneficios-mb';
const PAGE_SIZE     = 50;


// ─── Mapeo de sector → categoría ─────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  'automotor':      'Automotores',
  'combustible':    'Combustible',
  'electro':        'Tecnología',
  'tecnologia':     'Tecnología',
  'gastronomia':    'Gastronomía',
  'restaurante':    'Gastronomía',
  'indumentaria':   'Indumentaria',
  'moda':           'Indumentaria',
  'supermercado':   'Supermercados',
  'turismo':        'Viajes y Turismo',
  'viaje':          'Viajes y Turismo',
  'salud':          'Salud y Belleza',
  'belleza':        'Salud y Belleza',
  'hogar':          'Hogar',
  'decoracion':     'Hogar',
  'juguete':        'Jugueterías',
  'libreria':       'Librerías',
  'entretenimiento':'Entretenimiento',
  'shopping':       'Shoppings',
  'tienda':         'Shoppings',
  'bicicleta':      'Deportes',
  'deporte':        'Deportes',
  'mascota':        'Petshops',
  'petshop':        'Petshops',
  'farmacia':       'Farmacias',
  'otros':          'Otros',
};

function mapSector(sector: string): string {
  const n = sector.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, val] of Object.entries(SECTOR_MAP)) {
    if (n.includes(key)) return val;
  }
  return '';
}

// ─── Parseo de días ───────────────────────────────────────────────────────────

function parseDayText(text: string): number {
  if (!text) return 127;
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (t.includes('todo') || t.includes('lunes a domingo') || t.includes('lunes a sabado')) return 127;
  const MAP: Record<string, number> = {
    'lunes': 1, 'martes': 2, 'miercoles': 3, 'jueves': 4,
    'viernes': 5, 'sabado': 6, 'domingo': 0,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(MAP)) {
    if (t.includes(day)) mask |= 1 << bit;
  }
  return mask || 127;
}

// ─── Tabla de equivalencias: nombre Macro → CardNetwork + CardSegment en DB ──
// null = ignorar (sin equivalencia en la DB)

const MACRO_CARD_MAP: Record<string, { cardNetworkName: string; segmentName: string; cardTier: 'SELECTA' | null } | null> = {
  // American Express Banco
  'American Express Black Macro Selecta': { cardNetworkName: 'American Express Banco', segmentName: 'American Express Black Macro Selecta', cardTier: 'SELECTA' },
  'American Express Gold':                { cardNetworkName: 'American Express Banco', segmentName: 'Gold',                                  cardTier: null },
  'American Express Internacional':       { cardNetworkName: 'American Express Banco', segmentName: 'Internacional',                         cardTier: null },
  'American Express Platinum':            { cardNetworkName: 'American Express Banco', segmentName: 'Platinum',                              cardTier: null },
  // Mastercard
  'Mastercard Black Macro Selecta':       { cardNetworkName: 'Mastercard',             segmentName: 'Black Macro Selecta',                   cardTier: 'SELECTA' },
  'Mastercard Gold':                      { cardNetworkName: 'Mastercard',             segmentName: 'Gold',                                  cardTier: null },
  'Mastercard Internacional':             { cardNetworkName: 'Mastercard',             segmentName: 'Internacional',                         cardTier: null },
  'Mastercard Platinum':                  { cardNetworkName: 'Mastercard',             segmentName: 'Platinum',                              cardTier: null },
  'Mastercard Regional':                  { cardNetworkName: 'Mastercard',             segmentName: 'Regional',                              cardTier: null },
  // Visa Crédito
  'Visa Gold':                            { cardNetworkName: 'Visa',                   segmentName: 'Gold',                                  cardTier: null },
  'Visa Internacional':                   { cardNetworkName: 'Visa',                   segmentName: 'Internacional',                         cardTier: null },
  'Visa Nacional':                        { cardNetworkName: 'Visa',                   segmentName: 'Nacional',                              cardTier: null },
  'Visa Platinum':                        { cardNetworkName: 'Visa',                   segmentName: 'Platinum',                              cardTier: null },
  'Visa Signature Macro Selecta':         { cardNetworkName: 'Visa',                   segmentName: 'Signature Macro Selecta',               cardTier: 'SELECTA' },
  // Visa Débito Macro
  'Visa Débito Macro':                    { cardNetworkName: 'Visa',                   segmentName: 'Macro',                                 cardTier: null },
  'Visa Débito Macro Selecta':            { cardNetworkName: 'Visa',                   segmentName: 'Macro Selecta',                         cardTier: 'SELECTA' },
  // Sin equivalencia en la DB
  'Corporate Gold':                       null,
  'Mastercard Corporate':                 null,
  'Visa Business':                        null,
  'Visa Corporate':                       null,
};

// ─── Parseo del campo payment.method ─────────────────────────────────────────
// Retorna un entry por cada CardSegment único encontrado en la tabla

function parseMethod(method: string): { network: string; cardNetworkName: string; segmentName: string; cardTier: 'SELECTA' | null }[] {
  if (!method || method === 'TC' || method === 'TD') return [];

  const seen = new Set<string>();
  const results: { network: string; cardNetworkName: string; segmentName: string; cardTier: 'SELECTA' | null }[] = [];

  for (const part of method.split(',').map(s => s.trim()).filter(Boolean)) {
    const mapped = MACRO_CARD_MAP[part];
    if (mapped === undefined) {
      console.log(`[Macro] ⚠️ Tarjeta desconocida en mapa: "${part}"`);
      continue;
    }
    if (mapped === null) continue;

    const key = `${mapped.cardNetworkName}|${mapped.segmentName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // network = prefijo genérico para el match de fallback en el route
    const network = mapped.cardNetworkName.replace(' Crédito', '').replace(' Banco', '');
    results.push({ network, cardNetworkName: mapped.cardNetworkName, segmentName: mapped.segmentName, cardTier: mapped.cardTier });
  }
  return results;
}

// ─── Parseo del tope desde el campo phase (HTML) ─────────────────────────────

function extractTopeFromPhase(phase: string): number | null {
  if (!phase) return null;
  // Ej: "Tope de devolución: $30.000"
  const m = phase.match(/\$\s*([\d.,]+)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || null;
}

// ─── Parseo del descuento ─────────────────────────────────────────────────────

function parseDiscount(discount: any): number | null {
  if (discount == null) return null;
  if (typeof discount === 'number') return discount > 0 ? discount : null;
  if (typeof discount === 'string') { const v = parseFloat(discount); return v > 0 ? v : null; }
  // Objeto: { bank, commercial, maximum }
  const max = parseFloat(discount.maximum ?? discount.bank ?? '0');
  return max > 0 ? max : null;
}

// ─── Parseo de un item de detalle ─────────────────────────────────────────────

function parseDetail(item: any): ScrapedPromo[] {
  const storeName = (item.name ?? item.description ?? '').trim();
  if (!storeName) return [];

  const discount   = parseDiscount(item.discount);
  const method     = item.payment?.method ?? '';
  const cuotas     = item.payment?.maximum ? parseInt(item.payment.maximum) : null;

  if ((discount == null || discount <= 0) && (!cuotas || cuotas <= 0)) return [];

  const networks   = parseMethod(method);
  const sector     = item.sector ?? item['sector-list'] ?? '';
  const categoria  = mapSector(sector);
  const validDays  = parseDayText(item['day-week'] ?? '');

  const validFrom  = item['valid-date-from']
    ? item['valid-date-from'].split(' ')[0]
    : undefined;
  const validUntil = item['valid-date-to']
    ? item['valid-date-to'].split(' ')[0]
    : (item['end-date'] ? String(item['end-date']).split('T')[0] : undefined);

  const tope = extractTopeFromPhase(item.phase ?? '')
    ?? extractCap((item['terms-conditions'] ?? '').toUpperCase())?.value
    ?? null;

  const description = [storeName, sector].filter(Boolean).join(' | ');

  // Si no hay redes específicas, crear un requirement genérico (TC genérico)
  const combos = networks.length > 0
    ? networks
    : [{ network: '', cardNetworkName: '', segmentName: '', cardTier: null as 'SELECTA' | null }];

  const promos: ScrapedPromo[] = [];

  for (const combo of combos) {
    const effectiveTier = combo.cardTier;
    const tierSuffix = effectiveTier === 'SELECTA' ? ' (Selecta)' : '';
    const cardNetworks = combo.cardNetworkName
      ? [{ network: combo.network, type: 'CREDIT' as const, cardNetworkName: combo.cardNetworkName, segmentName: combo.segmentName }]
      : undefined;

    const base: Partial<ScrapedPromo> = {
      storeName,
      description,
      sourceText:     (item['terms-conditions'] ?? description).slice(0, 8000),
      sourceUrl:      item.code ? `${PAGE_URL}#${decodeURIComponent(item.code)}` : PAGE_URL,
      validFrom,
      validUntil,
      validDays,
      bankNames:      [BANK_NAME],
      cardNetworks,
      categoria,
      cap:            tope ?? undefined,
      capPeriod:      tope ? 'MONTHLY' : undefined,
      capTarget:      tope ? 'USER' : null,
      cardTier:       effectiveTier as any,
      storeLogoUrl:   item.logo ? `https://d15j2h49piim29.cloudfront.net/${encodeURIComponent(item.logo)}` : undefined,
    };

    if (discount && discount > 0) {
      promos.push({
        ...base,
        title:        `${discount}% descuento – ${storeName}${tierSuffix}`,
        discount:     String(discount),
        discountType: 'PERCENTAGE_DESCUENTO',
      } as ScrapedPromo);
    }
    if (cuotas && cuotas > 0 && discount == null) {
      promos.push({
        ...base,
        title:        `${cuotas} cuotas sin interés – ${storeName}${tierSuffix}`,
        discount:     String(cuotas),
        discountType: 'CUOTAS_SIN_INTERES',
      } as ScrapedPromo);
    }
  }

  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────

export const MacroScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Macro] ════════════════════════════════════════════');
    console.log('[Macro] AUTOMÁTICO — Se abre el browser y hace todo solo');
    console.log('[Macro] No toques nada — el scraper navega por su cuenta');
    console.log('[Macro] ════════════════════════════════════════════');

    const browser = await chromium.launch({
      headless: false,
      slowMo: 0,
      args: ['--no-sandbox', '--start-maximized'],
    });

    const capturedCodes  = new Set<string>();
    const seenUrls       = new Set<string>();
    let   capturedApiKey = '';
    let   capturedHeaders: Record<string, string> = {};

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: null,
        locale: 'es-AR',
      });

      const page = await context.newPage();

      // Capturar Apikey de los headers de los requests al catálogo
      page.on('request', req => {
        const url = req.url();
        if (!url.includes('apipublic.macro.com.ar')) return;
        const h = req.headers();
        const key = h['apikey'] ?? h['x-api-key'] ?? h['authorization'] ?? h['x-client-id'] ?? '';
        if (key && !capturedApiKey) {
          capturedApiKey = key;
          capturedHeaders = { ...h, 'Accept': 'application/json' };
          console.log('[Macro] Apikey capturada de headers ✓:', key.slice(0, 20) + '...');
        }
      });

      // Capturar items del catálogo y sus códigos
      page.on('response', async (res) => {
        const url = res.url();
        if (!url.includes('apipublic.macro.com.ar')) return;
        if (seenUrls.has(url)) return;
        seenUrls.add(url);

        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('application/json')) return;

        try {
          const json = await res.json();
          const items: any[] = json?.promotions ?? [];
          if (!Array.isArray(items) || items.length === 0) return;

          // Log del primer item para ver qué campos trae el catálogo
          if (capturedCodes.size === 0) {
            console.log('[Macro] 🔍 Sample catálogo keys:', Object.keys(items[0]).join(', '));
            console.log('[Macro] 🔍 Sample item:', JSON.stringify(items[0]).slice(0, 400));
          }

          let nuevos = 0;
          for (const item of items) {
            // El campo "city" contiene el código URL-encodeado: "41453TC0%7C41453"
            // Usarlo directo en la URL del detalle (ya viene encodeado)
            const code = item.city ?? item.code ?? item['external-code'];
            if (code && !capturedCodes.has(String(code))) {
              capturedCodes.add(String(code));
              nuevos++;
            }
          }
          console.log(`[Macro] ${url.split('?')[0].split('/').pop()} → ${items.length} items, +${nuevos} nuevos (total: ${capturedCodes.size})`);
        } catch (e) {
          console.log('[Macro] Error parseando response:', e);
        }
      });

      await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 45000 });
      // Esperar a que el JS inicialice urlServicios
      await page.waitForFunction(() => !!(window as any).urlServicios, { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2000)

      // Buscar API key: 1) desde requests interceptados 2) desde window 3) desde HTML
      if (!capturedApiKey) {
        // Intentar desde window con múltiples variantes
        const fromWindow = await page.evaluate(() => {
          const w = window as any;
          if (w.urlServicios?.url_servicio_client_id) return w.urlServicios.url_servicio_client_id;
          for (const key of Object.keys(w)) {
            try {
              const val = w[key];
              if (val && typeof val === 'object' && val.url_servicio_client_id) return val.url_servicio_client_id;
            } catch {}
          }
          return '';
        }).catch(() => '');

        if (fromWindow) {
          capturedApiKey = fromWindow;
          capturedHeaders = { 'Apikey': fromWindow, 'Accept': 'application/json', 'Referer': PAGE_URL };
          console.log('[Macro] Apikey obtenida de window ✓');
        } else {
          // Fallback: extraer del HTML de la página
          const html = await page.content().catch(() => '')
          const match = html.match(/url_servicio_client_id["\s:]*([A-Za-z0-9]{20,50})/)
          if (match) {
            capturedApiKey = match[1]
            capturedHeaders = { 'Apikey': match[1], 'Accept': 'application/json', 'Referer': PAGE_URL }
            console.log('[Macro] Apikey extraída del HTML ✓:', match[1].slice(0, 20) + '...')
          } else {
            console.log('[Macro] ⚠️ Apikey no encontrada en window ni en HTML')
          }
        }
      }

      // ── Paso 1: Seleccionar "ARGENTINA" para traer todo el país ──
      console.log('[Macro] Seleccionando provincia ARGENTINA...');
      // Intentar click real en el select primero
      try {
        await page.click('#ubicacion', { timeout: 5000 })
        await page.selectOption('#ubicacion', 'ARGENTINA', { timeout: 5000 })
        await page.waitForTimeout(1000)
      } catch {}
      // Fallback: dispatchEvent
      await page.evaluate(() => {
        const sel = document.querySelector('#ubicacion') as HTMLSelectElement | null;
        if (sel) {
          sel.value = 'ARGENTINA';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          sel.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.waitForTimeout(PAGE_WAIT);

      // ── Paso 2: Auto-click "Todas las categorías" ──
      console.log('[Macro] Clickeando "Todas las categorías"...');
      const btnExists = await page.evaluate(() => {
        const btn = document.querySelector('.bm-categoria[data-category="0"]') as HTMLElement | null;
        if (btn) { btn.click(); return true; }
        const btns = Array.from(document.querySelectorAll('[data-category]')) as HTMLElement[]
        const all = btns.find(b => b.getAttribute('data-category') === '0' || b.textContent?.includes('Todas'))
        if (all) { all.click(); return true; }
        return false;
      });
      console.log('[Macro] Botón encontrado:', btnExists);

      // Paginar directamente via context.request (comparte cookies de sesión con el browser)
      // Usar el endpoint real descubierto: AR-0?list-code=beneficios-mb&offset=N
      if (!btnExists || capturedCodes.size === 0) {
        console.log('[Macro] Paginando directamente via context.request (cookies de sesión)...')
        const apiHeaders: Record<string, string> = {
          'Accept': 'application/json',
          'Referer': PAGE_URL,
          'Origin': 'https://www.macro.com.ar',
        }
        if (capturedApiKey) apiHeaders['Apikey'] = capturedApiKey

        let offset = 1
        let totalExpected = 0
        while (true) {
          const url = `${CATALOG_BASE}?list-code=${LIST_CODE}&offset=${offset}`
          try {
            const res = await context.request.get(url, { headers: apiHeaders, timeout: 15000 })
            const body = await res.text()
            console.log(`[Macro] Catálogo offset=${offset}: HTTP ${res.status()} body=${body.slice(0, 200)}`)
            if (!res.ok()) break
            const json = JSON.parse(body)
            const items: any[] = json?.promotions ?? json?.items ?? []
            if (totalExpected === 0 && json?.total) totalExpected = json.total
            if (items.length === 0) break
            let nuevos = 0
            for (const item of items) {
              const code = item.city ?? item.code ?? item['external-code']
              if (code && !capturedCodes.has(String(code))) {
                capturedCodes.add(String(code))
                nuevos++
              }
            }
            console.log(`[Macro] offset=${offset}: ${items.length} items, +${nuevos} nuevos (total: ${capturedCodes.size}${totalExpected ? '/' + totalExpected : ''})`)
            if (items.length < PAGE_SIZE) break
            offset += PAGE_SIZE
          } catch (e) {
            console.log('[Macro] Error en catálogo:', e)
            break
          }
        }
      }

      // Si el botón fue encontrado, esperar que el interceptor llene los codes y paginar por click
      if (btnExists) {
        console.log('[Macro] Esperando primer batch del catálogo...');
        const waitStart = Date.now();
        while (capturedCodes.size === 0 && Date.now() - waitStart < 45000) {
          await page.waitForTimeout(500);
        }
        if (capturedCodes.size === 0) {
          const pageTitle = await page.title().catch(() => 'N/A')
          console.log('[Macro] ⚠️ Catálogo no cargó en 45s. Título página:', pageTitle)
          await page.screenshot({ path: '/tmp/macro-debug.png' }).catch(() => {})
        } else {
          console.log(`[Macro] Primer batch: ${capturedCodes.size} códigos`);
          // Paginar por clicks en "siguiente"
          let pagina = 1;
          const MAX_PAGINAS = 20;
          while (pagina <= MAX_PAGINAS) {
            console.log(`[Macro] Página ${pagina} — ${capturedCodes.size} códigos capturados`);
            const codesAntes = capturedCodes.size;
            await page.waitForTimeout(PAGE_WAIT);
            const hasNext = await page.evaluate(() => {
              const btn = document.querySelector('.bm-pagination_next') as HTMLElement | null;
              if (!btn) return false;
              btn.click();
              return true;
            });
            if (!hasNext) { console.log('[Macro] No hay más páginas.'); break; }
            await page.waitForTimeout(PAGE_WAIT);
            if (capturedCodes.size === codesAntes) { console.log('[Macro] Sin codes nuevos — fin de paginación.'); break; }
            pagina++;
          }
        }
      }

      console.log(`[Macro] Catálogo completo — ${capturedCodes.size} promos. Navegando detalles...`);

      // Navegar cada detalle con page.goto() usando la sesión activa del browser
      // Esto evita el anti-bot porque usa las mismas cookies de la sesión
      const details: any[] = [];
      const codes = [...capturedCodes];
      const DETAIL_BATCH = 10;

      const detailHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'Referer': PAGE_URL,
        'Origin': 'https://www.macro.com.ar',
      }
      if (capturedApiKey) detailHeaders['Apikey'] = capturedApiKey

      console.log(`[Macro] Fetching ${codes.length} detalles...`);
      for (let i = 0; i < codes.length; i += DETAIL_BATCH) {
        const batch = codes.slice(i, i + DETAIL_BATCH);
        const fetched = await Promise.all(batch.map(async code => {
          try {
            const url = `${DETAIL_BASE}/${encodeURIComponent(code)}`;
            const res = await context.request.get(url, { headers: detailHeaders, timeout: 15000 });
            if (!res.ok()) return null;
            const json = await res.json();
            return json?.promotions?.[0] ?? null;
          } catch { return null; }
        }));
        details.push(...fetched.filter(Boolean));
        console.log(`[Macro] Detalles: ${details.length}/${codes.length}`);
      }

      await context.close().catch(() => {});

      console.log(`[Macro] ${details.length} detalles obtenidos.`);

      // Parsear todos los detalles
      const allPromos: ScrapedPromo[] = [];
      for (const detail of details) {
        allPromos.push(...parseDetail(detail));
      }

      // Deduplicar incluyendo el segmento de tarjeta para no colapsar variantes
      const seen = new Set<string>();
      const unique = allPromos.filter(p => {
        const netKey = p.cardNetworks?.map(n => `${n.cardNetworkName}|${n.segmentName}`).join('+') ?? '';
        const key = `${p.title}|${p.sourceUrl}|${netKey}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(`[Macro] Total: ${unique.length} promos (${allPromos.length} antes de dedup)`);
      return unique;

    } finally {
      await browser.close();
    }
  },
};

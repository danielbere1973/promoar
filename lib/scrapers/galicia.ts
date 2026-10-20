// Banco Galicia Scraper
// Técnica: Playwright → captura token de auth → llama API real de Galicia
// API base: https://loyalty.bff.bancogalicia.com.ar/api/portal/personalizacion/v1/promociones/
//   GET categorias?idAudiencia=1&SubCategoria=false&Visibles=true
//   GET catalogo?page=N&pageSize=50&IdCategoria={id}

import { Browser } from 'playwright';
import { launchBrowser } from './browserFactory';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria } from './bank-helpers';
import { extractCap } from './cencosud-helpers';

const PAGE_URL       = 'https://www.galicia.ar/personas/buscador-de-promociones';
const BFF_BASE       = 'https://loyalty.bff.bancogalicia.com.ar/api/portal/personalizacion/v1';
const BFF_DETAIL     = 'https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/promociones/idPromocion';
const BANK_NAME      = 'Banco Galicia';
const PAGE_SIZE      = 50;
const MAX_PAGES      = 40;
const MAX_PROMOS     = 0; // 0 = sin límite

// ─── helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function extractDiscount(text: string): { value: number; type: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:ahorro|descuento|reintegro|reembolso|off)/i)
    ?? text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  if (v <= 0 || v > 100) return null;
  const type = /reintegro|reembolso/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
  return { value: v, type };
}

function extractInstallments(text: string): number | null {
  const m = text.match(/(\d+)\s+cuotas?\s+(?:sin|cero)\s+inter[eé]s/i)
    ?? text.match(/hasta\s+(\d+)\s+cuotas?/i);
  return m ? parseInt(m[1]) : null;
}

// Mapeo de categoría de Galicia → nuestra DB
const ID_CAT_MAP: Record<number, string> = {
  1:   'Gastronomía',
  8:   'Supermercados',
  3:   'Salud y Belleza',
  121: 'Petshops',
  7:   'Indumentaria',
  122: 'Librerías',
  11:  'Juguetes',
  4:   'Hogar',
  9:   'Tecnología',
  2:   'Automotores',
  5:   'Viajes y Turismo',
  6:   'Entretenimiento',
  106: 'Shoppings',
  131: 'Transporte',
};

// ─── parseo de medios de pago ─────────────────────────────────────────────────

function parseMediosDePago(medios: any[]): CardNetworkWithType[] {
  if (!Array.isArray(medios)) return [];
  const nets: CardNetworkWithType[] = [];
  const seen = new Set<string>();

  for (const m of medios) {
    const tarjeta: string = m.tarjeta ?? '';
    const tipo: string    = m.tipoTarjeta ?? '';
    const cardType: 'CREDIT' | 'DEBIT' | null =
      tipo === 'Credito' ? 'CREDIT' : tipo === 'Debito' ? 'DEBIT' : null;

    let network = '';
    if (/visa/i.test(tarjeta))       network = 'VISA';
    else if (/master/i.test(tarjeta)) network = 'Mastercard';
    else if (/amex|american/i.test(tarjeta)) network = 'American Express Banco';

    if (!network) continue;
    const key = `${network}|${cardType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nets.push({ network, type: cardType });
  }
  return nets;
}

// ─── parseo de días desde leyendaDiasAplicacion ───────────────────────────────

function parseLeyendaDias(leyenda: string): number {
  if (!leyenda) return 127;
  const t = norm(leyenda);
  if (/TODOS/.test(t)) return 127;

  // Rango: "Jueves a Domingo"
  const DAY_NAMES = ['DOMINGO','LUNES','MARTES','MI[EÉ]RCOLES','JUEVES','VIERNES','S[AÁ]BADO'];
  const DAY_BITS  = [0, 1, 2, 3, 4, 5, 6];
  const DAY_NORMS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

  const rangeRE = new RegExp(`(${DAY_NAMES.join('|')})\\s+(?:A|AL?)\\s+(${DAY_NAMES.join('|')})`);
  const rangeMatch = t.match(rangeRE);
  if (rangeMatch) {
    const normDay = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const findBit = (s: string) => {
      for (let i = 0; i < DAY_NORMS.length; i++) {
        if (normDay(s).includes(DAY_NORMS[i])) return DAY_BITS[i];
      }
      return -1;
    };
    const a = findBit(rangeMatch[1]);
    const b = findBit(rangeMatch[2]);
    if (a >= 0 && b >= 0) {
      let mask = 0;
      if (a <= b) for (let i = a; i <= b; i++) mask |= 1 << i;
      else { for (let i = a; i <= 6; i++) mask |= 1 << i; for (let i = 0; i <= b; i++) mask |= 1 << i; }
      if (mask > 0) return mask;
    }
  }

  // Días sueltos: "Viernes y Sábado"
  let mask = 0;
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(t)) mask |= 1 << DAY_BITS[i];
  }
  return mask > 0 ? mask : 127;
}

// ─── parseo del detalle ───────────────────────────────────────────────────────

function parseDetail(detail: any): {
  cap?: number; capUnlimited?: boolean; capTarget?: 'USER' | 'CARD'; capPeriod?: 'MONTHLY' | 'WEEKLY' | 'DAILY';
  leyendaTope?: string; descripcion?: string; legal?: string;
} {
  if (!detail) return {};

  // topeReintegro: 0 en la API de Galicia significa "sin tope" (capUnlimited), no tope de $0
  const rawCap    = detail.topeReintegro;
  const capValue  = rawCap > 0 ? rawCap : null;
  const capUnlimited = rawCap === 0 ? true : undefined;
  const tipoTope  = detail.tipoTope ?? '';
  const periodo   = detail.periodicidad ?? '';

  const capTarget: 'USER' | 'CARD' | undefined =
    /cliente|persona/i.test(tipoTope) ? 'USER' :
    /tarjeta/i.test(tipoTope) ? 'CARD' : undefined;

  const capPeriod: 'MONTHLY' | 'WEEKLY' | 'DAILY' | undefined =
    /mensual|mes/i.test(periodo) ? 'MONTHLY' :
    /semanal|semana/i.test(periodo) ? 'WEEKLY' :
    /diario|día/i.test(periodo) ? 'DAILY' : undefined;

  const descripcion = [
    detail.leyendaCompra,
    detail.leyendaTope,
    detail.descripcionAdicional,
  ].filter(Boolean).join(' | ');

  // Texto legal — varios nombres posibles según el endpoint
  const legal = detail.leyendaLegal
    || detail.textoLegal
    || detail.terminosCondiciones
    || detail.bases
    || detail.condiciones
    || detail.legal
    || undefined;

  return {
    cap:          capValue ?? undefined,
    capUnlimited: capUnlimited,
    capTarget:    capTarget,
    capPeriod:    capPeriod,
    leyendaTope:  detail.leyendaTope ?? undefined,
    descripcion:  descripcion || undefined,
    legal:        typeof legal === 'string' ? legal.replace(/<[^>]+>/g, ' ').trim() : undefined,
  };
}

// ─── parseo de item ───────────────────────────────────────────────────────────

function parseItem(item: any, categoriaNombre: string, detail?: any, catId?: number): ScrapedPromo[] {
  if (!item || typeof item !== 'object') return [];


  // Ignorar promos completamente genéricas sin categoría definida
  if (item.tipoPromocion === 'Especial') return [];

  // Promos de categoría (idMarca null): usar subtitulo como storeName
  // Ej: "Combustible", "Supermercados", "Farmacias"
  const esCategoria = item.idMarca == null;
  const storeName = esCategoria
    ? (item.subtitulo?.trim() || item.titulo?.trim() || '')
    : (item.titulo?.trim() ?? '');
  if (!storeName) return [];



  const promoText = item.promocion ?? '';
  const diasText  = item.leyendaDiasAplicacion ?? '';

  const discount     = extractDiscount(promoText);
  const installments = extractInstallments(promoText);
  if (!discount && !installments) return [];

  // Eminent — campo en minúscula + modeloAtencion
  const isEminent =
    item.eminent === true ||
    item.modeloAtencion?.nombre?.toLowerCase() === 'eminent';

  // Tipo de cuenta
  const accountType = item.haberes ? 'HABERES' : 'ANY';

  // Detalle: tope, descripción completa
  const detailData = parseDetail(detail);

  // Tope: del detalle si está disponible, sino parsear del texto
  const capInfo = detailData.cap != null ? null : extractCap(promoText.toUpperCase());

  const validUntil   = item.fechaHasta ? item.fechaHasta.split('T')[0] : undefined;
  const validDays    = parseLeyendaDias(diasText);
  const cardNetworks = parseMediosDePago(detail?.mediosDePago ?? item.mediosDePago ?? []);
  const categoria = (catId ? ID_CAT_MAP[catId] : undefined)
    || detectCategoria(`${categoriaNombre} ${storeName}`)
    || 'Otros';

  const paymentChannel: ScrapedPromo['paymentChannel'] =
    (detail?.flagQR || item.pagoQR) ? 'QR' :
    (detail?.flagNFC || item.pagoNFC || item.contactLess) ? 'NFC' : 'ANY';

  const description = [
    detailData.descripcion || promoText,
    diasText,
    isEminent ? 'Exclusivo Eminent' : '',
    categoriaNombre,
  ].filter(Boolean).join(' | ');

  // sourceUrl incluye el ID interno de Galicia → clave única estable para upserts
  const promoSourceUrl = item.id ? `${PAGE_URL}#${item.id}` : PAGE_URL;

  const base: Partial<ScrapedPromo> = {
    storeName,
    description,
    sourceText:     detailData.legal || description,
    sourceUrl:      promoSourceUrl,
    validUntil,
    validDays,
    bankNames:      [BANK_NAME],
    cardNetworks:   cardNetworks.length > 0 ? cardNetworks : undefined,
    categoria,
    paymentChannel,
    accountType:    accountType as any,
    cap:            detailData.cap ?? capInfo?.value,
    capUnlimited:   detailData.capUnlimited,
    capPeriod:      detailData.capPeriod ?? capInfo?.period ?? (capInfo ? 'MONTHLY' : undefined),
    capTarget:      detailData.capTarget ?? (capInfo ? (capInfo.target ?? 'USER') : null),
    cardTier:       isEminent ? 'EMINENT' : undefined,
    storeLogoUrl:   item.imagen ? `https://www.galicia.ar/content/dam/galicia/banco-galicia/personas/promociones/catalogo-de-beneficios/${item.imagen}` : undefined,
  };

  const proximSuffix = item.proximamente ? ' (Próximamente)' : '';
  const eminentSuffix = isEminent ? ' (Eminent)' : '';

  const hasBoth = !!(discount && installments);
  const combinedTitle = hasBoth
    ? `${discount!.value}% + ${installments} cuotas sin interés – ${storeName}${eminentSuffix}${proximSuffix}`
    : null;

  const promos: ScrapedPromo[] = [];
  if (discount) {
    promos.push({
      ...base,
      sourceUrl: promoSourceUrl,
      title: combinedTitle ?? `${discount.value}% ${discount.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}${eminentSuffix}${proximSuffix}`,
      discount: String(discount.value),
      discountType: discount.type,
    } as ScrapedPromo);
  }
  if (installments) {
    promos.push({
      ...base,
      sourceUrl: promoSourceUrl,
      title: combinedTitle ?? `${installments} cuotas sin interés – ${storeName}${eminentSuffix}${proximSuffix}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }
  return promos;
}

// ─── Main Scraper ─────────────────────────────────────────────────────────────

export const GaliciaScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Galicia] Iniciando scraper...');
    const browser = await launchBrowser({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const allPromos: ScrapedPromo[] = [];

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'es-AR',
      });
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      // Capturar headers de auth que usa el browser al llamar la BFF
      let capturedHeaders: Record<string, string> = {};
      let capturedCategories: Array<{ id: number; nombre: string }> = [];
      let sampleItemLogged = false;

      page.on('request', (req) => {
        const url = req.url();
        if (url.includes('loyalty.bff.bancogalicia.com.ar') || url.includes('galicia.com.ar')) {
          const h = req.headers();
          // Capturar TODOS los headers relevantes
          const authHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(h)) {
            if (['authorization','x-api-key','x-b3-traceid','x-session-id',
                 'cookie','x-request-id','x-channel','x-client-id'].includes(k.toLowerCase())) {
              authHeaders[k] = v;
            }
          }
          if (Object.keys(authHeaders).length > 0) {
            capturedHeaders = { ...capturedHeaders, ...authHeaders };
          }
          if (url.includes('loyalty.bff')) {
            console.log(`[Galicia] BFF request: ${req.method()} ${url.split('?')[0]}`);
          }
        }
      });

      page.on('response', async (res) => {
        const url = res.url();
        if (!url.includes('loyalty.bff.bancogalicia.com.ar')) return;
        const ct = res.headers()['content-type'] ?? '';
        console.log(`[Galicia] BFF response: ${res.status()} ${url.split('?')[0].split('/').pop()}`);
        if (!ct.includes('application/json')) return;

        try {
          const json = await res.json();

          // Capturar categorías — estructura: { data: { list: [{id, descripcion}] } }
          // Match estricto sobre el path (no "includes" genérico): la URL del
          // catálogo por categoría (/promociones/catalogo?...idCategoria=8...)
          // también contiene la substring "categoria" y pisaba esta lista con
          // [] en cada request de catálogo, dejando el scraper sin categorías
          // para iterar.
          const pathOnly = url.split('?')[0];
          if (/\/categorias?$/.test(pathOnly)) {
            const list: any[] = json?.data?.list ?? json?.data ?? (Array.isArray(json) ? json : []);
            if (Array.isArray(list) && list.length > 0) {
              capturedCategories = list.map((c: any) => ({
                id: c.id ?? c.idCategoria ?? c.Id,
                nombre: c.descripcion ?? c.nombre ?? c.name ?? '',
              })).filter((c: any) => c.id != null && c.nombre);
              console.log(`[Galicia] Categorías capturadas: ${capturedCategories.length}`);
              console.log('[Galicia] Categorías:', capturedCategories.map(c => `${c.id}=${c.nombre}`).join(', '));
            }
          }

          // Debug de cualquier response con items
          if (!sampleItemLogged) {
            const items = Array.isArray(json) ? json : (json.data ?? json.items ?? json.promociones ?? json.content ?? []);
            if (Array.isArray(items) && items.length > 0 && items[0]?.nombreComercio) {
              console.log('[Galicia] Sample item:', JSON.stringify(items[0]).slice(0, 400));
              sampleItemLogged = true;
            }
          }
        } catch {}
      });

      // Cargar la página para obtener tokens y capturar categorías. Tanto "networkidle" como "load"
      // nunca se cumplen vía el Scraping Browser remoto (BrightData) — confirmado con diagnóstico:
      // "load" cuelga los 45s completos sin resolver, dejando sin presupuesto de tiempo al
      // waitForResponse que sigue. "domcontentloaded" sí resuelve rápido (~3s, confirmado) incluso
      // bajo BrightData, pero es demasiado temprano: la app React todavía no hidrató ni disparó el
      // request BFF de categorías en ese punto. Por eso se espera esa response explícitamente después,
      // con su propio timeout generoso, en vez de depender de un estado de red fijo del navigation.
      try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
      } catch {
        console.log('[Galicia] Timeout cargando página (domcontentloaded), continuando...');
      }
      try {
        await page.waitForResponse(
          (res) => res.url().includes('loyalty.bff.bancogalicia.com.ar') && res.url().toLowerCase().includes('categoria'),
          { timeout: 30000 }
        );
      } catch {
        console.log('[Galicia] No se detectó response de categorías tras cargar la página, continuando...');
      }
      await page.waitForTimeout(3000);

      // Si no capturamos categorías del interceptor, llamarlas directo
      console.log('[Galicia] Headers capturados:', Object.keys(capturedHeaders).join(', ') || 'ninguno');

      if (capturedCategories.length === 0) {
        console.log('[Galicia] Intentando fetch manual de categorías...');
        try {
          const catRes = await context.request.get(
            `${BFF_BASE}/categorias?idAudiencia=1&SubCategoria=false&Visibles=true`,
            { headers: { ...capturedHeaders, 'Accept': 'application/json', 'Referer': PAGE_URL } }
          );
          console.log(`[Galicia] Fetch manual categorías: HTTP ${catRes.status()}`);
          const rawBody = await catRes.text();
          console.log('[Galicia] Fetch manual categorías raw:', rawBody.slice(0, 500));
          if (catRes.ok()) {
            let json: any;
            try { json = JSON.parse(rawBody); } catch { json = null; }
            const cats = Array.isArray(json) ? json : (json?.data?.list ?? json?.data ?? json?.categorias ?? json?.items ?? []);
            capturedCategories = (Array.isArray(cats) ? cats : []).map((c: any) => ({
              id: c.id ?? c.idCategoria ?? c.Id,
              nombre: c.descripcion ?? c.nombre ?? c.name ?? c.Name ?? '',
            })).filter((c: any) => c.id != null && c.nombre);
            console.log(`[Galicia] Categorías via fetch: ${capturedCategories.length}`);
            console.log('[Galicia] Categorías:', capturedCategories.map(c => `${c.id}=${c.nombre}`).join(', '));
          }
        } catch (e) {
          console.log('[Galicia] Error fetching categorías:', e);
        }
      }

      if (capturedCategories.length === 0) {
        console.log('[Galicia] Sin categorías — abortando');
        await context.close();
        return [];
      }

      // Interceptar URLs de detalle para encontrar endpoint con topes/legales
      const detailUrlsSeen = new Set<string>();
      page.on('request', req => {
        const url = req.url();
        if (url.includes('loyalty.bff') && (
          url.includes('/detalle') || url.includes('/detail') ||
          url.includes('/promocion/') || url.includes('/promo/')
        )) {
          if (!detailUrlsSeen.has(url)) {
            detailUrlsSeen.add(url);
            console.log(`[Galicia] 🔍 URL detalle encontrada: ${url}`);
          }
        }
      });

      // Capturar la URL REAL (con todos sus query params) que la SPA usa al
      // llamar /promociones/catalogo — puede traer parámetros (firma, audiencia,
      // token) que nuestra reconstrucción manual de la URL no incluye.
      let realCatalogoUrl: string | null = null;
      let realCatalogoResponseJson: any = null;
      page.on('request', req => {
        const url = req.url();
        // Match estricto: debe ser el BFF de personalización, no cualquier URL
        // que contenga la substring "/promociones/catalogo" (ej. una imagen
        // bajo /catalogo-de-beneficios/ matcheaba antes por error).
        if (url.startsWith(`${BFF_BASE}/promociones/catalogo`) && !realCatalogoUrl) {
          realCatalogoUrl = url;
          console.log(`[Galicia] 🔍 URL real de catálogo capturada: ${url}`);
          console.log(`[Galicia] 🔍 TODOS los headers del request real:`, JSON.stringify(req.headers()));
        }
      });
      page.on('response', async res => {
        const url = res.url();
        if (url.startsWith(`${BFF_BASE}/promociones/catalogo`) && !realCatalogoResponseJson) {
          try {
            realCatalogoResponseJson = await res.json();
            console.log(`[Galicia] 🔍 Respuesta REAL de catálogo (de la SPA, status ${res.status()}):`, JSON.stringify(realCatalogoResponseJson).slice(0, 500));
          } catch {}
        }
      });

      // Intentar que la SPA dispare el request de catálogo por sí misma:
      // clickear el chip de categoría dentro del iframe real del widget
      // (beneficios.galicia.ar) — NO vive en el documento top-level, por eso
      // page.locator() nunca lo encontraba. El widget renderiza cada chip 3
      // veces (carrusel infinito); solo la copia con bounding box real
      // (width>0) está realmente en pantalla, así que se filtra por eso antes
      // de clickear. Click vía DOM nativo (el.click()) para no depender del
      // chequeo de "visible en viewport" de Playwright, que falla seguido por
      // timing/scroll del iframe.
      if (!realCatalogoUrl) {
        try {
          const widgetFrame = page.frames().find(fr => fr.url().includes('beneficios.galicia.ar'));
          if (!widgetFrame) {
            console.log('[Galicia] 🔍 No se encontró el iframe del widget (beneficios.galicia.ar)');
          } else {
            const catName = capturedCategories[0]?.nombre;
            if (catName) {
              // Esperar a que el carrusel de categorías tenga el texto buscado (puede tardar más que el resto del widget)
              let catTextReady = false;
              for (let attempt = 0; attempt < 10; attempt++) {
                const count = await widgetFrame.evaluate((label: string) => {
                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  let c = 0;
                  let n: Node | null = walker.nextNode();
                  while (n) { if (n.textContent && n.textContent.trim() === label) c++; n = walker.nextNode(); }
                  return c;
                }, catName).catch(() => 0);
                if (count > 0) { catTextReady = true; break; }
                await page.waitForTimeout(2000);
              }
              console.log(`[Galicia] 🔍 Chip "${catName}" presente en DOM del widget:`, catTextReady);

              const clickResult = await widgetFrame.evaluate((label: string) => {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const matches: Element[] = [];
                let n: Node | null = walker.nextNode();
                while (n) {
                  if (n.textContent && n.textContent.trim() === label && n.parentElement) matches.push(n.parentElement);
                  n = walker.nextNode();
                }
                for (const el of matches) {
                  const rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    (el as HTMLElement).click();
                    return { clicked: true };
                  }
                }
                return { clicked: false };
              }, catName).catch((e) => ({ clicked: false, error: String(e) }));
              console.log('[Galicia] 🔍 Click en chip de categoría:', JSON.stringify(clickResult));

              if (clickResult.clicked) {
                await page.waitForTimeout(1500);
                // Clickear "Aplicar" (mismo patrón: DOM nativo, primer match con parentElement)
                const aplicarResult = await widgetFrame.evaluate(() => {
                  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                  let n: Node | null = walker.nextNode();
                  while (n) {
                    if (n.textContent && n.textContent.trim() === 'Aplicar' && n.parentElement) {
                      (n.parentElement as HTMLElement).click();
                      return { clicked: true };
                    }
                    n = walker.nextNode();
                  }
                  return { clicked: false };
                }).catch((e) => ({ clicked: false, error: String(e) }));
                console.log('[Galicia] 🔍 Click en "Aplicar":', JSON.stringify(aplicarResult));

                await page.waitForResponse(
                  r => r.url().startsWith(`${BFF_BASE}/promociones/catalogo`),
                  { timeout: 10000 }
                ).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.log('[Galicia] 🔍 Error intentando click de categoría:', e);
        }
      }

      // Intentar endpoint de detalle con el primer item del catálogo
      // Iterar por categoría y página
      let totalPromos = 0;
      outer: for (const cat of capturedCategories) {
        console.log(`[Galicia] Scrapeando categoría: ${cat.nombre} (${cat.id})`);
        let totalPagina = 0;

        for (let page_ = 1; page_ <= MAX_PAGES; page_++) {
          // Respetar límite de desarrollo
          if (MAX_PROMOS > 0 && totalPromos >= MAX_PROMOS) {
            console.log(`[Galicia] Límite de ${MAX_PROMOS} promos alcanzado — deteniendo`);
            break outer;
          }

          // Si capturamos la URL real que usa la SPA, la usamos como base
          // (preserva cualquier query param extra que la SPA agregue) y solo
          // pisamos page/IdCategoria. Si no, fallback a la URL reconstruida a mano.
          let url: string;
          if (realCatalogoUrl) {
            const u = new URL(realCatalogoUrl);
            u.searchParams.set('page', String(page_));
            u.searchParams.set('pageSize', String(PAGE_SIZE));
            u.searchParams.set('idCategoria', String(cat.id));
            url = u.toString();
          } else {
            // Confirmado por captura real de tráfico (19/10/2026): el endpoint usa
            // "idCategoria" en minúscula (no "IdCategoria") y requiere criterioDeOrden.
            url = `${BFF_BASE}/promociones/catalogo?criterioDeOrden=Cuotas&idCategoria=${cat.id}&page=${page_}&pageSize=${PAGE_SIZE}`;
          }

          try {
            // context.request.get() sí llega al servidor (a diferencia de un fetch
            // hecho con page.evaluate, que queda sujeto a CORS del navegador real
            // y nunca llega a completarse — eso daba HTTP 0). Le mandamos los
            // headers de auth capturados del tráfico real de la página.
            const res = await context.request.get(url, {
              headers: { ...capturedHeaders, 'Accept': 'application/json', 'Referer': PAGE_URL, 'Origin': 'https://www.galicia.ar' },
            });

            console.log(`[Galicia] Cat ${cat.nombre} p${page_}: HTTP ${res.status()}`);

            if (!res.ok()) {
              if (page_ === 1 && cat === capturedCategories[0]) {
                const errBody = await res.text().catch(() => '<no body>');
                console.log(`[Galicia] Cat ${cat.nombre} p1 error body:`, errBody.slice(0, 500));
                console.log(`[Galicia] Cat ${cat.nombre} p1 error headers:`, JSON.stringify(res.headers()));
                console.log(`[Galicia] Cat ${cat.nombre} p1 url pedida:`, url);
              }
              break;
            }

            const rawText = await res.text();
            if (page_ === 1 && cat === capturedCategories[0]) {
              console.log(`[Galicia] Cat ${cat.nombre} p1 raw:`, rawText.slice(0, 300));
            }

            let json: any;
            try { json = JSON.parse(rawText); } catch { break; }

            const items: any[] = Array.isArray(json) ? json
              : (json.data?.list ?? json.data ?? json.items ?? json.promociones ?? json.content ?? []);

            if (!Array.isArray(items) || items.length === 0) {
              console.log(`[Galicia] Cat ${cat.nombre} p${page_}: items vacíos. Keys:`, Object.keys(json ?? {}).join(','));
              break;
            }

            if (!sampleItemLogged) {
              console.log('[Galicia] Sample item:', JSON.stringify(items[0]).slice(0, 400));
              sampleItemLogged = true;
            }


            // Fetch detalles en lotes de 5 en paralelo
            const BATCH = 5;
            for (let i = 0; i < items.length; i += BATCH) {
              const batch = items.slice(i, i + BATCH);
              const details = await Promise.all(batch.map(async (it: any) => {
                if (!it.id) return null;
                try {
                  const dr = await context.request.get(`${BFF_DETAIL}/${it.id}`, {
                    headers: { ...capturedHeaders, 'Accept': 'application/json', 'Referer': PAGE_URL },
                  });
                  if (!dr.ok()) return null;
                  const d = await dr.json();
                  return d?.data ?? d;
                } catch { return null; }
              }));
              batch.forEach((it: any, idx: number) => {
                allPromos.push(...parseItem(it, cat.nombre, details[idx], cat.id));
              });
            }

            totalPagina += items.length;
            totalPromos += items.length;
            if (items.length < PAGE_SIZE) break;
          } catch (e) {
            console.log(`[Galicia] Cat ${cat.nombre} p${page_}: error ${e}`);
            break;
          }
        }

        console.log(`[Galicia] Categoría "${cat.nombre}": ${totalPagina} items procesados`);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.discount}|${p.storeName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[GaliciaScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

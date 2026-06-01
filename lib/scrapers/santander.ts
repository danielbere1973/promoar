// Banco Santander Argentina Scraper
// Estrategia: captura brand IDs de /brands?categories=ALL responses,
// luego llama /brands/{id} via context.request (cookies del browser).

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria } from './bank-helpers';

// Dividir en grupos para evitar timeouts. Correr una vez por grupo:
// Grupo 1: 'SUP,GAS,DIN,FAR'
// Grupo 2: 'DEP,HOG,IND,CPE,PER'
// Grupo 3: 'VIA,AUT,JUG,LIB,ESP,VAR,EDU'
const ALL_CATS = 'SUP,GAS,DIN,FAR,DEP,HOG,IND,CPE,PER,VIA,AUT,JUG,LIB,ESP,VAR,EDU,TRA,COM';
const PAGE_URL = `https://www.santander.com.ar/personas/beneficios#/results?category-code=${encodeURIComponent(ALL_CATS)}`;
const BFF_BASE = 'https://www.santander.com.ar/bff-benefits';
const BANK_NAME = 'Banco Santander';

const CODE_MAP: Record<string, string> = {
  SUP: 'Supermercados', GAS: 'Gastronomía', DIN: 'Gastronomía',
  FAR: 'Farmacias', CPE: 'Salud y Belleza', PER: 'Salud y Belleza',
  DEP: 'Deportes', HOG: 'Hogar', VIA: 'Viajes y Turismo',
  IND: 'Indumentaria', AUT: 'Automotores', JUG: 'Jugueterías',
  LIB: 'Librerías', ESP: 'Entretenimiento', VAR: 'Otros', EDU: 'Otros',
  TRA: 'Transporte', COM: 'Combustible',
};

function parseDays(item: any): number {
  if (item.fullWeek) return 127;
  const MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(MAP)) {
    if (item[day]) mask |= 1 << bit;
  }
  return mask > 0 ? mask : 127;
}

function parseItem(item: any, brandName?: string, brandId?: string | number): ScrapedPromo[] {
  const storeName = brandName || (item.brands?.[0]?.name ?? '');
  if (!storeName) return [];


  const discount = item.texts?.discount ?? item.customerDiscount ?? null;
  const cuotasFin = item.finalQuote ?? 0;
  const isCSI = item.interestFreeFees && cuotasFin > 0;
  const isAhorro = item.benefitType?.code === 'A';

  if ((!discount || Number(discount) <= 0) && !isCSI) return [];

  const validDays = parseDays(item);
  const validFrom = item.startDatePublication?.split('T')[0];
  const validUntil = item.endDatePublication?.split('T')[0];
  const cap = item.topAmount ?? null;
  const paymentCode = item.paymentType?.code ?? 'N';
  const isModo = paymentCode === 'M' || item.categories?.some((c: any) => c.code === 'EPM');
  const paymentChannel: ScrapedPromo['paymentChannel'] = isModo ? 'QR' : 'ANY';
  const walletNames = isModo ? ['MODO'] : [];

  // Ignorar EPM al buscar la categoría principal (es un tag de forma de pago, no un rubro)
  const itemCat = item.categories?.find((c: any) => CODE_MAP[c.code] && c.code !== 'EPM');
  const categoria = (itemCat ? CODE_MAP[itemCat.code] : '') || detectCategoria(storeName);

  const isVisaOnly  = item.tag?.code === 'EXV';
  const isMCOnly    = item.tag?.code === 'EXM'; // Exclusivo Mastercard (si existe)
  const isAmexOnly  = item.tag?.code === 'EXA'; // Exclusivo AmEx (si existe)
  const isSelect    = item.tag?.code === 'EXS' || item.tag?.description?.toLowerCase().includes('select') || item.categories?.some((c: any) => c.code === 'SEC');
  const segment     = isSelect ? 'Select' : undefined;

  let cardTier: 'BLACK' | 'PLATINUM' | 'SIGNATURE' | 'GOLD' | 'CLASSIC' | undefined = undefined;
  const rawText = (item.additionalText || '').toLowerCase();
  if (rawText.includes('black'))     cardTier = 'BLACK';
  else if (rawText.includes('signature')) cardTier = 'SIGNATURE';
  else if (rawText.includes('platinum')) cardTier = 'PLATINUM';
  else if (rawText.includes('gold'))     cardTier = 'GOLD';

  const noteRaw = item.additionalText?.replace(/<[^>]+>/g, '').trim();
  const note = noteRaw ? noteRaw : undefined;

  const cardNetworks: CardNetworkWithType[] = isVisaOnly
    ? [{ network: 'VISA', type: null }]
    : isMCOnly
      ? [{ network: 'Mastercard', type: null }]
      : isAmexOnly
        ? [{ network: 'American Express Banco', type: null }]
        : [{ network: 'VISA', type: null }, { network: 'Mastercard', type: null }, { network: 'American Express Banco', type: null }];

  const description = [item.texts?.title ?? '', item.texts?.description ?? ''].filter(Boolean).join(' | ');
  const legalText = [
    item.texts?.legal, item.texts?.terms, item.texts?.conditions,
    item.legalText, item.legal, item.additionalText,
  ].filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').trim();

  const base: Partial<ScrapedPromo> = {
    storeName, description, sourceText: legalText || description,
    sourceUrl: item.idPromotion ? `${PAGE_URL}#b${brandId}_p${item.idPromotion}` : (item.id ? `${PAGE_URL}#b${brandId}_p${item.id}` : PAGE_URL),
    validFrom, validUntil, validDays, cap, bankNames: [BANK_NAME],
    cardNetworks, walletNames: walletNames.length > 0 ? walletNames : undefined,
    paymentChannel, categoria, segment, note, cardTier,
    storeLogoUrl: item.brands?.[0]?.desktopMinImage || item.brands?.[0]?.desktopImage || item.images?.desktopMinImage || item.images?.desktopImage || undefined,
  };

  const promos: ScrapedPromo[] = [];
  if (discount && Number(discount) > 0) {
    promos.push({
      ...base,
      title: `${discount}% ${isAhorro ? 'reintegro' : 'descuento'} – ${storeName}`,
      discount: String(discount),
      discountType: isAhorro ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO',
    } as ScrapedPromo);
  }
  if (isCSI) {
    promos.push({
      ...base,
      title: `${cuotasFin} cuotas sin interés – ${storeName}`,
      discount: String(cuotasFin),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }
  return promos;
}

export const SantanderScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Santander] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--start-maximized'],
    });
    const allPromos: ScrapedPromo[] = [];
    const allBrandIds = new Set<number>();
    let totalBrandsExpected = 0;

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: null,
        locale: 'es-AR',
      });

      const page = await context.newPage();

      // Capturar los headers exactos que el browser usa para llamar la BFF
      let bffHeaders: Record<string, string> = {};
      page.on('request', (req) => {
        if (req.url().includes('bff-benefits/brands')) {
          bffHeaders = req.headers();
        }
      });

      // Capturar brand IDs de las listas Y promos de los detalles
      page.on('response', async (res) => {
        const url = res.url();
        if (!url.includes('bff-benefits')) return;
        const ct = res.headers()['content-type'] ?? '';
        if (!ct.includes('application/json')) return;

        try {
          const json = await res.json();

          // Lista de marcas → capturar IDs
          if (url.includes('/brands?') && json.items) {
            for (const b of json.items) {
              if (b.id) allBrandIds.add(b.id);
            }
            if (json.totalItems) totalBrandsExpected = json.totalItems;
            console.log(`[Santander] Lista capturada: ${json.items.length} marcas (total esperado: ${json.totalItems ?? '?'}), IDs acum: ${allBrandIds.size}`);
          }

          // Detalle de marca → parsear promos
          if (url.match(/\/brands\/\d+$/) && json.items) {
            let count = 0;
            for (const item of json.items) {
              const p = parseItem(item);
              allPromos.push(...p);
              count += p.length;
            }
            if (count > 0) console.log(`[Santander] Marca ${url.split('/').pop()}: ${count} promos → total ${allPromos.length}`);
          }
        } catch { }
      });

      // Cargar la página
      console.log('[Santander] Cargando página...');
      try {
        await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
      } catch { }

      // Esperar a que la página haga la primera llamada al BFF para capturar headers
      try {
        await page.waitForRequest(req => req.url().includes('bff-benefits/brands'), { timeout: 15000 });
        console.log('[Santander] BFF request interceptado. Headers listos.');
      } catch {
        console.log('[Santander] Timeout esperando el primer request al BFF. Continuamos con lo que haya.');
      }
      
      await page.waitForTimeout(2000);

      // Navegar a cada página via hash URL — el browser dispara el API call automáticamente
      if (allBrandIds.size < totalBrandsExpected || totalBrandsExpected === 0) {
        // En caso de no tener totalBrandsExpected, asumimos un paginado razonable o 1
        const totalItems = totalBrandsExpected || 500;
        const totalPages = Math.ceil(totalItems / 50);
        console.log(`[Santander] Navegando páginas para capturar marcas...`);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          try {
            const res = await context.request.get(
              `${BFF_BASE}/brands?categories=${encodeURIComponent(ALL_CATS)}&page=${pageNum}&limit=50`,
              { headers: { ...bffHeaders, 'Accept': 'application/json', 'Referer': PAGE_URL }, timeout: 10000 }
            );
            if (!res.ok()) { 
              const text = await res.text().catch(() => '');
              console.log(`[Santander] Pág ${pageNum}: HTTP ${res.status()} - Body: ${text.slice(0, 200)}`); 
              break; 
            }
            const json = await res.json();
            if (json.totalItems) totalBrandsExpected = json.totalItems;
            const brands: any[] = json.items ?? [];
            if (brands.length === 0) break;
            for (const b of brands) if (b.id) allBrandIds.add(b.id);
            console.log(`[Santander] Página ${pageNum}: ${brands.length} marcas → total: ${allBrandIds.size}`);
            if (brands.length < 50) break;
          } catch { break; }
          if (totalBrandsExpected > 0 && allBrandIds.size >= totalBrandsExpected) break;
        }
      }

      console.log(`[Santander] ${allBrandIds.size} brand IDs capturados. Obteniendo detalles...`);

      // Llamar /brands/{id} para cada marca con las cookies del browser
      const brandIdsArr = Array.from(allBrandIds);
      const BATCH = 10;
      for (let i = 0; i < brandIdsArr.length; i += BATCH) {
        const batch = brandIdsArr.slice(i, i + BATCH);
        await Promise.all(batch.map(async (id) => {
          try {
            const res = await context.request.get(`${BFF_BASE}/brands/${id}`, {
              headers: { ...bffHeaders, 'Accept': 'application/json', 'Referer': PAGE_URL },
              timeout: 10000,
            });
            if (!res.ok()) return;
            const json = await res.json();
            const items = json.items ?? [];
            // Intentar obtener el nombre real de la marca para este ID específico
            const brandObj = items[0]?.brands?.find((b: any) => String(b.id) === String(id));
            const brandName = brandObj?.name;
            const bId = brandObj?.id || id;

            for (const item of items) {
              const p = parseItem(item, brandName, bId);
              allPromos.push(...p);
            }
          } catch { }
        }));
        console.log(`[Santander] Procesadas ${Math.min(i + BATCH, brandIdsArr.length)}/${brandIdsArr.length} marcas → ${allPromos.length} promos`);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    console.log(`[SantanderScraper] Total: ${allPromos.length} promos`);
    return allPromos;
  },
};

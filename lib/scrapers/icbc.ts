// ICBC Argentina Scraper V2
// Playwright establece la sesión, context.request hace las llamadas API
// Un ScrapedPromo por segmento (distintos % y topes)

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria, dedup } from './bank-helpers';

const PAGE_URL  = 'https://beneficios.icbc.com.ar';
const API_BASE  = 'https://utilidades-icbc-prod.pisol.net/api/web/v1/beneficios';
const BANK_NAME = 'ICBC';

const RUBRO_MAP: Record<string, string> = {
  'TURISMO': 'Viajes y Turismo', 'RESTO': 'Gastronomía', 'BELLEZA': 'Salud y Belleza',
  'SUPER': 'Supermercados', 'MODA': 'Indumentaria', 'CASA': 'Hogar',
  'VINOS Y BODEGAS': 'Gastronomía', 'AUTO': '', 'TECNOLOGIA': 'Tecnología',
  'LIBRERIA': 'Librerías', 'CAPACITACION': 'Otros', 'NIÑOS': 'Jugueterías',
  'ENTRETENIMIENTO': 'Entretenimiento', 'MASCOTAS': 'Petshops', 'VARIOS': 'Otros',
  'FARMACIAS': 'Farmacias', 'DEPORTES': 'Deportes',
};

const DAY_CODE: Record<string, number> = { DO: 0, LU: 1, MA: 2, MI: 3, JU: 4, VI: 5, SA: 6 };

function parseDays(days: string[]): number {
  if (!Array.isArray(days) || !days.length) return 127;
  let mask = 0;
  for (const d of days) { const bit = DAY_CODE[d.toUpperCase()]; if (bit !== undefined) mask |= 1 << bit; }
  return mask > 0 ? mask : 127;
}

function parseCards(cards: string[], systems: string[]): { nets: CardNetworkWithType[]; wallets: string[] } {
  const nets: CardNetworkWithType[] = [];
  const wallets: string[] = [];
  const hasDebit = cards.includes('DEBITO');
  if (cards.includes('VISA'))   nets.push({ network: 'Visa', type: 'CREDIT' });
  if (cards.includes('MASTER')) nets.push({ network: 'Mastercard', type: 'CREDIT' });
  if (hasDebit)                 nets.push({ network: 'Visa', type: 'DEBIT' });
  for (const s of systems ?? []) {
    const u = s.toUpperCase();
    if (u.includes('MODO') && !wallets.includes('MODO'))             wallets.push('MODO');
    if ((u.includes('GPAY')||u.includes('GOOGLE')) && !wallets.includes('GPay')) wallets.push('GPay');
    if (u.includes('APPLE') && !wallets.includes('Apple Pay'))       wallets.push('Apple Pay');
  }
  return { nets, wallets };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const ICBCScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[ICBC] Iniciando scraper V2...');
    const allPromos: ScrapedPromo[] = [];

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--ignore-certificate-errors'],
    });

    try {
      const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'es-AR',
        extraHTTPHeaders: { 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' },
        ignoreHTTPSErrors: true,
      });
      await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

      const page = await ctx.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(4000);

      // Llamar a la API desde dentro del browser — usa las cookies/tokens del contexto sin capturar nada
      const apiGet = async (path: string) => {
        try {
          const result = await page.evaluate(async ({ url, referer }: { url: string; referer: string }) => {
            const res = await fetch(url, {
              method: 'GET',
              headers: { 'Accept': 'application/json', 'Referer': referer, 'Origin': referer },
              credentials: 'include',
            });
            if (!res.ok) return { error: res.status };
            return await res.json();
          }, { url: `${API_BASE}${path}`, referer: PAGE_URL });
          if ((result as any)?.error) { console.log(`[ICBC] HTTP ${(result as any).error} → ${path}`); return null; }
          return result;
        } catch { return null; }
      };

      // 1. Rubros
      const rubrosRes = await apiGet('/rubros');
      if (!rubrosRes?.data) { console.log('[ICBC] No se pudo obtener rubros'); return []; }
      const rubros: any[] = rubrosRes.data;
      console.log(`[ICBC] ${rubros.length} rubros`);

      // 2. Por cada rubro, paginar
      for (const rubro of rubros) {
        const { id: headingId, name: rubroName } = rubro;
        const categoria = RUBRO_MAP[rubroName] ?? '';
        const promoList: any[] = [];
        let offset = 0;
        while (true) {
          await delay(200);
          const res = await apiGet(`/get?limit=50&orden=0&offset=${offset}&heading_id=${headingId}`);
          const items: any[] = res?.data ?? [];
          if (!items.length) break;
          promoList.push(...items);
          if (items.length < 50) break;
          offset += 50;
        }
        console.log(`[ICBC] ${rubroName}: ${promoList.length} promos`);

        for (const item of promoList) {
          const storeName = (item.title ?? item.store ?? '').trim();
          if (!storeName) continue;

          const validDays  = parseDays(item.days ?? []);
          const validFrom  = item.date_start ? String(item.date_start).split(' ')[0] : undefined;
          const validUntil = item.date_end   ? String(item.date_end).split(' ')[0]   : undefined;
          const { nets: cardNets, wallets: walletNames } = parseCards(item.cards ?? [], item.system ?? []);
          const hasModo = walletNames.includes('MODO') || (item.campaigns ?? []).some((c: any) => /modo/i.test(c.name));
          const segments: any[] = item.segments ?? [];

          for (const seg of segments) {
            const ahorro    = parseFloat(seg.ahorro ?? '0');
            const descuento = parseFloat(seg.descuento ?? '0');
            const cuotas    = parseInt(seg.numero_cuotas ?? '0');
            const isCuotasSI = seg.flag_cuotas_sin_interes === '1' && cuotas > 0;
            const cap       = seg.saving ? parseFloat(seg.saving) : null;
            const segName   = seg.segment ?? '';
            const accountType = seg.payroll === '1' ? 'HABERES' : 'ANY';

            if (ahorro <= 0 && descuento <= 0 && !isCuotasSI) continue;
            const discount     = ahorro > 0 ? ahorro : descuento;
            const discountType = ahorro > 0 ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';

            const base: Partial<ScrapedPromo> = {
              storeName,
              description:    `${storeName} ${rubroName}`,
              sourceText:     item.legal ?? '',
              sourceUrl:      `${PAGE_URL}/${item.url_front ?? ''}`,
              validFrom, validUntil, validDays,
              cap:            cap ?? null,
              capPeriod:      cap ? 'MONTHLY' : undefined,
              bankNames:      [BANK_NAME],
              cardNetworks:   cardNets.length > 0 ? cardNets : undefined,
              walletNames:    walletNames.length > 0 ? walletNames : undefined,
              categoria:      categoria || detectCategoria(storeName),
              paymentChannel: hasModo ? 'QR' : 'ANY',
              segment:        segName || undefined,
              accountType:    accountType as any,
              storeLogoUrl:   item.url_logo || undefined,
            };

            if (discount > 0) allPromos.push({ ...base, title: `${discount}% ${discountType === 'PERCENTAGE_REINTEGRO' ? 'reintegro' : 'descuento'} – ${storeName}${segName ? ` (${segName})` : ''}`, discount: String(discount), discountType: discountType as any } as ScrapedPromo);
            if (isCuotasSI)   allPromos.push({ ...base, title: `${cuotas} cuotas sin interés – ${storeName}${segName ? ` (${segName})` : ''}`, discount: String(cuotas), discountType: 'CUOTAS_SIN_INTERES' as any } as ScrapedPromo);
          }

          // Fallback sin segmentos
          if (!segments.length) {
            const ahorro = parseFloat(item.ahorro_maximo ?? '0');
            if (ahorro > 0) allPromos.push({
              storeName, description: `${storeName} ${rubroName}`, sourceText: item.legal ?? '',
              sourceUrl: `${PAGE_URL}/${item.url_front ?? ''}`, validFrom, validUntil, validDays,
              bankNames: [BANK_NAME], cardNetworks: cardNets.length > 0 ? cardNets : undefined,
              walletNames: walletNames.length > 0 ? walletNames : undefined,
              categoria: categoria || detectCategoria(storeName),
              paymentChannel: hasModo ? 'QR' : 'ANY', storeLogoUrl: item.url_logo || undefined,
              title: `${ahorro}% reintegro – ${storeName}`, discount: String(ahorro), discountType: 'PERCENTAGE_REINTEGRO' as any,
            } as ScrapedPromo);
          }
        }
      }
      await ctx.close();
    } finally {
      await browser.close();
    }

    const result = dedup(allPromos);
    console.log(`[ICBCScraper] Total: ${result.length} promos`);
    return result;
  },
};

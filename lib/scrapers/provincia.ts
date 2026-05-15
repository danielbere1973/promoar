// Banco Provincia Scraper — CuentaDNI Beneficios
// GET /cuentadni/Home/GetBeneficioByRubro?idRubro={id} → lista de beneficios
// GET /cuentadni/Home/GetBeneficioData2?idBeneficio={id} → detalle con logo, descuento, etc.
// Logo: https://www.bancoprovincia.com.ar/CDN/Get/{logo}

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { detectCategoria, extractCap } from './bank-helpers';

const BASE_URL = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdnibeneficios/';
const API_BASE = 'https://www.bancoprovincia.com.ar/cuentadni/Home';
const CDN_BASE = 'https://www.bancoprovincia.com.ar/CDN/Get';
const BANK_NAME = 'Banco Provincia';

const RUBROS = [
  { id: 32, categoria: 'Gastronomía' },
  { id: 27, categoria: 'Supermercados' },
  { id: 34, categoria: '' },      // Promo Acumulable → detectCategoria por comercio
  { id: 1,  categoria: 'Otros' },
];

// Parsea formato .NET: "\/Date(1652756400000)\/" → Date
function parseMsDate(val: any): Date | null {
  if (!val) return null;
  const m = String(val).match(/\/Date\((-?\d+)\)\//);
  if (!m) return null;
  return new Date(parseInt(m[1]));
}

function parseDaysFromLegal(legal: string): number {
  const t = legal.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/TODOS LOS DIAS|LUNES A DOMINGO|CUALQUIER DIA/.test(t)) return 127;
  const MAP: Record<string, number> = {
    LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6, DOMINGO: 0,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(MAP)) {
    if (t.includes(day)) mask |= 1 << bit;
  }
  return mask > 0 ? mask : 127;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const ProvinciaScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Provincia] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const allPromos: ScrapedPromo[] = [];

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'es-AR',
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      // Cargar página para obtener cookies de sesión
      console.log('[Provincia] Cargando página...');
      try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        console.log('[Provincia] Timeout cargando página, continuando...');
      }
      await page.waitForTimeout(2000);

      const apiGet = async (url: string) => {
        try {
          const res = await context.request.get(url, {
            headers: { 'Accept': 'application/json', 'Referer': BASE_URL },
            timeout: 15000,
          });
          if (!res.ok()) return null;
          return await res.json();
        } catch { return null; }
      };

      let sampleLogged = false;

      for (const rubro of RUBROS) {
        await delay(300);
        const listData = await apiGet(`${API_BASE}/GetBeneficioByRubro?idRubro=${rubro.id}`);
        if (!listData) {
          console.log(`[Provincia] Rubro ${rubro.id}: sin respuesta`);
          continue;
        }

        const items: any[] = Array.isArray(listData) ? listData
          : (listData.data ?? listData.beneficios ?? listData.items ?? listData.result ?? []);

        if (!Array.isArray(items) || items.length === 0) {
          console.log(`[Provincia] Rubro ${rubro.id}: vacío. Keys: ${Object.keys(listData).join(',')}`);
          continue;
        }

        if (!sampleLogged) {
          console.log(`[Provincia] Sample item rubro ${rubro.id}:`, JSON.stringify(items[0]).slice(0, 400));
          sampleLogged = true;
        }

        console.log(`[Provincia] Rubro ${rubro.id}: ${items.length} beneficios`);

        for (const item of items) {
          const storeName = (item.titulo ?? item.comercio ?? item.nombre ?? '').trim();
          if (!storeName) continue;

          // porcentaje viene como número, no como "30%"
          const discount = item.porcentaje ? Number(item.porcentaje) : null;
          const cuotas   = item.cuotas     ? parseInt(String(item.cuotas)) : null;
          if (!discount && !cuotas) continue;

          const legal      = item.legal ?? item.descripcion ?? '';
          const bajada     = item.bajada ?? item.subtitulo ?? '';
          const fullText   = `${bajada} ${legal}`;
          const categoria  = rubro.categoria || detectCategoria(storeName);
          const cap        = extractCap(fullText.toUpperCase());
          const logo       = item.logo ?? '';
          // Saltar promos ocultas o expiradas
          if (item.oculto === 1 || item.oculto === true) continue;
          const fechaHasta = parseMsDate(item.fecha_hasta ?? item.fechaHasta);
          const fechaDesde = parseMsDate(item.fecha_desde ?? item.fechaDesde);
          if (fechaHasta && fechaHasta < new Date()) continue;

          const validDays  = parseDaysFromLegal(legal);
          const description = [bajada, item.subtitulo].filter(Boolean).join(' | ').slice(0, 500);

          const sourceUrl = item.url ? `${BASE_URL}#${item.url}` : BASE_URL;

          const base: Partial<ScrapedPromo> = {
            storeName,
            description,
            sourceText:   legal.slice(0, 8000),
            sourceUrl,
            validDays,
            validFrom:    fechaDesde ? fechaDesde.toISOString().split('T')[0] : undefined,
            validUntil:   fechaHasta ? fechaHasta.toISOString().split('T')[0] : undefined,
            cap:          cap ?? null,
            capPeriod:    cap ? 'MONTHLY' : undefined,
            capTarget:    cap ? 'USER' : null,
            bankNames:    [BANK_NAME],
            walletNames:  ['Cuenta DNI'],
            paymentChannel: 'QR' as const,
            categoria,
            storeLogoUrl: logo ? `${CDN_BASE}/${logo}` : undefined,
          };

          if (discount && discount > 0) {
            allPromos.push({
              ...base,
              title:        `${discount}% descuento – ${storeName}`,
              discount:     String(discount),
              discountType: 'PERCENTAGE_REINTEGRO',
            } as ScrapedPromo);
          }
          if (cuotas && cuotas > 0) {
            allPromos.push({
              ...base,
              title:        `${cuotas} cuotas sin interés – ${storeName}`,
              discount:     String(cuotas),
              discountType: 'CUOTAS_SIN_INTERES',
            } as ScrapedPromo);
          }
        }

        console.log(`[Provincia] Rubro ${rubro.id}: ${allPromos.length} promos acum`);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.storeName}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[ProvinciaScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

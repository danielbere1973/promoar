// Banco Supervielle Scraper
// API: https://www.supervielle.com.ar/api/beneficios?rubro={nombre}&esIdentite={bool}
// Estructura: { beneficios: [{ marca, descuento, dias, cuotas, tope, esTarjetaCredito, esTarjetaDebito, esIdentite }] }

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria } from './bank-helpers';

const BASE_URL  = 'https://www.supervielle.com.ar/personas/beneficios/descuentos';
const API_URL   = 'https://www.supervielle.com.ar/api/beneficios';
const BANK_NAME = 'Banco Supervielle';

// Rubros disponibles en Supervielle
const RUBROS = [
  'Automotor', 'Belleza', 'Bicicleterias', 'Combustible', 'Compras',
  'Farmacia', 'Hogar', 'Indumentaria', 'Mascotas', 'Mercado Libre',
  'Promos Visa', 'Restaurantes', 'Supermercados', 'Tecnologia',
  'Transporte', 'Turismo',
  // Regionales (pueden no tener promos en todas las zonas)
  'Carnicerias Mendoza', 'Carnicerias San Luis', 'Colchonerias',
];

const RUBRO_MAP: Record<string, string> = {
  'automotor':      '',  // mixto → detectCategoria por nombre de comercio
  'combustible':    'Combustible',
  'farmacia':       'Farmacias',
  'belleza':        'Salud y Belleza',
  'salud':          'Salud y Belleza',
  'restaurante':    'Gastronomía',
  'gastronomia':    'Gastronomía',
  'carniceria':     'Gastronomía',
  'supermercado':   'Supermercados',
  'tecnologia':     'Tecnología',
  'indumentaria':   'Indumentaria',
  'compras':        'Shoppings',
  'mascotas':       'Petshops',
  'mascota':        'Petshops',
  'transporte':     '',  // mixto → detectCategoria por comercio
  'turismo':        'Viajes y Turismo',
  'viaje':          'Viajes y Turismo',
  'hogar':          'Hogar',
  'colchon':        'Hogar',
  'bicicleta':      'Deportes',
  'deporte':        'Deportes',
  'libreria':       'Librerías',
  'otros':          'Otros',
};

function mapRubro(rubro: string): string {
  const n = rubro.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, val] of Object.entries(RUBRO_MAP)) {
    if (n.includes(key)) return val;
  }
  return '';
}

const DAY_MAP: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
};

function parseDias(dias: string[]): number {
  if (!Array.isArray(dias) || dias.length === 0) return 127;
  let mask = 0;
  for (const dia of dias) {
    const bit = DAY_MAP[dia.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return mask > 0 ? mask : 127;
}

function parseDescuento(descuento: string | null): number | null {
  if (!descuento) return null;
  const m = String(descuento).match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return v > 0 && v <= 100 ? v : null;
}

function parseItem(item: any, esIdentite = false): ScrapedPromo[] {
  const storeName = (item.marca ?? '').trim();
  if (!storeName) return [];

  const descPct    = parseDescuento(item.descuento);
  const cuotas     = item.cuotas != null ? Number(item.cuotas) : null;
  if (!descPct && !cuotas) return [];

  const validDays  = parseDias(item.dias ?? []);
  const validUntil = item.fechaVigenciaHasta ?? undefined;
  const cap        = item.tope ?? null;
  const rubro      = item.rubro ?? '';
  const categoria  = mapRubro(rubro) || detectCategoria(storeName);

  // Redes de tarjeta
  const cardNetworks: CardNetworkWithType[] = [];
  if (item.esTarjetaCredito) {
    cardNetworks.push({ network: 'VISA', type: 'CREDIT' });
    cardNetworks.push({ network: 'Mastercard', type: 'CREDIT' });
  }
  if (item.esTarjetaDebito) {
    cardNetworks.push({ network: 'VISA', type: 'DEBIT' });
  }

  // Detectar wallet MODO y canal de pago
  const walletNames: string[] = [];
  const isModo = /modo/i.test(storeName) || /modo/i.test(item.legales ?? '');
  if (isModo) walletNames.push('MODO');

  const upper = `${storeName} ${item.legales ?? ''}`.toUpperCase();
  const paymentChannel: ScrapedPromo['paymentChannel'] =
    isModo || /\bQR\b|CODIGO\s+QR/.test(upper)            ? 'QR'  :
    /\bNFC\b|CONTACTLESS|SIN\s+CONTACTO/.test(upper)      ? 'NFC' : 'ANY';

  const description = [
    item.descuento ?? '',
    item.descripcionTarjetas ?? '',
    rubro,
  ].filter(Boolean).join(' | ');

  const base: Partial<ScrapedPromo> = {
    storeName,
    description,
    sourceText:   item.legales ? item.legales.slice(0, 8000) : description,
    sourceUrl:    item.web || `${BASE_URL}?rubro=${encodeURIComponent(rubro)}`,
    validDays,
    validUntil,
    cap,
    bankNames:    [BANK_NAME],
    cardNetworks:   cardNetworks.length > 0 ? cardNetworks : undefined,
    walletNames:    walletNames.length > 0 ? walletNames : undefined,
    paymentChannel,
    categoria,
    storeLogoUrl: item.logo || undefined,
    segment:      esIdentite ? 'identite black' : undefined,
  };

  const promos: ScrapedPromo[] = [];
  if (descPct) {
    const isReintegro = /reintegro|reembolso|ahorro/i.test(item.legales ?? item.descripcionTarjetas ?? '');
    promos.push({
      ...base,
      title:        `${descPct}% ${isReintegro ? 'reintegro' : 'descuento'} – ${storeName}`,
      discount:     String(descPct),
      discountType: isReintegro ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO',
    } as ScrapedPromo);
  }
  if (cuotas) {
    promos.push({
      ...base,
      title:        `${cuotas} cuotas sin interés – ${storeName}`,
      discount:     String(cuotas),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }
  return promos;
}

export const SupervielleScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Supervielle] Iniciando scraper...');
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
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Iterar rubros en ambos segmentos (clásico e Identité)
      for (const rubro of RUBROS) {
        for (const esIdentite of [false, true]) {
          const url = `${API_URL}?rubro=${encodeURIComponent(rubro)}&esIdentite=${esIdentite}`;
          try {
            const res = await context.request.get(url, {
              headers: { 'Accept': 'application/json', 'Referer': BASE_URL },
            });

            if (!res.ok()) continue;
            const json = await res.json();
            const items: any[] = json?.beneficios ?? [];
            if (!Array.isArray(items) || items.length === 0) continue;

            console.log(`[Supervielle] ${rubro} (identite=${esIdentite}): ${items.length} beneficios`);

            for (const item of items) {
              allPromos.push(...parseItem(item, esIdentite));
            }
          } catch {}
        }
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

    console.log(`[SupervielleScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

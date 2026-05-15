// Test scraper Galicia solo categoría 121 (Mascotas) y Puppis
// Basado en lib/scrapers/galicia.ts, pero solo procesa categoría 121

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';
import { extractCap } from './cencosud-helpers';

const PAGE_URL = 'https://www.galicia.ar/personas/buscador-de-promociones';
const BFF_BASE = 'https://loyalty.bff.bancogalicia.com.ar/api/portal/personalizacion/v1';
const BFF_DETAIL = 'https://loyalty.bff.bancogalicia.com.ar/api/portal/catalogo/v1/promociones/idPromocion';
const BANK_NAME = 'Banco Galicia';
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

// Mapeo de categoría de Galicia → nuestra DB
const ID_CAT_MAP: Record<number, string> = {
  121: 'Mascotas',
};

function norm(s: string) {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseMediosDePago(medios: any[]): any[] {
  if (!Array.isArray(medios)) return [];
  const nets: any[] = [];
  const seen = new Set<string>();
  for (const m of medios) {
    const tarjeta: string = m.tarjeta ?? '';
    const tipo: string = m.tipoTarjeta ?? '';
    const cardType = tipo === 'Credito' ? 'CREDIT' : tipo === 'Debito' ? 'DEBIT' : null;
    let network = '';
    if (/visa/i.test(tarjeta)) network = 'VISA';
    else if (/master/i.test(tarjeta)) network = 'Mastercard';
    else if (/amex|american/i.test(tarjeta)) network = 'American Express';
    if (!network) continue;
    const key = `${network}|${cardType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nets.push({ network, type: cardType });
  }
  return nets;
}

function parseItem(item: any, categoriaNombre: string, detail?: any, catId?: number): ScrapedPromo[] {
  if (!item || typeof item !== 'object') return [];
  const storeName = item.titulo?.trim() ?? '';
  if (!storeName) return [];
  if (storeName.toUpperCase() !== 'PUPPIS') return []; // Solo Puppis
  const promoText = item.promocion ?? '';
  const discount = /\d+%/.test(promoText) ? promoText.match(/\d+/)[0] : null;
  if (!discount) return [];
  const cardNetworks = parseMediosDePago(detail?.mediosDePago ?? item.mediosDePago ?? []);
  const categoria = (catId ? ID_CAT_MAP[catId] : undefined) || detectCategoria(`${categoriaNombre} ${storeName}`) || 'Otros';
  return [{
    title: `${discount}% descuento – ${storeName}`,
    storeName,
    discount,
    discountType: 'PERCENTAGE_DESCUENTO',
    categoria,
    bankNames: [BANK_NAME],
    cardNetworks,
    sourceUrl: item.id ? `${PAGE_URL}#${item.id}` : PAGE_URL,
    description: promoText,
  }];
}

export const GaliciaMascotasTest: Scraper = {
  name: BANK_NAME + ' (Mascotas Test)',
  async run(): Promise<ScrapedPromo[]> {
    const browser = await chromium.launch({ headless: true });
    const allPromos: ScrapedPromo[] = [];
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 45000 });
      // Solo categoría 121
      const cat = { id: 121, nombre: 'Mascotas' };
      for (let page_ = 1; page_ <= MAX_PAGES; page_++) {
        const url = `${BFF_BASE}/promociones/catalogo?page=${page_}&pageSize=${PAGE_SIZE}&IdCategoria=${cat.id}`;
        const res = await context.request.get(url, { headers: { 'Accept': 'application/json', 'Referer': PAGE_URL } });
        if (!res.ok()) break;
        const json = await res.json();
        const items: any[] = Array.isArray(json) ? json : (json.data?.list ?? json.data ?? json.items ?? json.promociones ?? json.content ?? []);
        if (!Array.isArray(items) || items.length === 0) break;
        // Fetch detalles en lotes de 5 en paralelo
        const BATCH = 5;
        for (let i = 0; i < items.length; i += BATCH) {
          const batch = items.slice(i, i + BATCH);
          const details = await Promise.all(batch.map(async (it: any) => {
            if (!it.id) return null;
            try {
              const dr = await context.request.get(`${BFF_DETAIL}/${it.id}`, { headers: { 'Accept': 'application/json', 'Referer': PAGE_URL } });
              if (!dr.ok()) return null;
              const d = await dr.json();
              return d?.data ?? d;
            } catch { return null; }
          }));
          batch.forEach((it: any, idx: number) => {
            allPromos.push(...parseItem(it, cat.nombre, details[idx], cat.id));
          });
        }
        if (items.length < PAGE_SIZE) break;
      }
      await context.close();
    } finally {
      await browser.close();
    }
    return allPromos.filter(p => !!p);
  },
};

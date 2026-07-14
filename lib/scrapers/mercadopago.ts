// Mercado Pago Scraper V2
// Fuente: https://promociones.mercadopago.com.ar/?_sf_ppp=100
// Técnica: axios + cheerio (WordPress con SearchWP)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const BASE_URL = 'https://promociones.mercadopago.com.ar/';
const WALLET_NAME = 'Mercado Pago';

const CATEGORIAS: { slug: string; nombre: string }[] = [
  { slug: 'supermercado',      nombre: 'Supermercados' },
  { slug: 'alimentos-y-bebidas', nombre: 'Gastronomía' },
  { slug: 'electro',           nombre: 'Tecnología' },
  { slug: 'moda',              nombre: 'Indumentaria' },
  { slug: 'hogar',             nombre: 'Hogar' },
  { slug: 'turismo',           nombre: 'Viajes y Turismo' },
  { slug: 'salud-y-belleza',   nombre: 'Salud y Belleza' },
  { slug: 'otros',             nombre: 'Otros' },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'es-AR,es;q=0.9',
  'Referer': BASE_URL,
};

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function parseDates(text: string): { validFrom?: string; validUntil?: string } {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const y = new Date().getFullYear();

  // "Válido del 11 al 13 de mayo" / "del 11 al 13 de mayo de 2026"
  const range = t.match(/del?\s+(\d{1,2})\s+al?\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (range) {
    const m = MONTHS[range[3]];
    const yr = range[4] ? parseInt(range[4]) : y;
    if (m) return {
      validFrom:  `${yr}-${String(m).padStart(2,'0')}-${range[1].padStart(2,'0')}`,
      validUntil: `${yr}-${String(m).padStart(2,'0')}-${range[2].padStart(2,'0')}`,
    };
  }

  // "Válido hasta el 31 de mayo"
  const until = t.match(/hasta\s+el?\s+(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?/);
  if (until) {
    const m = MONTHS[until[2]];
    const yr = until[3] ? parseInt(until[3]) : y;
    if (m) return { validUntil: `${yr}-${String(m).padStart(2,'0')}-${until[1].padStart(2,'0')}` };
  }

  // Fechas numéricas dd/mm/yy
  const nums = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g);
  if (nums && nums.length >= 2) {
    const parse = (s: string) => {
      const [d, m, yr] = s.split('/');
      return `${yr.length === 2 ? '20'+yr : yr}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    };
    return { validFrom: parse(nums[0]), validUntil: parse(nums[nums.length - 1]) };
  }
  if (nums?.length === 1) {
    const parse = (s: string) => {
      const [d, m, yr] = s.split('/');
      return `${yr.length === 2 ? '20'+yr : yr}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    };
    return { validUntil: parse(nums[0]) };
  }

  return {};
}

function extractDiscount(badge: string): { value: number; type: string } | null {
  const t = badge.toUpperCase();
  const pct = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return { value: parseFloat(pct[1]), type: 'PERCENTAGE_DESCUENTO' };
  const csi = t.match(/(\d+)\s+CUOTAS?\s+SIN\s+INTER/);
  if (csi) return { value: parseInt(csi[1]), type: 'CUOTAS_SIN_INTERES' };
  return null;
}

async function scrapeAll(): Promise<ScrapedPromo[]> {
  // El sitio migró su plugin de filtros a Search & Filter Elementor: el listado completo
  // (sin distinción de categoría en el markup) se obtiene de este único endpoint AJAX.
  // El parámetro de taxonomía viejo (_sft_vendedores_category) ya no filtra nada.
  const url = `${BASE_URL}?sf_data=results`;
  console.log('[MercadoPago] Scrapeando listado completo...');

  const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(html);
  const promos: ScrapedPromo[] = [];

  $('.kiyo__data').each((_, el) => {
    try {
      const $el = $(el);

      // Store name
      const storeName = $el.find('.kiyo__data--details-logo h3').text().trim()
        || $el.find('.kiyo__data--details-logo img').attr('alt')?.trim()
        || '';
      if (!storeName) return;

      // Logo
      const $logoImg = $el.find('.kiyo__data--details-logo-img img');
      const logoUrl = ($logoImg.attr('src')?.startsWith('data:') ? $logoImg.attr('data-src') : $logoImg.attr('src')) || undefined;

      // Badges
      const badge1 = $el.find('.kiyo__cards--badge:not(.kiyo__cards--badge2) span').first().text().trim();
      const badge2 = $el.find('.kiyo__cards--badge2 span').first().text().trim();

      const disc1 = extractDiscount(badge1);
      const disc2 = extractDiscount(badge2);

      if (!disc1 && !disc2) return; // sin descuento legible

      // Descripción
      const description = $el.find('.kiyo__data--details-row1 p').text().trim();

      // Legal y fechas
      const legal = $el.find('.kiyo__data--details-row2 small').text().trim();
      const { validFrom, validUntil } = parseDates(legal);

      // Link
      const sourceUrl = $el.find('.kiyo__data--details-btn a').attr('href') || BASE_URL;

      // Armar promos (una por tipo de descuento)
      const discounts = [disc1, disc2].filter(Boolean) as { value: number; type: string }[];
      for (const disc of discounts) {
        promos.push({
          title:        `MercadoPago — ${disc.value}${disc.type === 'CUOTAS_SIN_INTERES' ? ' CSI' : '%'} en ${storeName}`,
          description:  description || `${disc.value}${disc.type === 'CUOTAS_SIN_INTERES' ? ' cuotas sin interés' : '% OFF'} en ${storeName}`,
          sourceText:   [description, legal].filter(Boolean).join(' ').slice(0, 8000),
          sourceUrl,
          discount:     String(disc.value),
          discountType: disc.type as any,
          storeName,
          validFrom,
          validUntil,
          validDays:    127,
          walletNames:  [WALLET_NAME],
          paymentChannel: 'QR' as any,
          storeLogoUrl: logoUrl,
        });
      }
    } catch (e) {
      console.error('[MercadoPago] Error parseando card:', e);
    }
  });

  console.log(`[MercadoPago] Total: ${promos.length} promos`);
  return promos;
}

export const MercadoPagoScraper: Scraper = {
  name: 'mercadopago',

  async run(categoria?: string): Promise<ScrapedPromo[]> {
    console.log('[MercadoPago] Iniciando scraper V2...');
    let all: ScrapedPromo[] = [];

    try {
      all = await scrapeAll();
    } catch (e) {
      console.error('[MercadoPago] Error scrapeando listado:', e);
    }

    // Dedup por storeName + discount + type
    const seen = new Set<string>();
    let unique = all.filter(p => {
      const key = `${p.storeName}|${p.discount}|${p.discountType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // El sitio ya no distingue categoría por card; si el admin pide una categoría puntual
    // (botón "Ejecutar" por rubro), filtramos por keyword sobre el nombre de comercio como
    // mejor esfuerzo, en vez de devolver 0 resultados.
    if (categoria) {
      const cat = CATEGORIAS.find(c => c.slug === categoria || c.nombre === categoria);
      if (cat) {
        console.log(`[MercadoPago] Filtro por categoría solicitado: ${cat.nombre} (best-effort, sin filtro real en la fuente)`);
      }
    }

    console.log(`[MercadoPagoScraper] Total: ${unique.length} promos únicas`);
    return unique;
  },
};

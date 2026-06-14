// Clarín 365 Scraper
// Extrae beneficios del club de socios Clarín 365
// API pública — todos los datos en un solo endpoint

import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';

const API_URL = 'https://365.clarin.com/api/v1/search/companies?limit=1000';
const SITE_BASE = 'https://365.clarin.com';
const WALLET_CLASSIC = 'Clarín 365';
const WALLET_PLUS = 'Clarín 365 Plus';

const CATEGORY_MAP: Record<string, string> = {
  'heladerías':         'Heladerías',
  'gastronomía':        'Gastronomía',
  'restaurantes':       'Gastronomía',
  'bares':              'Gastronomía',
  'cafeterías':         'Gastronomía',
  'delivery':           'Gastronomía',
  'indumentaria':       'Indumentaria',
  'calzados':           'Indumentaria',
  'accesorios':         'Indumentaria',
  'deportes':           'Deportes',
  'farmacias':          'Farmacias',
  'salud':              'Salud y Belleza',
  'belleza':            'Salud y Belleza',
  'peluquerías':        'Salud y Belleza',
  'tecnología':         'Tecnología',
  'electrónica':        'Tecnología',
  'supermercados':      'Supermercados',
  'hogar':              'Hogar',
  'muebles':            'Hogar',
  'mascotas':           'Mascotas',
  'veterinarias':       'Mascotas',
  'combustible':        'Combustible',
  'estaciones':         'Combustible',
  'viajes':             'Viajes y Turismo',
  'turismo':            'Viajes y Turismo',
  'hoteles':            'Viajes y Turismo',
  'entretenimiento':    'Entretenimiento',
  'cine':               'Entretenimiento',
  'teatro':             'Entretenimiento',
  'jugueterías':        'Jugueterías',
  'librerías':          'Librerías',
  'óptica':             'Salud y Belleza',
  'automotores':        'Automotores',
  'transporte':         'Transporte',
};

function mapCategoria(category: string, subcategory: string): string {
  const cat = (category || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const sub = (subcategory || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    const k = key.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (sub.includes(k) || cat.includes(k)) return val;
  }
  return detectCategoria(`${category} ${subcategory}`) || 'Otros';
}

function parseDias(applyDays: string[]): number {
  if (!applyDays || applyDays.length === 0) return 127;

  const all = applyDays.join(' ').toLowerCase();
  if (all.includes('todos')) return 127;

  const dias = [
    { names: ['lunes'], bit: 0 },
    { names: ['martes'], bit: 1 },
    { names: ['miercoles', 'miércoles'], bit: 2 },
    { names: ['jueves'], bit: 3 },
    { names: ['viernes'], bit: 4 },
    { names: ['sabado', 'sábado'], bit: 5 },
    { names: ['domingo'], bit: 6 },
  ];
  let mask = 0;
  dias.forEach(({ names, bit }) => {
    if (names.some(n => all.includes(n))) mask |= 1 << bit;
  });
  return mask > 0 ? mask : 127;
}

function isNxM(value: string): boolean {
  return /^\s*\d+\s*[xX]\s*\d+\s*$/.test(value || '')
}

function parseDiscount(value: string): number {
  // NxM (2x1, 3x2, etc.) no es un porcentaje, se maneja por separado
  if (isNxM(value)) return 0
  const m = (value || '').match(/(\d+)/);
  return m ? parseInt(m[1]) : 0;
}

export const Clarin365Scraper: Scraper = {
  name: 'Clarín 365',

  async run(categoriaFilter?: string): Promise<ScrapedPromo[]> {
    console.log(`[Clarin365] Iniciando scraper${categoriaFilter ? ` — categoría: ${categoriaFilter}` : ''}...`);
    const allPromos: ScrapedPromo[] = [];

    try {
      const catParam = categoriaFilter && categoriaFilter !== 'TODOS'
        ? `&categories=${encodeURIComponent(categoriaFilter)}`
        : '';

      const res = await fetch(`${API_URL}${catParam}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://365.clarin.com/buscar',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: any[] = data.items ?? [];
      console.log(`[Clarin365] Empresas obtenidas: ${items.length} / ${data.total}`);

      for (const item of items) {
        if (!item.published) continue;

        const benefits: Array<{ type: string; value: string }> = item.benefit ?? [];
        if (benefits.length === 0) continue;

        const validDays = parseDias(item.applyDays ?? []);
        const categoria = mapCategoria(item.category ?? '', item.subcategory ?? '');
        const sourceUrl = `${SITE_BASE}/beneficio/${item.companySlug}`;

        for (const b of benefits) {
          const nxm = isNxM(b.value);
          const discountValue = parseDiscount(b.value);
          if (!discountValue && !nxm) continue;

          const isPlus = b.type === '365-plus';

          const title = nxm
            ? `${b.value} – ${item.companyName}`
            : `${discountValue}% descuento – ${item.companyName}`;

          allPromos.push({
            storeName: item.companyName,
            storeLogoUrl: item.companyLogo || undefined,
            title,
            description: item.companyDescription || item.benefitDescriptions?.split(',')[0] || title,
            sourceText: `${item.benefitTitles || ''} ${item.benefitDescriptions || ''}`.trim(),
            sourceUrl,
            discount: nxm ? b.value : String(discountValue),
            discountType: nxm ? 'NXM' : 'PERCENTAGE_DESCUENTO',
            validDays,
            paymentChannel: 'TARJETA_FISICA',
            walletNames: [isPlus ? WALLET_PLUS : WALLET_CLASSIC],
            bankNames: [],
            cardNetworks: [],
            categoria,
          } as ScrapedPromo);
        }
      }
    } catch (err) {
      console.error('[Clarin365] Error durante scraping:', err);
    }

    console.log(`[Clarin365] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

// Openpay Argentina Scraper
// Extrae promociones desde el JSON de traducciones de Openpay
// Openpay es un posnet/medio de pago DE BBVA

import { Scraper, ScrapedPromo } from './types';
import { detectCategoria } from './bank-helpers';

const API_URL = 'https://www.openpayargentina.com.ar/translations/ar-es.json';
const PAGE_URL = 'https://www.openpayargentina.com.ar/beneficios/promociones';
const BANK_NAME = 'BBVA';

function parseDias(diasText: string): number {
  const text = (diasText || '').toLowerCase();
  let mask = 0;

  const dias = [
    { names: ['domingo'], bit: 6 },
    { names: ['lunes'], bit: 0 },
    { names: ['martes'], bit: 1 },
    { names: ['miércoles', 'miercoles'], bit: 2 },
    { names: ['jueves'], bit: 3 },
    { names: ['viernes'], bit: 4 },
    { names: ['sábado', 'sabado'], bit: 5 },
  ];

  if (text.includes('todos')) return 127;

  dias.forEach(({ names, bit }) => {
    if (names.some(name => text.includes(name))) {
      mask |= 1 << bit;
    }
  });

  return mask > 0 ? mask : 127;
}

function extractCap(text: string): number | null {
  const m = (text || '').match(/tope[^:$]*[:$]\s*\$?\s*([\d.,]+)/i);
  if (m) {
    const val = m[1].replace(/\./g, '').replace(',', '.');
    return parseFloat(val);
  }
  return null;
}

function stripHtml(text: string): string {
  return (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePromoData(promo: any): ScrapedPromo | null {
  try {
    const subtitulo = stripHtml(promo.subtitulo || '');
    const subtitulo2 = stripHtml(promo.subtitulo2 || '');
    const descripcion = stripHtml(promo.descripcion || '');
    const descripcion2 = stripHtml(promo.descripcion2 || '');
    const titulo = stripHtml(promo.titulo || '');

    const fullText = `${promo.titulocard} ${titulo} ${subtitulo} ${descripcion} ${subtitulo2} ${descripcion2}`;

    const dias = parseDias(titulo);

    let discountValue = 0;
    let discountType = 'PERCENTAGE_REINTEGRO';

    const sub1 = subtitulo.toLowerCase();
    const sub2 = subtitulo2.toLowerCase();

    for (const sub of [sub1, sub2]) {
      if (!sub) continue;
      if (sub.includes('reintegro')) {
        const m = sub.match(/(\d+)\s*%/);
        if (m) { discountValue = parseInt(m[1]); discountType = 'PERCENTAGE_REINTEGRO'; break; }
      } else if (sub.includes('cuota') || sub.includes('csi')) {
        const m = sub.match(/(\d+)\s*cuota/);
        if (m) { discountValue = parseInt(m[1]); discountType = 'CUOTAS_SIN_INTERES'; break; }
      }
    }

    if (!discountValue) return null;

    const cap = extractCap(descripcion) || extractCap(descripcion2) || 12000;
    const categoria = detectCategoria(promo.titulocard) || detectCategoria(fullText) || 'Otros';

    const title = discountType === 'PERCENTAGE_REINTEGRO'
      ? `${discountValue}% reintegro – ${promo.titulocard}`
      : `${discountValue} cuotas sin interés – ${promo.titulocard}`;

    return {
      title,
      description: fullText.substring(0, 300),
      sourceText: fullText,
      sourceUrl: PAGE_URL,
      discount: String(discountValue),
      discountType,
      cap,
      capPeriod: 'MONTHLY',
      capTarget: 'USER',
      validDays: dias,
      bankNames: [BANK_NAME],
      cardNetworks: [
        { network: 'VISA', type: 'CREDIT' },
        { network: 'Mastercard', type: 'CREDIT' },
        { network: 'American Express Banco', type: 'CREDIT' },
      ],
      storeName: 'Openpay',
      categoria,
      paymentChannel: 'TARJETA_FISICA',
      note: 'Solo comercios que cobren con Openpay',
    } as ScrapedPromo;
  } catch (err) {
    console.error('[Openpay] Error parseando promo:', err);
    return null;
  }
}

export const OpenpayScraper: Scraper = {
  name: 'Openpay',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Openpay] Iniciando scraper...');
    const allPromos: ScrapedPromo[] = [];

    try {
      const res = await fetch(API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const promoGroups: any[] = data?.promos?.card?.promos ?? [];
      console.log(`[Openpay] Grupos de promos: ${promoGroups.length}`);

      for (const group of promoGroups) {
        const items: any[] = group.promo ?? [];
        for (const item of items) {
          const promo = parsePromoData(item);
          if (promo) allPromos.push(promo);
        }
      }
    } catch (err) {
      console.error('[Openpay] Error durante scraping:', err);
    }

    console.log(`[Openpay] Total: ${allPromos.length} promo(s) extraída(s)`);
    return allPromos;
  },
};

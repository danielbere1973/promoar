// Mercado Pago Scraper V1
// Fuente: https://promociones.mercadopago.com.ar/
// Técnica: axios + cheerio (WordPress)
// Cubre: promos CSI y % OFF en comercios online que aceptan Mercado Pago

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://promociones.mercadopago.com.ar/';

const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

function normStr(s: string): string {
  return (s ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Mapear categorías de MP a categorías de PromoAR
function inferCategoria(storeName: string, promoText: string): string {
  const t = normStr(storeName + ' ' + promoText);
  if (/COTO|JUMBO|DISCO|VEA|CARREFOUR|DIARCO|SUPERMERCADO/.test(t)) return 'Supermercados';
  if (/FARMACITY|FARMACO|FARMAC|DROGUERIA|FARMONA/.test(t)) return 'Farmacias';
  if (/YPF|SHELL|AXION|PETRO|COMBUSTIBLE|NAFTA/.test(t)) return 'Combustible';
  if (/HELADERIA|HELADOS|FREDDO|CHUNGO|GRIDO/.test(t)) return 'Heladerías';
  if (/VIAJE|TURISMO|HOTEL|VUELO|AEROLINEA|DESPEGAR|BOOKING/.test(t)) return 'Viajes y Turismo';
  if (/UBER|CABIFY|SUBTE|COLECTIVO|TREN|TAXI|TELEPASE/.test(t)) return 'Transporte';
  if (/RESTAURANT|GASTRONOM|PIZZA|BURGER|CAFE|BAR(?!\w)|COMIDA|SUSHI|STARBUCKS/.test(t)) return 'Gastronomía';
  if (/ELECTRO|FRAVEGA|MUSIMUNDO|MEGATONE|GARBARINO|NOTEBOOK|CELULAR|TECH|PC(?!\w)|TV|AUDIO/.test(t)) return 'Tecnología';
  if (/ADIDAS|NIKE|PUMA|REEBOK|BICICLETA|DEPORTE|FITNESS|GYM/.test(t)) return 'Deportes';
  if (/ZARA|TUCCI|MANGO|ROPA|INDUMENTARIA|MODA|BOUTIQUE|DENIM/.test(t)) return 'Indumentaria';
  if (/PETSHOP|MASCOTA|ZOOMUNDO/.test(t)) return 'Mascotas';
  if (/HOGAR|MUEBLE|DECORACION|COLCHON|EASY|SODIMAC/.test(t)) return 'Hogar';
  if (/CINE|TEATRO|ENTRADAS|TICKETEK/.test(t)) return 'Entretenimiento';
  if (/OPTICA|BELLEZA|ESTETICA|SALUD/.test(t)) return 'Salud y Belleza';
  if (/JUGUETE|TOYS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Librerías';
  if (/SHOPPING/.test(t)) return 'Shoppings';
  return 'Otros';
}

function extractDates(text: string): { validFrom?: string; validUntil?: string } {
  const currentYear = new Date().getFullYear();
  const normText = normStr(text);

  const parseNumDate = (s: string): string => {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2] || String(currentYear);
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  };

  // "Válido del 3 al 9 de Noviembre" → specific dates
  const spanishRange = normText.match(/(?:V[AÁ]LIDO?\s+)?DEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (spanishRange) {
    const month = MONTHS[spanishRange[3].toLowerCase()];
    const y = spanishRange[4] ? parseInt(spanishRange[4]) : currentYear;
    if (month) {
      const mm = String(month).padStart(2, '0');
      return {
        validFrom: `${y}-${mm}-${spanishRange[1].padStart(2, '0')}`,
        validUntil: `${y}-${mm}-${spanishRange[2].padStart(2, '0')}`,
      };
    }
  }

  // Rango numérico
  const numericRange = normText.match(
    /(?:DEL?|DESDE\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA\s+EL)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/
  );
  if (numericRange) {
    return { validFrom: parseNumDate(numericRange[1]), validUntil: parseNumDate(numericRange[2]) };
  }

  // Hasta determinado mes
  const hastaMatch = normText.match(/HASTA\s+EL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+DE\s+(\d{4}))?/);
  if (hastaMatch) {
    const month = MONTHS[hastaMatch[2].toLowerCase()];
    const y = hastaMatch[3] ? parseInt(hastaMatch[3]) : currentYear;
    if (month) {
      return {
        validUntil: `${y}-${String(month).padStart(2, '0')}-${hastaMatch[1].padStart(2, '0')}`,
      };
    }
  }

  return {};
}

function extractDiscounts(promoText: string): Array<{ value: number; type: string }> {
  const results: Array<{ value: number; type: string }> = [];
  const t = normStr(promoText);

  // % OFF o % descuento
  const pctMatches = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:OFF|DE\s+)?(?:DESCUENTO|AHORRO|OFF)?/g);
  if (pctMatches) {
    for (const m of pctMatches) {
      const numMatch = m.match(/(\d+(?:\.\d+)?)/);
      if (numMatch) {
        const v = parseFloat(numMatch[1]);
        if (v > 0 && v <= 100) {
          results.push({ value: v, type: 'PERCENTAGE_DESCUENTO' });
        }
      }
    }
  }

  // CSI: "6 cuotas sin interés" o "12 CSI"
  const csiMatches = t.match(/(\d+)\s+CUOTAS?\s+(?:SIN\s+INTERES|CERO\s+INTERES)|(\d+)\s+CSI/g);
  if (csiMatches) {
    for (const m of csiMatches) {
      const numMatch = m.match(/(\d+)/);
      if (numMatch) {
        const v = parseInt(numMatch[1]);
        if (v > 0 && !results.find(r => r.type === 'CUOTAS_SIN_INTERES' && r.value === v)) {
          results.push({ value: v, type: 'CUOTAS_SIN_INTERES' });
        }
      }
    }
  }

  // Deduplicar, preferir el mayor % si hay varios
  const pctResults = results.filter(r => r.type !== 'CUOTAS_SIN_INTERES');
  const csiResults = results.filter(r => r.type === 'CUOTAS_SIN_INTERES');
  const uniquePct = pctResults.length > 0 ? [pctResults.reduce((max, r) => r.value > max.value ? r : max)] : [];
  const uniqueCsi = csiResults.length > 0 ? [csiResults.reduce((max, r) => r.value > max.value ? r : max)] : [];

  return [...uniquePct, ...uniqueCsi];
}

export const MercadoPagoScraper: Scraper = {
  name: 'mercadopago',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[MercadoPago] Iniciando scraper con Playwright...');
    const browser = await chromium.launch({ headless: true });
    const promos: ScrapedPromo[] = [];
    const today = new Date().toISOString().slice(0, 10);

    try {
      const page = await browser.newPage();
      await page.goto(SOURCE_URL, { waitUntil: 'networkidle', timeout: 30000 });

      // Esperar que carguen las promos
      await page.waitForFunction(
        () => document.querySelectorAll('h3').length > 3,
        { timeout: 15000 }
      ).catch(() => console.warn('[MercadoPago] Timeout esperando contenido'));

      // Debug: ver qué cargó
      const bodyText = await page.evaluate(() => document.body.innerText);
      const h3Count = await page.$$eval('h3', els => els.length);
      console.log('[MP DEBUG] h3 count:', h3Count);
      console.log('[MP DEBUG] Primeros 500 chars:', bodyText.slice(0, 500));

      // Estructura de la página:
      // <div> [discount badge] </div>
      // <h3> NOMBRE COMERCIO </h3>
      // <p> descripción </p>
      // <details> Legales: Válido del X al Y </details>
      //
      // Cada h3 que tiene un hermano previo con % o CSI es una promo.
      const items = await page.evaluate(() => {
        const results: Array<{ storeName: string; discountText: string; legalesText: string }> = [];
        const seen = new Set<string>();

        const h3s = Array.from(document.querySelectorAll('h3'));

        for (const h3 of h3s) {
          const storeName = h3.textContent?.trim() || '';
          if (!storeName || storeName.length < 2) continue;

          // Evitar duplicados
          const key = storeName.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          // El descuento está en el contenedor más cercano — buscar hacia arriba
          // hasta encontrar un elemento que contenga % o CSI en su texto directo
          let discountText = '';
          let el: Element | null = h3.previousElementSibling;
          let steps = 0;
          while (el && steps < 5) {
            const txt = el.textContent?.trim() || '';
            if (/%|cuotas?|CSI/i.test(txt) && txt.length < 200) {
              discountText = txt;
              break;
            }
            el = el.previousElementSibling;
            steps++;
          }

          // Si no encontramos en siblings, buscar en el padre
          if (!discountText) {
            const parent = h3.parentElement;
            const parentText = parent?.textContent?.trim() || '';
            if (/%|cuotas?/i.test(parentText)) discountText = parentText;
          }

          // Legales: buscar en el siguiente details o párrafo después del h3
          let legalesText = '';
          let next = h3.nextElementSibling;
          let nextSteps = 0;
          while (next && nextSteps < 8) {
            if (next.tagName === 'DETAILS' || /legal|v[aá]lid/i.test(next.textContent || '')) {
              legalesText = next.textContent?.trim() || '';
              break;
            }
            next = next.nextElementSibling;
            nextSteps++;
          }

          if (discountText || legalesText) {
            results.push({ storeName, discountText, legalesText });
          }
        }

        return results;
      });

      await page.close();

      for (const item of items) {
        const { storeName, discountText, legalesText } = item;
        const fullText = legalesText || discountText;

        const discounts = extractDiscounts(discountText + ' ' + legalesText);
        if (discounts.length === 0) continue;

        const { validFrom, validUntil } = extractDates(fullText);
        if (validUntil && validUntil < today) continue;

        const categoria = inferCategoria(storeName, promoText);

        for (const disc of discounts) {
          const title = `${disc.type === 'CUOTAS_SIN_INTERES' ? disc.value + ' CSI' : disc.value + '% OFF'} en ${storeName}`;

          promos.push({
            title,
            description: (discountText || storeName).slice(0, 200).replace(/\s+/g, ' '),
            sourceText: fullText.slice(0, 8000),
            sourceUrl: SOURCE_URL,
            discount: String(disc.value),
            discountType: disc.type as any,
            cap: undefined,
            capPeriod: undefined,
            capTarget: null,
            minPurchase: undefined,
            stackable: undefined,
            singleUse: undefined,
            validFrom,
            validUntil,
            specificDates: undefined,
            validDays: 127,
            bankNames: undefined,
            walletNames: ['Mercado Pago'],
            cardNetworks: undefined,
            cardType: null,
            paymentChannel: 'ANY' as any,
            accountType: 'ANY' as any,
            storeName,
            categoria,
          });
        }

        console.log(`[MercadoPago] ✅ "${storeName}" → ${discounts.map(d => `${d.value} ${d.type}`).join(', ')}`);
      }

    } finally {
      await browser.close();
    }

    console.log(`[MercadoPago Scraper V1] ${promos.length} promos encontradas`);
    return promos;
  },
};

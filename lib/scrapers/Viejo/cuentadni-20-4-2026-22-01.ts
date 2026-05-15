// Cuenta DNI Scraper V2
// Fuente: https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios
// Técnica: axios + cheerio (HTML plano con tarjetas por comercio)
// Billetera: Cuenta DNI (Banco Provincia de Buenos Aires)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedPromo } from './types';

const SOURCE_URL = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdniBeneficios';

function normStr(s: string): string {
  return (s ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Mapeo de alt de imagen → { nombre, categoría, días }
// validDays: bitmask donde bit 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
const IMG_MAP: Record<string, { name: string; categoria: string; validDays: number }> = {
  'dia 200 122':              { name: 'Supermercado Día',              categoria: 'Supermercados', validDays: 0b0000010 }, // lunes
  'logo coto':                { name: 'Coto',                         categoria: 'Supermercados', validDays: 0b0010000 }, // jueves
  'logo changomas':           { name: 'Changomás',                    categoria: 'Supermercados', validDays: 0b0010000 }, // jueves
  'iconoc_carrefour_front':   { name: 'Carrefour',                    categoria: 'Supermercados', validDays: 127 },
  'la anonima 200 122':       { name: 'La Anónima',                   categoria: 'Supermercados', validDays: 127 },
  'supermercado verde':       { name: 'Supermercados adheridos',      categoria: 'Supermercados', validDays: 127 },
  'nini_200x130':             { name: 'Nini Mayorista',               categoria: 'Supermercados', validDays: 0b0000100 }, // martes
  'icono comercios de barrio':{ name: 'Comercios de barrio',          categoria: 'Supermercados', validDays: 0b0111110 }, // lun-vie
  'gastronomia_invierno2025': { name: 'Gastronomía adherida',         categoria: 'Gastronomía',   validDays: 0b1000001 }, // sab-dom
  'perfumeria_pictograma':    { name: 'Farmacias y Perfumerías',      categoria: 'Farmacias',     validDays: 0b0011000 }, // mie-jue
  'librerias_pictograma':     { name: 'Librerías adheridas',          categoria: 'Supermercados', validDays: 0b0000110 }, // lun-mar
  'logo_josimar_130':         { name: 'Josimar',                      categoria: 'Supermercados', validDays: 0b0001000 }, // miércoles
  'toledo_cdni':              { name: 'Toledo',                       categoria: 'Supermercados', validDays: 127 },
  '3arroyosespecial':         { name: 'Comercios de Tres Arroyos',    categoria: 'Supermercados', validDays: 0b0011110 }, // lun-jue
  'logo_ypf_full':            { name: 'YPF',                          categoria: 'Combustible',   validDays: 127 },
  'marcas_destacadas':        { name: 'Marcas destacadas',            categoria: 'Supermercados', validDays: 127 },
  'provincia':                { name: 'Ferias y Mercados Bonaerenses',categoria: 'Supermercados', validDays: 127 },
  'icono_universidades':      { name: 'Buffet Universidades',         categoria: 'Gastronomía',   validDays: 127 },
  'recarga transporte':       { name: 'Transporte público',           categoria: 'Transporte',    validDays: 127 },
};

function extractValidDays(text: string): number {
  const t = normStr(text);
  if (/TODOS LOS DIAS|LUNES A DOMINGO/.test(t)) return 127;
  if (/LUNES A VIERNES/.test(t)) return 0b0111110;
  if (/LUNES A JUEVES/.test(t)) return 0b0011110;
  if (/SABADOS Y DOMINGOS|FIN DE SEMANA/.test(t)) return 0b1000001;
  if (/LUNES Y MARTES/.test(t)) return 0b0000110;
  if (/MIERCOLES Y JUEVES/.test(t)) return 0b0011000;

  let mask = 0;
  if (t.includes('DOMINGO')) mask |= 1 << 0;
  if (t.includes('LUNES'))   mask |= 1 << 1;
  if (t.includes('MARTES'))  mask |= 1 << 2;
  if (t.includes('MIERCOLES')) mask |= 1 << 3;
  if (t.includes('JUEVES'))  mask |= 1 << 4;
  if (t.includes('VIERNES')) mask |= 1 << 5;
  if (t.includes('SABADO'))  mask |= 1 << 6;
  return mask || 127;
}

function inferCategoria(storeName: string, title: string): string {
  const t = normStr(storeName + ' ' + title);
  if (/COTO|JUMBO|DISCO|VEA|CARREFOUR|DIARCO|CHANGOMAS|DIA\b|SUPERMERCADO/.test(t)) return 'Supermercados';
  if (/FARMACIA|PERFUMERIA|DROGUERIA/.test(t)) return 'Farmacias';
  if (/GASTRONOMIA|RESTAURANT|CAFE|BUFFET|COMIDA|COMER/.test(t)) return 'Gastronomía';
  if (/LIBRERIA|LIBRO/.test(t)) return 'Varios';
  if (/TRANSPORTE|VIAJE|COLECTIVO|SUBTE/.test(t)) return 'Transporte';
  if (/MASCOTA|PET/.test(t)) return 'Petshops';
  return 'Varios';
}

export const CuentaDNIScraper: Scraper = {
  name: 'cuenta dni',

  async run(): Promise<ScrapedPromo[]> {
    console.log('[CuentaDNI] Iniciando scraper V2...');

    const { data: html } = await axios.get(SOURCE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PromoAR/1.0)' },
      timeout: 15000,
    });

    const $ = cheerio.load(html);
    const promos: ScrapedPromo[] = [];
    const currentYear = new Date().getFullYear();

    // Cada bloque de promo tiene esta estructura:
    // <p> título descriptivo </p>
    // <p> Día(s) de la semana </p>
    // <table> | imagen | | % | "de ahorro" | | "Con la aplicación Cuenta DNI" | </table>
    // <button> Conocé más </button>

    // Buscar todas las tablas con el patrón de % de ahorro
    $('table').each((_, table) => {
      const tableText = $(table).text().trim();
      if (!tableText.includes('de ahorro') && !tableText.includes('%')) return;

      // Extraer el porcentaje
      const pctMatch = tableText.match(/(\d+)\s*%?\s*de ahorro/i);
      if (!pctMatch) return;
      const discountValue = parseInt(pctMatch[1]);
      if (!discountValue || discountValue <= 0) return;

      // Buscar el contexto antes de la tabla (título y día)
      const parent = $(table).parent();
      const prevText = parent.text();

      // Día de la semana — está justo antes de la tabla
      let dayText = '';
      const prevEls = $(table).prevAll();
      prevEls.each((_, el) => {
        const t = $(el).text().trim();
        if (/lunes|martes|miércoles|jueves|viernes|sábado|domingo|todos/i.test(t) && t.length < 80) {
          dayText = t;
          return false; // break
        }
      });

      // Título descriptivo — el párrafo antes del día
      let titleText = '';
      let foundDay = false;
      prevEls.each((_, el) => {
        const t = $(el).text().trim();
        if (/lunes|martes|miércoles|jueves|viernes|sábado|domingo|todos/i.test(t) && t.length < 80) {
          foundDay = true;
          return;
        }
        if (foundDay && t.length > 5 && t.length < 100) {
          titleText = t;
          return false;
        }
      });

      // Nombre del comercio — usar mapa de alt de imagen
      const imgAlt = ($(table).find('img').first().attr('alt') || '').trim();
      const imgKey = imgAlt.toLowerCase();
      const mapped = IMG_MAP[imgKey];
      const storeName = mapped?.name || imgAlt || titleText || 'Comercios adheridos';
      const categoria = mapped?.categoria || inferCategoria(storeName, titleText);
      const validDays = mapped?.validDays ?? extractValidDays(dayText || prevText);

      // Vigencia — mes actual hasta fin de mes
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const validFrom = `${currentYear}-${mm}-01`;
      const validUntil = `${currentYear}-${mm}-${lastDay}`;

      const title = `Cuenta DNI — ${discountValue}% en ${storeName}`;

      promos.push({
        title,
        description: titleText || `${discountValue}% de ahorro pagando con Cuenta DNI`,
        sourceText: tableText.slice(0, 2000),
        sourceUrl: SOURCE_URL,
        discount: String(discountValue),
        discountType: 'PERCENTAGE_DESCUENTO' as any,
        cap: discountValue === 20 ? 5000 : undefined, // tope conocido de la promo principal
        capPeriod: 'WEEKLY' as any,
        capTarget: 'USER',
        minPurchase: undefined,
        stackable: false,
        singleUse: undefined,
        validFrom,
        validUntil,
        specificDates: undefined,
        validDays,
        bankNames: ['Banco Provincia de Buenos Aires'],
        walletNames: ['Cuenta DNI'],
        cardNetworks: undefined,
        cardType: null,
        paymentChannel: 'QR' as any,
        accountType: 'ANY' as any,
        storeName,
        categoria,
      });

      console.log(`[CuentaDNI] ✅ "${title}" → ${discountValue}% | días: ${validDays}`);
    });

    console.log(`[CuentaDNI Scraper V2] ${promos.length} promos encontradas`);
    return promos;
  },
};

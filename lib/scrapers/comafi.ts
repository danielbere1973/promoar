// Banco Comafi — portal de beneficios "Te va bien" (tevabien.com), Civinext CMS.
// El listado /beneficios.aspx renderiza los items client-side vía
// GET /json/apps/benefits.aspx?pagesize=500&allfields=&state=0&city=0&t={ts}
// (respuesta JSON plana, hasta ~500 items — sin paginación real necesaria, ~276
// items totales observados). Cada item trae rubro(s), producto(s)/segmento(s) y
// fechas, pero NO el tope de reintegro; el tope sale del <meta name="description">
// de la página de detalle /{id}-{slug}.benefit.aspx (formato fijo:
// "{rubro} - {info de descuento} - {tope o 'Sin tope de reintegro'} - Consultar vigencia").
// Sin WAF, fetch directo (aunque el sitio usa Cloudflare, sirve HTML completo sin retos).

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { extractCap, detectCategoria, dedup } from './bank-helpers';

const BANK_NAME = 'Banco Comafi';
const BASE_URL = 'https://www.tevabien.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface BenefitItem {
  i: number;
  t: number; // 405=2x1, 406=cuotas, 407=%, 408=obsequio, 409=%+cuotas, 416=cuotas fijas, 417=%+cuotas fijas, 427=bonificación
  c: number[]; // canal/segmento (Negocios y Pyme, Plan Sueldo, Premium, Unico Black, etc.)
  d: string; // % descuento (puede venir vacío)
  q: string; // cantidad de cuotas (puede venir vacío)
  a: string; // dígitos de día: 1=Domingo, 2=Lunes, 3=Martes, 4=Miércoles, 5=Jueves, 6=Viernes, 7=Sábado
  b: string; // nombre comercio
  ct: string; // texto de exclusividad, ej "MODO"
  cti: number[];
  m: string;
  r: number[]; // ids de rubro
  o: number[]; // ids de producto/tarjeta
  f: number; // fecha desde, YYMMDD
  e: number; // fecha hasta, YYMMDD
  pr: number[];
}

// rubro (trades.aspx) → categoría PromoAR
const RUBRO_MAP: Record<number, string> = {
  1478: 'Otros',            // Cercanos
  1241: 'Hogar',            // Hogar / Deco
  1262: 'Hogar',
  1303: 'Hogar',
  1236: 'Supermercados',
  1257: 'Supermercados',
  1314: 'Supermercados',    // Super
  1238: 'Salud y Belleza',  // Belleza
  1259: 'Salud y Belleza',
  1298: 'Salud y Belleza',  // Beauty
  1313: 'Salud y Belleza',  // Spa
  1260: 'Salud y Belleza',  // Bienestar
  1233: 'Gastronomía',
  1212: 'Gastronomía',
  1301: 'Gastronomía',
  1476: 'Gastronomía',      // Bares
  1255: 'Gastronomía',      // Restós
  1232: 'Indumentaria',     // Moda
  1254: 'Indumentaria',
  1307: 'Indumentaria',
  1243: 'Otros',            // E-Commerce
  1264: 'Otros',
  1300: 'Otros',
  1240: 'Viajes y Turismo',
  1213: 'Viajes y Turismo',
  1261: 'Viajes y Turismo',
  1315: 'Viajes y Turismo',
  1304: 'Viajes y Turismo', // Hoteleria
  1310: 'Viajes y Turismo', // Para viajeras
  1237: 'Salud y Belleza',  // Salud
  1326: 'Salud y Belleza',
  1235: 'Combustible',
  1360: 'Combustible',
  1245: 'Automotores',      // Vehículos
  1266: 'Automotores',
  1334: 'Otros',            // Promos del Mes
  1333: 'Otros',
  1246: 'Jugueterías',
  1267: 'Jugueterías',      // Toys & Play
  1308: 'Jugueterías',      // Niños
  1242: 'Librerías',
  1263: 'Librerías',
  1305: 'Librerías',
  1357: 'Transporte',
  1476001: 'Gastronomía', // placeholder no usado
  1234: 'Entretenimiento',
  1351: 'Entretenimiento',
  1256: 'Entretenimiento',
  1214: 'Entretenimiento', // Espectáculos
  1356: 'Entretenimiento', // Cine
  1355: 'Transporte',      // Estacionamiento
  1306: 'Petshops',        // Mascotas
  1275: 'Petshops',        // Pet Shop
  1309: 'Salud y Belleza',  // Ópticas
  1311: 'Salud y Belleza',  // Perfumería
  1312: 'Hogar',            // Pinturerías
  1316: 'Gastronomía',      // Vinos
  1265: 'Gastronomía',      // Vinotecas
  1276: 'Deportes',
  1302: 'Deportes',         // Gym
  1345: 'Viajes y Turismo', // USA
  1358: 'Otros',            // Servicios
  1359: 'Otros',
  1297: 'Otros',            // A festejar
  1299: 'Otros',            // Capacitate!
  1231: 'Otros',            // Te va jueves
  1448: 'Otros',            // Provencred
  1472: 'Otros',            // Modo (filtro por canal, no rubro real)
};

const DAY_DIGIT_TO_BIT: Record<string, number> = {
  '1': 0, // domingo
  '2': 1, // lunes
  '3': 2, // martes
  '4': 3, // miercoles
  '5': 4, // jueves
  '6': 5, // viernes
  '7': 6, // sabado
};

function parseDias(a: string): number {
  if (!a) return 127;
  let mask = 0;
  for (const digit of a) {
    if (digit in DAY_DIGIT_TO_BIT) mask |= (1 << DAY_DIGIT_TO_BIT[digit]);
  }
  return mask || 127;
}

function parseYYMMDD(n: number): string | undefined {
  const s = String(n).padStart(6, '0');
  const yy = parseInt(s.slice(0, 2), 10);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  return `20${yy}-${mm}-${dd}`;
}

function mapCategoria(rubroIds: number[], fallbackText: string): string {
  for (const id of rubroIds) {
    if (RUBRO_MAP[id]) return RUBRO_MAP[id];
  }
  return detectCategoria(fallbackText) || 'Otros';
}

// o/pr ids de producto (ver /json/apps/products.aspx):
// 161/210 Visa crédito, 162/190/191/209 Mastercard crédito, 164 débito Visa,
// 194/195 Visa Platinum/Signature crédito.
function extractCardNetworks(productIds: number[], exclusiveText: string): CardNetworkWithType[] {
  const nets: CardNetworkWithType[] = [];
  const hasVisaCredit = [161, 194, 195, 210].some(id => productIds.includes(id));
  const hasVisaDebit = productIds.includes(164);
  const hasMcCredit = [162, 190, 191, 209].some(id => productIds.includes(id));

  if (hasVisaCredit) nets.push({ network: 'Visa', type: 'CREDIT' });
  if (hasVisaDebit) nets.push({ network: 'Visa', type: 'DEBIT' });
  if (hasMcCredit) nets.push({ network: 'Mastercard', type: 'CREDIT' });

  if (/\bMODO\b/i.test(exclusiveText)) nets.push({ network: 'MODO', type: null });

  return nets;
}

function slugify(name: string): string {
  return name
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/ /g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '');
}

function buildDetailUrl(item: BenefitItem): string {
  return `${BASE_URL}/${item.i}-${slugify(item.b)}.benefit.aspx`;
}

async function fetchItems(): Promise<BenefitItem[]> {
  const url = `${BASE_URL}/json/apps/benefits.aspx?pagesize=500&allfields=&state=0&city=0&t=${Date.now()}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const items: BenefitItem[] = await res.json();
  return items;
}

async function fetchCapFromDetail(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta name="description" content="([^"]*)"/);
    if (!m) return null;
    return extractCap(m[1]);
  } catch {
    return null;
  }
}

function itemToPromos(item: BenefitItem, cap: number | null): ScrapedPromo[] {
  const validDays = parseDias(item.a);
  const cardNetworks = extractCardNetworks(item.o, item.ct);
  const categoria = mapCategoria(item.r, item.b);
  const sourceUrl = buildDetailUrl(item);
  const validFrom = parseYYMMDD(item.f);
  const validUntil = parseYYMMDD(item.e);

  const base: Partial<ScrapedPromo> = {
    sourceUrl,
    validDays,
    validFrom,
    validUntil,
    cap,
    capPeriod: cap ? 'MONTHLY' : null,
    bankNames: [BANK_NAME],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    paymentChannel: 'ANY',
    categoria,
    storeName: item.b,
  };

  const promos: ScrapedPromo[] = [];
  const hasPct = item.d && item.d !== '';
  const hasCsi = item.q && item.q !== '';

  if (hasPct) {
    const value = parseFloat(item.d);
    if (value > 0) {
      promos.push({
        ...base,
        title: `${value}% descuento – ${item.b}`,
        description: `${value}% de descuento en ${item.b}`,
        discount: String(value),
        discountType: 'PERCENTAGE_DESCUENTO',
      } as ScrapedPromo);
    }
  }
  if (hasCsi) {
    const value = parseInt(item.q, 10);
    if (value > 0) {
      promos.push({
        ...base,
        title: `${value} cuotas sin interés – ${item.b}`,
        description: `${value} cuotas sin interés en ${item.b}`,
        discount: String(value),
        discountType: 'CUOTAS_SIN_INTERES',
      } as ScrapedPromo);
    }
  }
  return promos;
}

export const ComafiScraper: Scraper = {
  name: 'Comafi',
  async run(): Promise<ScrapedPromo[]> {
    const items = await fetchItems();
    const all: ScrapedPromo[] = [];

    for (const item of items) {
      // Solo nos interesan los tipos de descuento simple/cuotas que ya sabemos parsear
      // con confianza (406 cuotas, 407 %, 409 %+cuotas). El resto (2x1, obsequio,
      // bonificación, cuotas fijas) requeriría lógica de discountType distinta —
      // se dejan afuera por ahora en vez de asumir su semántica.
      if (![406, 407, 409].includes(item.t)) continue;

      const sourceUrl = buildDetailUrl(item);
      const cap = await fetchCapFromDetail(sourceUrl);
      all.push(...itemToPromos(item, cap));
      await new Promise(r => setTimeout(r, 120));
    }

    return dedup(all);
  },
};

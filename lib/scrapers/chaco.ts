// Nuevo Banco del Chaco — "Promo TUYA" (nbch.com.ar)
//
// El sitio institucional es un DotNetNuke (DNN) clásico detrás de un "splash page"
// gate (redirect loop hasta setear cookies dnn_IsMobile/SplashPageView/language),
// pero la sección de comercios adheridos vive en una SPA anidada aparte
// (Kendo UI, /promociones/promonbch/busqueda) que consume, sin WAF y sin sesión:
//   POST https://www.nbch.com.ar/promociones/common/promocionnbch/GetPromocionNBCH
// Body estilo Kendo DataSource: sort/page/pageSize/group/filter/codigo/localidad/rubro/busqueda.
// `codigo` filtra por campaña (1-7). El campo "Rubro" no es una categoría —
// es texto libre con el término de la promo (cuotas + días de vigencia).
// Solo 17 variantes de texto distintas en 891 registros — se parsean a mano
// en vez de reusar extractInstallments (que exige la frase "sin/cero interés").

import { Scraper, ScrapedPromo } from './types';
import { dedup, extractValidDays, extractCap, normStr, detectCategoria, stripBusinessSuffix } from './bank-helpers';

const BANK_NAME = 'Nuevo Banco del Chaco';
const API_URL = 'https://www.nbch.com.ar/promociones/common/promocionnbch/GetPromocionNBCH';
const SOURCE_URL = 'https://www.nbch.com.ar/promociones/promonbch/busqueda';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const PAGE_SIZE = 2000;
const CAMPANIAS = [1, 2, 3, 4, 5, 6, 7];

interface ChacoPromo {
  Id: number;
  IdPromocionNBCH: number;
  Codigo: number;
  Denominacion: string;
  NombreComercio: string;
  Localidad: string;
  Rubro: string;
  Calle: string;
  Numero: number;
  Hasta: string;
  GetCalleNumero: string;
}

const CAMPANIA_CATEGORY: Record<number, string> = {
  1: 'Combustible',       // Promo Combustibles
  2: 'Farmacias',         // Promo Farmacias
  3: 'Shoppings',         // Promo Shopping Sarmiento
  7: 'Supermercados',     // Promo especial Alimentos
};

function parseCuotas(text: string): number | null {
  const t = normStr(text);
  // "3 - 6 y 12 cuotas." / "3 y 6 cuotas" / "12 cuotas" → toma el mayor N mencionado
  const nums = [...t.matchAll(/(\d+)\s*CUOTAS?/g)].map(m => parseInt(m[1]));
  if (nums.length > 0) return Math.max(...nums);
  return null;
}

function hasInteres(text: string): boolean {
  const t = normStr(text);
  return /SIN\s+INTER|S\/I\b|SIN\s+INTRERES/.test(t) || !/CON\s+INTER/.test(t);
}

async function fetchCampania(codigo: number): Promise<ChacoPromo[]> {
  const body = new URLSearchParams({
    sort: '', page: '1', pageSize: String(PAGE_SIZE), group: '', filter: '',
    codigo: String(codigo), localidad: '', rubro: '', busqueda: '',
  });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: body.toString(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.Data ?? [];
}

function promoToScraped(p: ChacoPromo): ScrapedPromo | null {
  const cuotas = parseCuotas(p.Rubro);
  if (!cuotas || !hasInteres(p.Rubro)) return null;

  const storeName = stripBusinessSuffix(p.NombreComercio.trim());
  const validDays = extractValidDays(p.Rubro);
  const cap = extractCap(p.Rubro);
  const categoria = CAMPANIA_CATEGORY[p.Codigo] ?? detectCategoria(`${storeName} ${p.Rubro}`) ?? 'Otros';
  const address = p.GetCalleNumero?.trim().replace(/\s+0$/, '').trim();

  return {
    title: `${cuotas} cuotas sin interés – ${storeName}`,
    description: `${p.Denominacion}: ${p.Rubro.trim()}`,
    sourceText: p.Rubro.trim(),
    sourceUrl: SOURCE_URL,
    discount: String(cuotas),
    discountType: 'CUOTAS_SIN_INTERES',
    cap: cap ?? null,
    capPeriod: cap ? 'MONTHLY' : null,
    validDays,
    validUntil: p.Hasta ? p.Hasta.slice(0, 10) : undefined,
    bankNames: [BANK_NAME],
    walletNames: ['Promo TUYA'],
    paymentChannel: 'ANY',
    categoria,
    storeName,
    note: address ? `Sucursal: ${address}, ${p.Localidad}` : undefined,
  } as ScrapedPromo;
}

export const ChacoScraper: Scraper = {
  name: 'Chaco',
  async run(): Promise<ScrapedPromo[]> {
    const all: ScrapedPromo[] = [];
    for (const codigo of CAMPANIAS) {
      const raw = await fetchCampania(codigo);
      for (const p of raw) {
        const promo = promoToScraped(p);
        if (promo) all.push(promo);
      }
    }
    return dedup(all);
  },
};

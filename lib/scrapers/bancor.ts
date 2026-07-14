// Banco de Córdoba (Bancor) — GraphQL público sin WAF.
// Página https://www.bancor.com.ar/promociones/ (Gatsby) consume
// POST https://apollo.bancor.com.ar/ con la query `PromocionesQuery`, paginada
// de a 12 nodos por página (el parámetro `limit` es ignorado por el server).
// `dias` usa el mismo bitmask de 7 bits que el resto del codebase (127 = todos los días).
// El descuento/cuotas vienen como texto libre en `campana`/`descripcion_campana`,
// no en campos numéricos estructurados.

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { extractCap, detectCategoria, dedup } from './bank-helpers';

const ENDPOINT = 'https://apollo.bancor.com.ar/';
const BANK_NAME = 'Banco de Córdoba';
const SOURCE_URL = 'https://www.bancor.com.ar/promociones/';
const PER_PAGE = 12;

const QUERY = `query PromocionesQuery($dias: String, $rubro: String, $page: Int, $limit: Int, $word: String, $tarjCreditos: String, $tarjDebitos: String, $tarjPrepagas: String, $provincias: String, $localidades: String, $idEfemeride: String, $mostrarDestacada: Boolean) {
  tarjetasDePromociones(
    dias: $dias
    rubro: $rubro
    page: $page
    limit: $limit
    word: $word
    tarjCreditos: $tarjCreditos
    tarjDebitos: $tarjDebitos
    tarjPrepagas: $tarjPrepagas
    provincias: $provincias
    localidades: $localidades
    idEfemeride: $idEfemeride
    mostrarDestacada: $mostrarDestacada
  ) {
    nodes {
      DEBITO
      CREDITO
      PREPAGA
      dias
      empresa
      empresaId
      campana
      descripcion_campana
      rubro
      tipoPromocion
      comerciosAdheridos { d i lat locId lon locNa n prN prC __typename }
      __typename
    }
    pageInfo { currentPage hasNextPage pageCount perPage totalCount __typename }
    __typename
  }
}`;

interface RawStore {
  d?: string;
  n?: string;
  lat?: string;
  lon?: string;
}

interface RawNode {
  DEBITO: string | null;
  CREDITO: string | null;
  PREPAGA: string | null;
  dias: string | null;
  empresa: string;
  empresaId: string;
  campana: string | null;
  descripcion_campana: string | null;
  rubro: string | null;
  tipoPromocion: string | null;
  comerciosAdheridos: RawStore[] | null;
}

const CATEGORIA_MAP: Record<string, string> = {
  'Electro': 'Tecnología',
  'Farmacia': 'Farmacias',
  'Gastronomía': 'Gastronomía',
  'Indumentaria': 'Indumentaria',
  'Alojamientos': 'Viajes y Turismo',
  'Transporte': 'Transporte',
  'Impuestos y Servicios': 'Otros',
  'Super e Hiper': 'Supermercados',
  'Cultura y espectáculos': 'Entretenimiento',
  'Combustibles': 'Combustible',
  'Salud y Belleza': 'Salud y Belleza',
  'Hogar': 'Hogar',
  'Deportes': 'Deportes',
  'Mascotas': 'Petshops',
  'Librería': 'Librerías',
  'Jugueterías': 'Jugueterías',
  'Shopping': 'Shoppings',
  'Automotores': 'Automotores',
  'Educación': 'Otros',
};

function mapCategoria(raw: string | null, fallbackText: string): string {
  if (raw && CATEGORIA_MAP[raw]) return CATEGORIA_MAP[raw];
  return detectCategoria(fallbackText);
}

// dias viene como bitmask de 7 bits, mismo convenio que el resto del codebase (127 = todos).
function parseDias(dias: string | null): number {
  if (!dias) return 127;
  const n = parseInt(dias, 10);
  return Number.isFinite(n) && n > 0 ? n : 127;
}

// CREDITO viene fijo en "127" en prácticamente todos los nodos (no es señal real de
// tipo de tarjeta), y DEBITO/PREPAGA casi siempre null — no permite distinguir crédito/débito
// de forma confiable, así que no se asume tipo de tarjeta desde estos campos.

// campana/descripcion_campana traen texto libre tipo "30% ahorro + 4 sin interés",
// "Hasta 18 sin interés", "3,6 y 12 sin interés" (desc "en transporte").
function parseDiscountText(campana: string, desc: string): { discount: string; discountType: string }[] {
  const text = `${campana} ${desc}`;
  const results: { discount: string; discountType: string }[] = [];

  const pctM = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:ahorro|descuento|reintegro|reembolso|bonificaci[oó]n)?/i);
  if (pctM) {
    const v = parseFloat(pctM[1].replace(',', '.'));
    if (v > 0 && v <= 100) {
      const type = /reintegro|reembolso/i.test(text) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      results.push({ discount: String(v), discountType: type });
    }
  }

  // Cuotas sin interés: puede haber una lista "3,6 y 12" o "hasta 18" — nos quedamos con el máximo.
  const cuotasM = text.match(/((?:\d+\s*(?:,|y)\s*)*\d+)\s+(?:sin\s+inter[eé]s|cuotas?\s+sin\s+inter[eé]s)/i)
    ?? text.match(/hasta\s+(\d+)\s+(?:cuotas?\s+)?sin\s+inter[eé]s/i);
  if (cuotasM) {
    const nums = cuotasM[1].match(/\d+/g)?.map(Number) ?? [];
    const max = nums.length ? Math.max(...nums) : null;
    if (max && max > 0) {
      results.push({ discount: String(max), discountType: 'CUOTAS_SIN_INTERES' });
    }
  }

  return results;
}

function nodeToPromos(node: RawNode): ScrapedPromo[] {
  const empresa = (node.empresa || '').trim();
  if (!empresa) return [];

  const campana = (node.campana || '').trim();
  const desc = (node.descripcion_campana || '').trim();
  const fullText = `${campana} ${desc}`.trim();
  const parsed = parseDiscountText(campana, desc);
  if (parsed.length === 0) return [];

  const validDays = parseDias(node.dias);
  const cardNetworks: CardNetworkWithType[] = [{ network: 'Visa', type: null }, { network: 'Mastercard', type: null }];
  const cap = extractCap(fullText);
  const categoria = mapCategoria(node.rubro, `${empresa} ${fullText}`);

  const branches = (node.comerciosAdheridos ?? [])
    .filter(s => s.lat && s.lon)
    .map(s => ({
      address: s.d || '',
      lat: parseFloat(s.lat as string),
      lng: parseFloat(s.lon as string),
    }))
    .filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lng));

  const base: Partial<ScrapedPromo> = {
    description: fullText.slice(0, 500),
    sourceText: fullText.slice(0, 500),
    sourceUrl: SOURCE_URL,
    validDays,
    cap,
    capPeriod: cap ? 'MONTHLY' : null,
    bankNames: [BANK_NAME],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    paymentChannel: 'ANY',
    categoria,
    storeName: empresa,
    branches: branches.length > 0 ? branches : undefined,
  };

  return parsed.map(p => ({
    ...base,
    title: p.discountType === 'CUOTAS_SIN_INTERES'
      ? `${p.discount} cuotas sin interés – ${empresa}`
      : `${p.discount}% descuento – ${empresa}`,
    discount: p.discount,
    discountType: p.discountType,
  } as ScrapedPromo));
}

async function fetchPage(page: number): Promise<{ nodes: RawNode[]; hasNextPage: boolean } | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': '*/*' },
      body: JSON.stringify({
        operationName: 'PromocionesQuery',
        variables: {
          dias: null, rubro: null, word: null,
          tarjCreditos: null, tarjDebitos: null, tarjPrepagas: null,
          provincias: null, localidades: null, page, limit: PER_PAGE, mostrarDestacada: false,
        },
        query: QUERY,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data?.tarjetasDePromociones;
    if (!data) return null;
    return { nodes: data.nodes ?? [], hasNextPage: !!data.pageInfo?.hasNextPage };
  } catch {
    return null;
  }
}

export const BancorScraper: Scraper = {
  name: 'Bancor',
  async run(): Promise<ScrapedPromo[]> {
    const all: ScrapedPromo[] = [];
    let page = 1;
    let hasNextPage = true;
    let safety = 0;

    while (hasNextPage && safety < 200) {
      const result = await fetchPage(page);
      safety++;
      if (!result) break;
      for (const node of result.nodes) {
        all.push(...nodeToPromos(node));
      }
      hasNextPage = result.hasNextPage;
      page++;
      await new Promise(r => setTimeout(r, 150));
    }

    return dedup(all);
  },
};

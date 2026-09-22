// Nuevo Banco del Chaco — "Promociones NBCH" (promociones.nbch.com.ar)
//
// El sitio viejo (nbch.com.ar, DotNetNuke + Kendo UI, endpoint
// GetPromocionNBCH con ~891 registros por comercio) fue reemplazado por un
// sitio nuevo (Next.js + Supabase, dominio promociones.nbch.com.ar) con un
// modelo de datos completamente distinto: campañas temáticas (8 activas en
// total, ej. "Shopping Sarmiento", "Aerolíneas Argentinas") en vez de un
// listado plano por comercio.
//
// Listado de campañas: server-rendered en /promociones (y /promociones?page=N),
// embebido en el RSC payload (self.__next_f.push chunks) — no hay API JSON
// pública para el listado, hay que parsear el HTML.
//
// Sucursales adheridas por campaña SÍ tienen API propia y devuelven
// dirección + lat/lng listos, sin necesidad de geocoding:
//   GET /api/promociones/{uuid}/sucursales
//
// El beneficio real (cuotas/%/tope) está en descripcion_larga (markdown en
// texto libre, igual que el viejo campo "Rubro") — se parsea con los mismos
// helpers que el resto de los scrapers de bancos.

import { Scraper, ScrapedPromo } from './types';
import {
  dedup, extractValidDays, extractCap, extractDiscount, extractInstallments,
  normStr, detectCategoria, stripBusinessSuffix,
} from './bank-helpers';

const BANK_NAME = 'Nuevo Banco del Chaco';
const BASE_URL = 'https://promociones.nbch.com.ar';
const LIST_URL = `${BASE_URL}/promociones`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const MAX_PAGES = 5;

interface ChacoPromo {
  id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descripcion_larga: string | null;
  estado: string;
  visible: boolean;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  dias_aplicacion: string[] | null;
  marcas_tarjeta: string[] | null;
  canales_aplicacion: string[] | null;
  rubro_comercial_id: number | null;
  sucursal_count?: number;
}

interface ChacoSucursal {
  nombre_fantasia: string;
  calle: string | null;
  puerta: string | null;
  localidad_nombre: string | null;
  localidad_provincia: string | null;
  lat: number | null;
  lng: number | null;
}

function extractPushChunks(html: string): string {
  const re = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let m;
  let all = '';
  while ((m = re.exec(html)) !== null) all += m[1];
  return all;
}

function parsePromos(chunkText: string): ChacoPromo[] {
  const promos: ChacoPromo[] = [];
  const idRe = /\\"id\\":\\"([a-f0-9-]{36})\\",\\"slug\\":\\"([^\\]+)\\"/g;
  let m;
  while ((m = idRe.exec(chunkText)) !== null) {
    const id = m[1];
    const slug = m[2];
    const objStart = m.index;
    // el objeto completo de la promo termina antes del cierre "},\"index\"" o similar del wrapper de React;
    // tomamos una ventana generosa y parseamos campos individualmente en vez de JSON.parse
    // (el texto viene con backslashes escapados dentro del RSC stream, no es JSON válido tal cual).
    const window = chunkText.slice(objStart, objStart + 4000);

    // los valores string dentro del RSC stream vienen doblemente escapados
    // (el JSON real fue re-escapado como string de React payload), ej. un
    // salto de línea real aparece como `\\n` (backslash-backslash-n) y una
    // comilla interna como `\\"`. El valor termina en el primer `\"` que NO
    // esté precedido por otro backslash de escape.
    const field = (name: string): string | null => {
      const fm = window.match(new RegExp(`\\\\"${name}\\\\":\\\\"((?:\\\\\\\\.|[^\\\\])*?)\\\\"`));
      if (!fm) return null;
      return fm[1].replace(/\\\\n/g, '\n').replace(/\\\\"/g, '"').replace(/\\\\\\\\/g, '\\');
    };
    const boolField = (name: string): boolean => {
      const fm = window.match(new RegExp(`\\\\"${name}\\\\":(true|false)`));
      return fm ? fm[1] === 'true' : false;
    };
    const numField = (name: string): number | null => {
      const fm = window.match(new RegExp(`\\\\"${name}\\\\":(\\d+)`));
      return fm ? parseInt(fm[1]) : null;
    };
    const arrField = (name: string): string[] | null => {
      const fm = window.match(new RegExp(`\\\\"${name}\\\\":\\[([^\\]]*)\\]`));
      if (!fm) return null;
      const items: string[] = [];
      const itemRe = /\\"([^\\]*)\\"/g;
      let im;
      while ((im = itemRe.exec(fm[1])) !== null) items.push(im[1]);
      return items;
    };

    promos.push({
      id, slug,
      titulo: field('titulo') ?? '',
      subtitulo: field('subtitulo'),
      descripcion_larga: field('descripcion_larga'),
      estado: field('estado') ?? '',
      visible: boolField('visible'),
      vigencia_desde: field('vigencia_desde'),
      vigencia_hasta: field('vigencia_hasta'),
      dias_aplicacion: arrField('dias_aplicacion'),
      marcas_tarjeta: arrField('marcas_tarjeta'),
      canales_aplicacion: arrField('canales_aplicacion'),
      rubro_comercial_id: numField('rubro_comercial_id'),
      sucursal_count: numField('sucursal_count') ?? undefined,
    });
  }
  return promos;
}

async function fetchListPage(page: number): Promise<ChacoPromo[]> {
  const url = page <= 1 ? LIST_URL : `${LIST_URL}?page=${page}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const chunks = extractPushChunks(html);
  return parsePromos(chunks);
}

async function fetchAllPromos(): Promise<ChacoPromo[]> {
  const all: ChacoPromo[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const promos = await fetchListPage(page);
    const nuevos = promos.filter(p => !seen.has(p.id));
    if (nuevos.length === 0) break;
    for (const p of nuevos) seen.add(p.id);
    all.push(...nuevos);
  }
  return all;
}

// Trae solo la primera página de sucursales (20 por promo). La API pagina
// con un `nextCursor` objeto (ej. {nombre_fantasia, id}) pero no se pudo
// determinar el nombre de query param real que la avanza (varias variantes
// probadas — cursor, cursorId, after, page, offset — devuelven siempre la
// misma primera página). Alcanza para tener una muestra de sucursales con
// lat/lng por promo; no es cobertura completa en promos con cientos de
// comercios adheridos (ej. Farmacias: 351 sucursales reales, solo 20 acá).
async function fetchSucursales(promoId: string): Promise<ChacoSucursal[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/promociones/${promoId}/sucursales`, {
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.rows ?? [];
  } catch {
    return [];
  }
}

function parseBeneficio(descLarga: string | null): { discount: string; discountType: string } | null {
  if (!descLarga) return null;

  const cuotas = extractInstallments(descLarga);
  if (cuotas) return { discount: String(cuotas), discountType: 'CUOTAS_SIN_INTERES' };

  const pct = extractDiscount(descLarga);
  if (pct) return { discount: String(pct.value), discountType: pct.type };

  return null;
}

function promoToScraped(p: ChacoPromo, sucursales: ChacoSucursal[]): ScrapedPromo | null {
  if (p.estado !== 'activa' || !p.visible) return null;

  const descLarga = p.descripcion_larga ?? '';
  const beneficio = parseBeneficio(p.descripcion_larga);
  if (!beneficio) return null;

  const fullText = `${p.titulo} ${p.subtitulo ?? ''} ${descLarga}`;
  const validDays = extractValidDays(fullText);
  const cap = extractCap(descLarga);
  const categoria = detectCategoria(fullText) ?? 'Otros';

  const branches = sucursales
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({
      address: [s.calle, s.puerta].filter(Boolean).join(' ') || s.nombre_fantasia,
      city: s.localidad_nombre ?? undefined,
      lat: s.lat as number,
      lng: s.lng as number,
    }));

  return {
    title: `${p.titulo}${beneficio.discountType === 'CUOTAS_SIN_INTERES' ? ` – ${beneficio.discount} cuotas sin interés` : ` – ${beneficio.discount}%`}`,
    description: descLarga.trim() || p.titulo,
    sourceText: descLarga.trim(),
    sourceUrl: `${BASE_URL}/promociones/${p.slug}`,
    externalId: p.id,
    discount: beneficio.discount,
    discountType: beneficio.discountType,
    cap: cap ?? null,
    capPeriod: cap ? 'MONTHLY' : null,
    validDays,
    validFrom: p.vigencia_desde ?? undefined,
    validUntil: p.vigencia_hasta ?? undefined,
    bankNames: [BANK_NAME],
    walletNames: ['Promo TUYA'],
    paymentChannel: normStr((p.canales_aplicacion ?? []).join(' ')).includes('WEB') && !normStr((p.canales_aplicacion ?? []).join(' ')).includes('PRESENCIAL')
      ? 'ANY'
      : 'TARJETA_FISICA',
    categoria,
    storeName: stripBusinessSuffix(p.titulo),
    branches: branches.length > 0 ? branches : undefined,
    note: p.sucursal_count ? `${p.sucursal_count} comercios adheridos` : undefined,
  } as ScrapedPromo;
}

export const ChacoScraper: Scraper = {
  name: 'Chaco',
  async run(): Promise<ScrapedPromo[]> {
    const promos = await fetchAllPromos();
    const result: ScrapedPromo[] = [];

    for (const p of promos) {
      const sucursales = await fetchSucursales(p.id);
      const scraped = promoToScraped(p, sucursales);
      if (scraped) result.push(scraped);
    }

    return dedup(result);
  },
};

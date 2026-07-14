// Banco del Chubut — "Patagonia 365" (bancochubut.com.ar)
//
// El sitio institucional es un Angular SPA (Drupal jsonapi para contenido de página),
// pero el listado de comercios adheridos a Patagonia 365 vive en un microservicio
// aparte, sin WAF, sin sesión de navegador:
//   POST https://www.bancochubut.com.ar/apilaravel/api/promocion/obtenerPromocionesAdheridas
// Body: filtros (todos opcionales) + flags vigenteLunes..vigenteDomingo ("1"/"0",
// funciona como OR — si TODOS están en "0" no devuelve nada, hay que pedir con
// los 7 días en "1" para traer el universo completo) + paginación primerRegistro/rows.
// Devuelve un array plano de promos ya vinculadas a comercio+sucursal con dirección,
// lat/lng, rubros (categorías) y todos los términos de la promo ya estructurados
// (sin necesidad de parsear texto libre): porcentajeDescuento, topeDescuento,
// cuotaDesde/cuotaHasta, vigenteLunes..vigenteDomingo, aplicaIntereses.

import { Scraper, ScrapedPromo } from './types';
import { dedup } from './bank-helpers';

const BANK_NAME = 'Banco del Chubut';
const API_URL = 'https://www.bancochubut.com.ar/apilaravel/api/promocion/obtenerPromocionesAdheridas';
const SOURCE_URL = 'https://www.bancochubut.com.ar/personas/patagonia365/promocion-beneficio';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const PAGE_SIZE = 2000;

const RUBRO_CATEGORY: Record<string, string> = {
  'SUPERMERCADO Y AUTOSERVICIO': 'Supermercados',
  'ALIMENTOS': 'Supermercados',
  'RAMOS GENERALES': 'Supermercados',
  'FARMACIA': 'Farmacias',
  'DRUGSTORE': 'Farmacias',
  'ESTACIONES DE SERVICIO': 'Combustible',
  'AUTOMÓVILES': 'Automotores',
  'MOTOCICLETAS (VENTA, REPUESTOS Y REPARACIONES)': 'Automotores',
  'LAVADERO/LUBRICENTRO': 'Automotores',
  'HOTEL Y OTROS HOSPEDAJES': 'Viajes y Turismo',
  'VIAJES Y TURISMO': 'Viajes y Turismo',
  'TRANSPORTE DE PASAJEROS': 'Transporte',
  'TRANSPORTES': 'Transporte',
  'RESTAURANTE': 'Gastronomía',
  'PARRILLA': 'Gastronomía',
  'ROTISERÍA': 'Gastronomía',
  'PANADERÍA': 'Gastronomía',
  'REPOSTERÍA': 'Gastronomía',
  'VINOTECA': 'Gastronomía',
  'KIOSCO': 'Gastronomía',
  'COMPUTACIÓN': 'Tecnología',
  'INFORMÁTICA': 'Tecnología',
  'TELEFONÍA': 'Tecnología',
  'INDUMENTARIA': 'Indumentaria',
  'TIENDAS Y GRANDES TIENDAS': 'Indumentaria',
  'ZAPATERÍA': 'Indumentaria',
  'DEPORTES (INDUMENTARIA - EQUIPOS)': 'Deportes',
  'VETERINARIA': 'Petshops',
  'ARTÍCULOS DEL HOGAR': 'Hogar',
  'MUEBLERÍA': 'Hogar',
  'BAZAR': 'Hogar',
  'DECO': 'Hogar',
  'BLANCOS Y MANTELERÍA': 'Hogar',
  'CONSTRUCCIÓN (MATERIALES, ABERTURAS, CRISTALERÍA, FERRETERÍA)': 'Hogar',
  'JARDINERÍA': 'Hogar',
  'VIVERO': 'Hogar',
  'ARTÍCULOS DE LIMPIEZA': 'Hogar',
  'CINE Y TEATROS': 'Entretenimiento',
  'ACTIVIDADES DE RECREACIÓN': 'Entretenimiento',
  'SALON DE FIESTAS': 'Entretenimiento',
  'COTILLÓN': 'Entretenimiento',
  'MÚSICA': 'Entretenimiento',
  'VIDEO CLUB': 'Entretenimiento',
  'BELLEZA': 'Salud y Belleza',
  'SALUD': 'Salud y Belleza',
  'PERFUMERÍA': 'Salud y Belleza',
  'ÓPTICA': 'Salud y Belleza',
  'JUGUETERÍAS': 'Jugueterías',
  'LIBRERÍA Y PAPELERÍA': 'Librerías',
  'INSTITUTO DE EDUCACIÓN': 'Librerías',
  'JOYERÍA': 'Otros',
  'MERCERÍA': 'Otros',
  'ARMERÍA Y CUCHILLERÍA': 'Otros',
  'ALARMAS': 'Otros',
  'SEGURIDAD': 'Otros',
  'CERRAJERÍAS': 'Otros',
  'TINTORERÍAS Y LAVANDERÍAS': 'Otros',
  'AGRO': 'Otros',
  'NAUTICA Y PESCA': 'Otros',
  'ASOCIACIÓN': 'Otros',
  'MUNICIPIOS': 'Otros',
  'IMPUESTOS GUBERNAMENTALES': 'Otros',
  'SEGUROS COMPAÑÍAS/ORGANIZACIONES': 'Otros',
  'SERVICIOS PROFESIONALES Y OFICIOS': 'Otros',
  'REGALERÍA': 'Otros',
};

interface ChubutPromo {
  id: number;
  campania: { tarjetaDescripcion: string; nombre: string; fechaInicio: string; fechaFin: string; id: number };
  comercio: {
    id: number;
    nombre: string;
    sucursal: {
      id: number;
      nombre: string;
      logoNombre: string | null;
      direccion: {
        calle: string; numero: number; localidadDescripcion: string; provinciaDescripcion: string;
        latitud: string; longitud: string;
      };
      rubros: { descripcion: string; id: number }[];
    };
  };
  nombre: string;
  destacada: boolean;
  cuotaDesde: number;
  cuotaHasta: number;
  aplicaIntereses: boolean;
  porcentajeDescuento: string;
  topeDescuento: string;
  vigenteLunes: boolean; vigenteMartes: boolean; vigenteMiercoles: boolean;
  vigenteJueves: boolean; vigenteViernes: boolean; vigenteSabado: boolean; vigenteDomingo: boolean;
  leyenda: string;
  fechaFin?: string;
}

function buildValidDays(p: ChubutPromo): number {
  let mask = 0;
  if (p.vigenteDomingo) mask |= 1 << 0;
  if (p.vigenteLunes) mask |= 1 << 1;
  if (p.vigenteMartes) mask |= 1 << 2;
  if (p.vigenteMiercoles) mask |= 1 << 3;
  if (p.vigenteJueves) mask |= 1 << 4;
  if (p.vigenteViernes) mask |= 1 << 5;
  if (p.vigenteSabado) mask |= 1 << 6;
  return mask > 0 ? mask : 127;
}

function parseNumber(s: string): number {
  return parseFloat((s || '0').replace(/\./g, '').replace(',', '.'));
}

function categoryFor(rubros: { descripcion: string }[]): string {
  for (const r of rubros) {
    const cat = RUBRO_CATEGORY[r.descripcion];
    if (cat) return cat;
  }
  return 'Otros';
}

async function fetchAll(): Promise<ChubutPromo[]> {
  const body = {
    id: 0, tarjetaId: 0, campaniaId: 0, comercioId: 0, sucursalId: 0,
    nombre: '', fechaInicioI: '', fechaInicioF: '', fechaFinI: '', fechaFinF: '',
    leyenda: '', cuotaDesde: '', cuotaHasta: '', porcentajeDescuento: '', topeDescuento: '',
    destacada: '', aplicaIntereses: '', tags: '', observaciones: '',
    vigenteLunes: '1', vigenteMartes: '1', vigenteMiercoles: '1', vigenteJueves: '1',
    vigenteViernes: '1', vigenteSabado: '1', vigenteDomingo: '1',
    latitud: '', longitud: '', radioKm: null,
    rubros: [], provincia: '', localidad: '', barrio: '',
    primerRegistro: 0, rows: PAGE_SIZE, sortField: '', sortOrder: '',
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.listaPromociones ?? [];
}

function promoToScraped(p: ChubutPromo): ScrapedPromo[] {
  const suc = p.comercio.sucursal;
  const dir = suc.direccion;
  const storeName = suc.nombre || p.comercio.nombre;
  const categoria = categoryFor(suc.rubros);
  const validDays = buildValidDays(p);
  const pct = parseNumber(p.porcentajeDescuento);
  const cap = parseNumber(p.topeDescuento);
  const cuotas = p.cuotaHasta > 1 && !p.aplicaIntereses ? p.cuotaHasta : null;

  const lat = parseFloat(dir.latitud);
  const lng = parseFloat(dir.longitud);
  const branches = Number.isFinite(lat) && Number.isFinite(lng)
    ? [{ address: `${dir.calle} ${dir.numero}`.trim(), city: dir.localidadDescripcion, lat, lng }]
    : undefined;

  const base: Partial<ScrapedPromo> = {
    sourceUrl: SOURCE_URL,
    sourceText: p.nombre,
    validDays,
    bankNames: [BANK_NAME],
    walletNames: ['Patagonia 365'],
    paymentChannel: 'ANY',
    categoria,
    storeName,
    note: dir.calle ? `Sucursal: ${dir.calle} ${dir.numero}, ${dir.localidadDescripcion}` : undefined,
    branches,
  };

  const promos: ScrapedPromo[] = [];

  if (pct > 0) {
    promos.push({
      ...base,
      title: `${pct}% descuento – ${storeName}`,
      description: p.nombre,
      discount: String(pct),
      discountType: 'PERCENTAGE_DESCUENTO',
      cap: cap > 0 ? cap : null,
      capPeriod: cap > 0 ? 'MONTHLY' : null,
    } as ScrapedPromo);
  }

  if (cuotas) {
    promos.push({
      ...base,
      title: `${cuotas} cuotas sin interés – ${storeName}`,
      description: p.nombre,
      discount: String(cuotas),
      discountType: 'CUOTAS_SIN_INTERES',
      cap: null,
      capPeriod: null,
    } as ScrapedPromo);
  }

  return promos;
}

export const ChubutScraper: Scraper = {
  name: 'Chubut',
  async run(): Promise<ScrapedPromo[]> {
    const raw = await fetchAll();
    const all: ScrapedPromo[] = [];
    for (const p of raw) {
      all.push(...promoToScraped(p));
    }
    return dedup(all);
  },
};

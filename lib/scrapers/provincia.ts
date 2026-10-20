// Banco Provincia Scraper — CuentaDNI Beneficios + Portal general de beneficios
// (1) GET /cuentadni/Home/GetBeneficioByRubro?idRubro={id} → lista de beneficios Cuenta DNI (API JSON)
//     GET /cuentadni/Home/GetBeneficioData2?idBeneficio={id} → detalle con logo, descuento, etc.
// (2) /mvc/banca-personal/{slug} → portal general de beneficios por tarjeta Visa/Mastercard Banco
//     Provincia (CABA/GBA/PBA), ~30 rubros (automotores, indumentaria, farmacias, petshop, etc.).
//     Cada página es HTML estático curado a mano por campaña (sin API/JSON), con bloques repetidos
//     "días válidos (<h1>) → %/cuotas (.benef2 .porcentajePromo) → rubro (.benef3) → marcas adheridas
//     (.marcas / <a class="obj_editor-link-text">) → legales con vigencia (.legales)". Se parsea por
//     regex ya que no hay backend JSON detrás (confirmado 17/10/2026 tras investigar SearchBeneficio,
//     que resultó ser un endpoint distinto, sin resultados, no usado por esta parte del sitio real).
// Logo: https://www.bancoprovincia.com.ar/CDN/Get/{logo}

import { chromium } from 'playwright';
import { Scraper, ScrapedPromo } from './types';
import { detectCategoria, extractCap } from './bank-helpers';

const BASE_URL = 'https://www.bancoprovincia.com.ar/cuentadni/contenidos/cdnibeneficios/';
const API_BASE = 'https://www.bancoprovincia.com.ar/cuentadni/Home';
const CDN_BASE = 'https://www.bancoprovincia.com.ar/CDN/Get';
const PORTAL_BASE = 'https://www.bancoprovincia.com.ar/mvc/banca-personal';
const BANK_NAME = 'Banco Provincia';

const RUBROS = [
  { id: 32, categoria: 'Gastronomía' },
  { id: 27, categoria: 'Supermercados' },
  { id: 34, categoria: '' },      // Promo Acumulable → detectCategoria por comercio
  { id: 1,  categoria: 'Otros' },
];

// Rubros del portal general /mvc/banca-personal/{slug}. Se excluyen campañas no-comerciales
// (madre, Sustentabilidad, adelantate_verano, beneficio_siglo_21, aerolineas_argentinas_,
// traslados) detectadas en relevamiento 17/10/2026 — no tienen estructura de marca/comercio.
const PORTAL_RUBROS: Array<{ slug: string; categoria: string }> = [
  { slug: 'automotores', categoria: 'Automotores' },
  { slug: 'balnearios', categoria: 'Entretenimiento' },
  { slug: 'beneficio_construccion', categoria: 'Hogar' },
  { slug: 'beneficios_librerias', categoria: 'Librerías' },
  { slug: 'bicicleterias', categoria: 'Deportes' },
  { slug: 'casa_de_deportes', categoria: 'Deportes' },
  { slug: 'casas_de_musica', categoria: 'Entretenimiento' },
  { slug: 'centro_estetica', categoria: 'Salud y Belleza' },
  { slug: 'confiterias_panaderias_y_chocolaterias', categoria: 'Gastronomía' },
  { slug: 'delivery', categoria: 'Gastronomía' },
  { slug: 'especial_gastronomia', categoria: 'Gastronomía' },
  { slug: 'farmacias_perfumerias', categoria: 'Farmacias' },
  { slug: 'gimnasios', categoria: 'Deportes' },
  { slug: 'hoteles', categoria: 'Viajes y Turismo' },
  { slug: 'jugueterias_art_libreria', categoria: 'Jugueterías' },
  { slug: 'marcas_indumentaria', categoria: 'Indumentaria' },
  { slug: 'omnibus', categoria: 'Transporte' },
  { slug: 'open_sports', categoria: 'Deportes' },
  { slug: 'opticas', categoria: 'Salud y Belleza' },
  { slug: 'petshop', categoria: 'Petshops' },
  { slug: 'regular_pinturerias', categoria: 'Hogar' },
  { slug: 'servicios_salud', categoria: 'Salud y Belleza' },
  { slug: 'turismo', categoria: 'Viajes y Turismo' },
  { slug: 'vinotecas', categoria: 'Gastronomía' },
  { slug: 'viveros', categoria: 'Hogar' },
];

// Parsea formato .NET: "\/Date(1652756400000)\/" → Date
function parseMsDate(val: any): Date | null {
  if (!val) return null;
  const m = String(val).match(/\/Date\((-?\d+)\)\//);
  if (!m) return null;
  return new Date(parseInt(m[1]));
}

function parseDaysFromLegal(legal: string): number {
  const t = legal.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/LUNES A DOMINGO/.test(t)) return 127;
  if (/LUNES A VIERNES/.test(t)) return 0b0111110;
  if (/LUNES A JUEVES/.test(t))  return 0b0011110;
  if (/SABADOS Y DOMINGOS|SABADO Y DOMINGO|FIN DE SEMANA/.test(t)) return 0b1000001;
  // "todos los dias jueves" → solo jueves; "todos los dias" sin día → 127 al final
  const MAP: Record<string, number> = {
    LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6, DOMINGO: 0,
  };
  let mask = 0;
  for (const [day, bit] of Object.entries(MAP)) {
    if (t.includes(day)) mask |= 1 << bit;
  }
  return mask > 0 ? mask : 127;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Parsea "DESDE EL dd/mm/yyyy HASTA EL dd/mm/yyyy" o "DESDE EL dd de <mes> HASTA EL dd de <mes> de yyyy"
// de un bloque de texto legal. Devuelve { validFrom, validUntil } en formato YYYY-MM-DD.
const MESES: Record<string, string> = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

function parseFechaDMY(d: string, m: string, y: string): string | undefined {
  const mm = /^\d+$/.test(m) ? m.padStart(2, '0') : MESES[m.toUpperCase()];
  if (!mm) return undefined;
  return `${y}-${mm}-${d.padStart(2, '0')}`;
}

export function parseVigencia(legal: string): { validFrom?: string; validUntil?: string } {
  const t = legal.toUpperCase();
  // DESDE EL 1 DE SEPTIEMBRE HASTA EL 31 DE DICIEMBRE DE 2026
  let m = t.match(/DESDE EL (\d{1,2}) DE ([A-ZÁÉÍÓÚÑ]+)(?: DE (\d{4}))? HASTA EL (\d{1,2}) DE ([A-ZÁÉÍÓÚÑ]+) DE (\d{4})/);
  if (m) {
    const [, d1, mes1, y1, d2, mes2, y2] = m;
    return {
      validFrom: parseFechaDMY(d1, mes1, y1 ?? y2),
      validUntil: parseFechaDMY(d2, mes2, y2),
    };
  }
  // DESDE EL dd/mm/yyyy HASTA EL dd/mm/yyyy
  m = t.match(/DESDE EL (\d{1,2})\/(\d{1,2})\/(\d{4}) HASTA EL (\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const [, d1, mo1, y1, d2, mo2, y2] = m;
    return {
      validFrom: `${y1}-${mo1.padStart(2, '0')}-${d1.padStart(2, '0')}`,
      validUntil: `${y2}-${mo2.padStart(2, '0')}-${d2.padStart(2, '0')}`,
    };
  }
  // DESDE EL 01 AL 30 DE SEPTIEMBRE 2026
  m = t.match(/DESDE EL (\d{1,2}) AL (\d{1,2}) DE ([A-ZÁÉÍÓÚÑ]+) (\d{4})/);
  if (m) {
    const [, d1, d2, mes, y] = m;
    return { validFrom: parseFechaDMY(d1, mes, y), validUntil: parseFechaDMY(d2, mes, y) };
  }
  // DEL 01 DE ABRIL (DE 2026)? AL 31 DE MARZO DE 2027  |  DEL 01 DE SEPTIEMBRE AL 31 DE DICIEMBRE 2026
  m = t.match(/DEL (\d{1,2}) DE ([A-ZÁÉÍÓÚÑ]+)(?: DE (\d{4}))? AL (\d{1,2}) DE ([A-ZÁÉÍÓÚÑ]+)(?: DE)? (\d{4})/);
  if (m) {
    const [, d1, mes1, y1, d2, mes2, y2] = m;
    return {
      validFrom: parseFechaDMY(d1, mes1, y1 ?? y2),
      validUntil: parseFechaDMY(d2, mes2, y2),
    };
  }
  // Lista de fechas puntuales no contiguas: "LOS DÍAS SABADOS 5, 12 y 26 DE SEPTIEMBRE; 3 y 24 DE
  // OCTUBRE; ... 2026" — no es un rango continuo, se aproxima con la primera y última fecha listada.
  // Cada grupo "d1, d2 y d3 DE MES" trae el mes una sola vez, al final del grupo — se asigna hacia
  // atrás (forward-fill) a los números sueltos que lo preceden dentro del mismo grupo, nunca hacia
  // los grupos siguientes. Se corta el string antes del año para no capturar sus dígitos como días.
  if (/LOS D[ÍI]AS/.test(t) && /,|;/.test(t)) {
    const yearMatch = t.match(/\b(\d{4})\b/);
    if (yearMatch) {
      const year = yearMatch[1];
      const scope = t.slice(0, yearMatch.index);
      const groups = scope.split(';');
      const fechas: { d: string; mes: string }[] = [];
      for (const group of groups) {
        const mesMatch = group.match(/DE\s+([A-ZÁÉÍÓÚÑ]+)\s*$/);
        const mes = mesMatch?.[1];
        if (!mes || !MESES[mes]) continue;
        const dias = Array.from(group.matchAll(/(\d{1,2})/g)).map(x => x[1]);
        for (const d of dias) fechas.push({ d, mes });
      }
      if (fechas.length > 0) {
        return {
          validFrom: parseFechaDMY(fechas[0].d, fechas[0].mes, year),
          validUntil: parseFechaDMY(fechas[fechas.length - 1].d, fechas[fechas.length - 1].mes, year),
        };
      }
    }
  }
  return {};
}

export interface PortalBlock {
  diasLabel: string;
  discountPct?: number;
  cuotas?: number;
  cuotasConInteres?: boolean; // "cuotas fijas (**)" = con interés, no es beneficio real de descuento
  aplicaA: string; // "En indumentaria" / "En toda la tienda" / etc.
  legalRefs: string[]; // texto legal asociado (por número de nota (1)/(2)/(3) o el primero sin número)
  marcas: string[]; // nombres de marca (del href CDN/Get/regular_{marca} o alt de <img>)
}

// Extrae bloques de promo de una página /mvc/banca-personal/{slug} (HTML ya renderizado).
// Estructura real (confirmada 17/10/2026 contra 6 rubros de muestra: petshop, marcas_indumentaria,
// gimnasios, opticas, hoteles, omnibus): el delimitador confiable de bloque es cada
// <h2 class="benef3"> (rubro de aplicación) — SIEMPRE presente, a diferencia de
// <div class="benef2">, que en algunos rubros (hoteles, opticas) está ausente, vacío, o no es
// 1:1 con los bloques reales. El %/cuotas de cada bloque está en el tramo de HTML INMEDIATAMENTE
// ANTES de su propio benef3 (no hay otro marcador confiable). El <h1> de días NO es 1:1 con los
// bloques (puede faltar, o contener el logo de una marca como Nike en vez de un texto de días).
// Los legales con vigencia real ("PROMOCIÓN VÁLIDA...“/"VIGENCIA DESDE...") aparecen todos juntos
// al final de la página, en el mismo orden que los bloques — se correlacionan por posición
// (N-ésimo legal de vigencia → N-ésimo bloque), no por el número de nota (*)/(1)/(2), que no es
// consistente entre rubros. Las marcas (<a class="obj_editor-link-text" href=".../CDN/Get/regular_
// {marca}">) se toman del tramo entre el benef3 propio y el próximo (o fin de página).
// Nombre de marca a partir de un bloque <a class="obj_editor-link-text">...</a>: 4 patrones de
// href "CDN/Get/..." observados (regular_/logo_/especial_ como prefijo, o bare "{marca}_{numero}"),
// más 2 fallbacks por <img alt="..."> cuando el href es una URL externa (ej. Nike, Rentcars):
// alt="logo_{marca}" (prefijo) o alt="{marca}_logo" (sufijo).
function extractMarcaFromLinkTag(tag: string): string | undefined {
  return tag.match(/CDN\/Get\/(?:regular_|logo_|especial_)?([a-zA-Z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)*)/i)?.[1]
    ?? tag.match(/<img[^>]*alt="logo_([a-zA-Z][a-zA-Z0-9_]*)"/i)?.[1]
    ?? tag.match(/<img[^>]*alt="([a-zA-Z][a-zA-Z0-9_]*)_logo"/i)?.[1];
}

// El src del <img> suele apuntar a CDN/Get/{marca}_logo (ej. rentcars_logo) — ese sufijo es
// parte del nombre del archivo, no de la marca. Se limpia acá (mismo tratamiento que el sufijo
// numérico _N) antes de aplicar el filtro de exclusión "termina en logo" más abajo, para no
// confundir una marca real terminada en "_logo" con un ícono placeholder genérico.
function cleanMarcaName(raw: string): string {
  return raw.replace(/(_\d+)+$/, '').replace(/_logo$/i, '').replace(/_especial$/i, '').replace(/_/g, ' ').trim();
}

export function parsePortalRubroHtml(html: string): PortalBlock[] {
  const blocks: PortalBlock[] = [];

  const benef3Regex = /<h2 class="benef3"[^>]*>[\s\S]*?<\/h2>/g;
  const benef3Starts: number[] = [];
  const benef3Ends: number[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = benef3Regex.exec(html))) {
    benef3Starts.push(bm.index);
    benef3Ends.push(bm.index + bm[0].length);
  }

  // Algunas páginas (ej. casa_de_deportes, open_sports) no tienen ningún benef3 — un solo bloque
  // implícito para toda la página, usando el <h1> real (con texto, no logo/link) como aplicaA.
  if (benef3Starts.length === 0) {
    const h1Matches = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g));
    let aplicaA = '';
    for (const hm of h1Matches) {
      const text = hm[1].replace(/<[^>]+>/g, '').trim();
      if (text && !/<img|<a /i.test(hm[1])) { aplicaA = text; break; }
    }
    if (!aplicaA) return blocks;

    const pctMatch = html.match(/<span class="porcentajePromo">[\s\S]{0,40}?(\d+)%?[\s\S]{0,20}?<\/span>\s*<h2[^>]*>(?:\s*<span[^>]*>)?\s*de ahorro/i);
    const cuotasMatch = html.match(/<span class="porcentajePromo">[\s\S]{0,40}?(\d+)[\s\S]{0,20}?<\/span>\s*(?:<br[^>]*>\s*)?<h2[^>]*>(?:\s*<span[^>]*>)?\s*cuotas (sin interés|fijas)/i);
    const marcaLinkBlocks = html.match(/<a class="obj_editor-link-text"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    const marcas = Array.from(new Set(marcaLinkBlocks
      .map(extractMarcaFromLinkTag)
      .filter((s): s is string => !!s)
      .map(cleanMarcaName)
      .filter(s => s && !/^otras\b/i.test(s) && !/\blogo$/i.test(s) && !/carrusel/i.test(s))));

    const legal = (Array.from(html.matchAll(/<p class="legales"[^>]*>([\s\S]*?)<\/p>/g))
      .map(x => x[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
      .find(t => /PROMOCI[ÓO]N V[ÁA]LIDA|VIGENCIA DESDE/i.test(t))) ?? '';

    blocks.push({
      diasLabel: 'Todos los días',
      discountPct: pctMatch ? parseInt(pctMatch[1]) : undefined,
      cuotas: cuotasMatch ? parseInt(cuotasMatch[1]) : undefined,
      cuotasConInteres: cuotasMatch
        ? (/SIN INTER[ÉE]S/i.test(legal) ? false : /CON INTER[ÉE]S/i.test(legal) ? true : undefined)
        : undefined,
      aplicaA,
      legalRefs: legal ? [legal] : [],
      marcas,
    });
    return blocks;
  }

  // Cada bloque: desde el fin del benef3 ANTERIOR (o inicio de página) hasta el fin del PRÓXIMO
  // benef3 (o fin de página) — incluye así el %/cuotas que antecede al benef3 propio y las marcas
  // que lo siguen, sin arrastrar el benef3 del bloque anterior ni el texto del próximo.
  const subSegments: { segment: string; offset: number }[] = [];
  for (let i = 0; i < benef3Starts.length; i++) {
    const subStart = i === 0 ? 0 : benef3Ends[i - 1];
    const subEnd = i + 1 < benef3Starts.length ? benef3Starts[i + 1] : html.length;
    subSegments.push({ segment: html.slice(subStart, subEnd), offset: subStart });
  }

  // Legales de vigencia real, en orden de aparición en toda la página (compartidos entre bloques)
  const legalParasAll = Array.from(html.matchAll(/<p class="legales"[^>]*>([\s\S]*?)<\/p>/g))
    .map(x => x[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => /PROMOCI[ÓO]N V[ÁA]LIDA|VIGENCIA DESDE/i.test(t));

  let vigenciaIdx = 0;
  for (const { segment, offset } of subSegments) {
    const aplicaMatch = segment.match(/<h2 class="benef3"[^>]*>\s*([^<]+?)\s*<\/h2>/i);
    if (!aplicaMatch) continue; // sin cierre benef3 real: descartar

    // Días: buscar el <h1> con texto más cercano ANTES de este bloque en el documento completo
    const before = html.slice(0, offset);
    const h1Matches = Array.from(before.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g));
    let diasLabel = 'Todos los días';
    for (let i = h1Matches.length - 1; i >= 0; i--) {
      const text = h1Matches[i][1].replace(/<[^>]+>/g, '').trim();
      if (text && !/<img|<a /i.test(h1Matches[i][1])) { diasLabel = text; break; }
    }

    // %/cuotas: <span class="porcentajePromo">N</span> ... <h2>[<span...>]texto que lo describe</h2>
    // El <h2> puede envolver el texto en un <span style="..."> extra (ej. bloque "Decathlon" en
    // indumentaria) antes de la palabra "cuotas" — tolerar ese span opcional.
    const pctMatch = segment.match(/<span class="porcentajePromo">[\s\S]{0,40}?(\d+)%?[\s\S]{0,20}?<\/span>\s*<h2[^>]*>(?:\s*<span[^>]*>)?\s*de ahorro/i);
    // "N" o "N y M" cuotas (ej. "4 y 6 cuotas sin interés") — se toma el mayor como tope de cuotas
    // ofrecido. 2 variantes de layout: span seguido de h2 separado (ej. vinotecas), o span dentro
    // del propio h2 de "de ahorro" (ej. centro_estetica/confiterias — el mismo <h2> envuelve el
    // número y, en un <h2> hermano siguiente, el texto "cuotas sin interés").
    let cuotasMatch = segment.match(/<span class="porcentajePromo">[\s\S]{0,40}?(\d+)[\s\S]{0,20}?<\/span>\s*(?:<br[^>]*>\s*)?<h2[^>]*>(?:\s*<span[^>]*>)?\s*cuotas (sin interés|fijas)/i);
    if (!cuotasMatch) {
      const nYmMatch = segment.match(/<span class="porcentajePromo">\s*(\d+)\s*y\s*(\d+)\s*<\/span>\s*<\/h2>\s*<h2[^>]*>\s*cuotas (sin interés|fijas)/i);
      if (nYmMatch) {
        const [, n1, n2, tipo] = nYmMatch;
        cuotasMatch = [nYmMatch[0], String(Math.max(parseInt(n1), parseInt(n2))), tipo] as unknown as RegExpMatchArray;
      }
    }

    // Marcas: solo de links reales de marca (<a class="obj_editor-link-text">...</a>), nunca de
    // cualquier <img>/script suelto (ej. el widget de cotización de dólar embebido al final de la
    // página). Ver extractMarcaFromLinkTag para los patrones de href/alt soportados.
    const marcaLinkBlocks = segment.match(/<a class="obj_editor-link-text"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    const marcaHrefs = marcaLinkBlocks
      .map(extractMarcaFromLinkTag)
      .filter((s): s is string => !!s);
    const marcas = Array.from(new Set(marcaHrefs
      .map(cleanMarcaName)
      .filter(s => s && !/^otras\b/i.test(s) && !/\blogo$/i.test(s) && !/carrusel/i.test(s))));

    const legal = legalParasAll[vigenciaIdx] ?? '';
    vigenciaIdx++;
    // "cuotas fijas" en el <h2> es ambiguo: existen tanto "FIJAS SIN INTERÉS" como "FIJAS CON
    // INTERÉS" (ej. "Provincia Cuotas Max") — la única fuente confiable es el texto legal.
    const cuotasConInteres = cuotasMatch
      ? (/SIN INTER[ÉE]S/i.test(legal) ? false : /CON INTER[ÉE]S/i.test(legal) ? true : undefined)
      : undefined;

    // Si el bloque no trae marcas propias (ej. "Provincia Cuotas Max" genérico, sin su propio
    // div de marcas), hereda las del bloque anterior del mismo rubro — en la práctica ese
    // programa genérico aplica a las mismas marcas ya adheridas en la página.
    const finalMarcas = marcas.length > 0 ? marcas : (blocks[blocks.length - 1]?.marcas ?? []);

    blocks.push({
      diasLabel,
      discountPct: pctMatch ? parseInt(pctMatch[1]) : undefined,
      cuotas: cuotasMatch ? parseInt(cuotasMatch[1]) : undefined,
      cuotasConInteres,
      aplicaA: aplicaMatch[1].trim(),
      legalRefs: legal ? [legal] : [],
      marcas: finalMarcas,
    });
  }

  return blocks;
}

export const ProvinciaScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Provincia] Iniciando scraper...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });
    const allPromos: ScrapedPromo[] = [];

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'es-AR',
      });

      const page = await context.newPage();
      await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', r => r.abort());

      // Cargar página para obtener cookies de sesión
      console.log('[Provincia] Cargando página...');
      try {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch {
        console.log('[Provincia] Timeout cargando página, continuando...');
      }
      await page.waitForTimeout(2000);

      const apiGet = async (url: string) => {
        try {
          const res = await context.request.get(url, {
            headers: { 'Accept': 'application/json', 'Referer': BASE_URL },
            timeout: 15000,
          });
          if (!res.ok()) return null;
          return await res.json();
        } catch { return null; }
      };

      let sampleLogged = false;

      for (const rubro of RUBROS) {
        await delay(300);
        const listData = await apiGet(`${API_BASE}/GetBeneficioByRubro?idRubro=${rubro.id}`);
        if (!listData) {
          console.log(`[Provincia] Rubro ${rubro.id}: sin respuesta`);
          continue;
        }

        const items: any[] = Array.isArray(listData) ? listData
          : (listData.data ?? listData.beneficios ?? listData.items ?? listData.result ?? []);

        if (!Array.isArray(items) || items.length === 0) {
          console.log(`[Provincia] Rubro ${rubro.id}: vacío. Keys: ${Object.keys(listData).join(',')}`);
          continue;
        }

        if (!sampleLogged) {
          console.log(`[Provincia] Sample item rubro ${rubro.id}:`, JSON.stringify(items[0]).slice(0, 400));
          sampleLogged = true;
        }

        console.log(`[Provincia] Rubro ${rubro.id}: ${items.length} beneficios`);

        for (const item of items) {
          const storeName = (item.titulo ?? item.comercio ?? item.nombre ?? '').trim();
          if (!storeName) continue;

          // porcentaje viene como número, no como "30%"
          const discount = item.porcentaje ? Number(item.porcentaje) : null;
          const cuotas   = item.cuotas     ? parseInt(String(item.cuotas)) : null;
          if (!discount && !cuotas) continue;

          const legal      = item.legal ?? item.descripcion ?? '';
          const bajada     = item.bajada ?? item.subtitulo ?? '';
          const fullText   = `${bajada} ${legal}`;
          const categoria  = rubro.categoria || detectCategoria(storeName);
          const cap        = extractCap(fullText.toUpperCase());
          const logo       = item.logo ?? '';
          // Saltar promos ocultas o expiradas
          if (item.oculto === 1 || item.oculto === true) continue;
          const fechaHasta = parseMsDate(item.fecha_hasta ?? item.fechaHasta);
          const fechaDesde = parseMsDate(item.fecha_desde ?? item.fechaDesde);
          if (fechaHasta && fechaHasta < new Date()) continue;

          const validDays  = parseDaysFromLegal(legal);
          const description = [bajada, item.subtitulo].filter(Boolean).join(' | ').slice(0, 500);

          const sourceUrl = item.url ? `${BASE_URL}#${item.url}` : BASE_URL;

          const base: Partial<ScrapedPromo> = {
            storeName,
            description,
            sourceText:   legal.slice(0, 8000),
            sourceUrl,
            validDays,
            validFrom:    fechaDesde ? fechaDesde.toISOString().split('T')[0] : undefined,
            validUntil:   fechaHasta ? fechaHasta.toISOString().split('T')[0] : undefined,
            cap:          cap ?? null,
            capPeriod:    cap ? 'MONTHLY' : undefined,
            capTarget:    cap ? 'USER' : null,
            bankNames:    [BANK_NAME],
            walletNames:  ['Cuenta DNI'],
            paymentChannel: 'QR' as const,
            categoria,
            storeLogoUrl: logo ? `${CDN_BASE}/${logo}` : undefined,
          };

          if (discount && discount > 0) {
            allPromos.push({
              ...base,
              title:        `${discount}% descuento – ${storeName}`,
              discount:     String(discount),
              discountType: 'PERCENTAGE_REINTEGRO',
            } as ScrapedPromo);
          }
          if (cuotas && cuotas > 0) {
            allPromos.push({
              ...base,
              title:        `${cuotas} cuotas sin interés – ${storeName}`,
              discount:     String(cuotas),
              discountType: 'CUOTAS_SIN_INTERES',
            } as ScrapedPromo);
          }
        }

        console.log(`[Provincia] Rubro ${rubro.id}: ${allPromos.length} promos acum`);
      }

      // --- Portal general /mvc/banca-personal/{slug} (Visa/Mastercard Banco Provincia) ---
      for (const portalRubro of PORTAL_RUBROS) {
        await delay(300);
        const url = `${PORTAL_BASE}/${portalRubro.slug}`;
        let html = '';
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });
          html = await page.content();
        } catch {
          console.log(`[Provincia] Portal ${portalRubro.slug}: error de carga, se omite`);
          continue;
        }

        const blocks = parsePortalRubroHtml(html);
        if (blocks.length === 0) {
          console.log(`[Provincia] Portal ${portalRubro.slug}: sin bloques de promo`);
          continue;
        }

        let countRubro = 0;
        for (const block of blocks) {
          if (block.marcas.length === 0) continue;
          const legalText = block.legalRefs.join(' ');
          const { validFrom, validUntil } = parseVigencia(legalText);
          const validDays = parseDaysFromLegal(`${block.diasLabel} ${legalText}`);

          for (const marcaRaw of block.marcas) {
            const storeName = marcaRaw.replace(/\b\w/g, c => c.toUpperCase());
            const base: Partial<ScrapedPromo> = {
              storeName,
              description: block.aplicaA,
              sourceText: legalText.slice(0, 8000) || block.aplicaA,
              sourceUrl: url,
              validDays,
              validFrom,
              validUntil,
              bankNames: [BANK_NAME],
              cardNetworks: [
                { network: 'VISA', type: 'CREDIT' },
                { network: 'MASTERCARD', type: 'CREDIT' },
              ],
              categoria: portalRubro.categoria,
            };

            if (block.discountPct && block.discountPct > 0) {
              allPromos.push({
                ...base,
                title: `${block.discountPct}% descuento – ${storeName}`,
                discount: String(block.discountPct),
                discountType: 'PERCENTAGE_REINTEGRO',
              } as ScrapedPromo);
              countRubro++;
            }
            if (block.cuotas && block.cuotas > 0 && !block.cuotasConInteres) {
              allPromos.push({
                ...base,
                title: `${block.cuotas} cuotas sin interés – ${storeName}`,
                discount: String(block.cuotas),
                discountType: 'CUOTAS_SIN_INTERES',
              } as ScrapedPromo);
              countRubro++;
            }
          }
        }
        console.log(`[Provincia] Portal ${portalRubro.slug}: ${countRubro} promos (${blocks.length} bloques)`);
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.title}|${p.storeName}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[ProvinciaScraper] Total: ${unique.length} promos`);
    return unique;
  },
};

// Banco Macro Scraper — API JSON directa (reescrito 8/11/2026)
//
// Hallazgo clave (8/11/2026, vía inspección de red del propio Pablo en F12): la grilla
// de beneficios de Macro (y su filtro por categoría) está servida por un endpoint JSON
// público, sin WAF ni sesión de navegador:
//
//   GET https://rewards-handler.playdigital.com.ar/slots/
//       ?slots=web-banco-hub-promos_corriendo&source=web_bank&banks={BANK_UUID}
//       &origin=web_bank&slot_info=false&limit=500&fcalcstatus=running&page={n}
//
// Devuelve { data: { cards: [...] }, metadata: { pagination: { page, total_pages,
// total_results } } }. Confirmado en vivo: 2349 resultados crudos en 5 páginas de 500,
// 2090 únicos tras deduplicar por id — vs. ~119 que lograba el scraper viejo basado en
// Playwright + clicks sobre la grilla visual (que además corre un WAF F5 BIG-IP en
// www.macro.com.ar, completamente evitado acá). Reemplaza por completo al scraper
// anterior (ver git history para la versión basada en clicks/Playwright).
//
// Sin WAF ⇒ sin riesgo de timeout de ~300s ⇒ se elimina el split MacroScraper1/2 que
// existía para ese problema (ver CLAUDE.md, "Macro desdoblado en 2 scrapers") y se
// vuelve a un único MacroScraper.
//
// Cada card trae:
//   - id / extra_params.promo_id → el id real de la promo puede diferir del id de la
//     card; SIEMPRE preferir extra_params.promo_id cuando existe (confirmado con casos
//     concretos de YPF donde difieren).
//   - title → ya viene limpio y legible, con % o CSI incluido (ej. "30% de reintegro
//     Nivel 4", "6 CSI en Get The Look").
//   - start_date / stop_date → ISO 8601, mapean directo a validFrom/validUntil.
//   - days_of_week → string de letras concatenadas (L M X J V S D), sin separador.
//   - debit_list / credit_list → redes normalizadas en minúscula (visa, master,
//     american_express, cabal, dinners_club, maestro, confiable).
//   - categories_whitelist.categories[].map_category → id numérico de categoría (ver
//     CATEGORY_MAP más abajo, resuelto por inspección de ~500 cards reales).
//   - where → texto libre de ubicación/canal (se guarda en sourceText).
//   - trigger_type: 'payment_promotion' | 'installments' → determina si es % o CSI.
//   - content.row[4].text → tope de la promo (monto numérico, "Sin tope", o vacío/basura).
//     Confirmado sobre 2356 cards reales que este índice es estable. No se encontró
//     equivalente para mínimo de compra ni período del tope (diario/mensual/etc.) en
//     este payload — quedan sin poblar (cap/capUnlimited sí se completan).
//
// Sucursales adheridas: se mantiene el mismo endpoint que ya se usaba (map-handler),
// ahora llamado por fetch plano (sin browser) ya que no tiene WAF tampoco.

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';

const SLOTS_API  = 'https://rewards-handler.playdigital.com.ar/slots/';
const STORES_API = 'https://map-handler.playdigital.com.ar/stores';
// UUID fijo de Banco Macro en las APIs de playdigital — confirmado constante entre
// promos distintas en reconnaissance en vivo.
const BANK_UUID     = '6a089c91-a7d3-4199-a578-2132a3733f69';
const BANK_NAME     = 'Banco Macro';
const BRANCH_SOURCE = 'Banco Macro';
const PAGE_LIMIT    = 500;

// Bounding box de toda Argentina, para pedir sucursales a nivel nacional en una sola llamada.
const ARGENTINA_ZONE = '-73.6,-55.1,-53.6,-21.7';

const COMMON_HEADERS = {
  accept: 'application/json',
  origin: 'https://www.macro.com.ar',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// ─── Mapeo de categoría numérica (categories_whitelist.map_category) → categoría PromoAR ─
// Resuelto por inspección de ~500 cards reales (8/11/2026). map_category=3 mezcla
// Deportes e Indumentaria bajo un solo id en la taxonomía propia de Macro — se resuelve
// a nivel de comercio (igual que el resto del scraper, ver app/api/admin/scrape/route.ts:
// "la categoría del comercio resuelto siempre pisa la detección por keywords"), así que
// acá se deja en blanco (sin forzar ninguna de las dos) para no pisar esa resolución.
// map_category=9 nunca apareció en ninguna muestra — se omite a propósito.
const CATEGORY_MAP: Record<number, string> = {
  1: 'Supermercados',
  2: 'Gastronomía',
  // 3: sin asignar — Deportes/Indumentaria mezclados, se resuelve por comercio.
  4: 'Farmacias',
  5: 'Combustible',
  // 6: gimnasios/fitness — no matchea ninguna categoría propia, se deja sin asignar.
  7: 'Hogar',
  8: 'Automotores',
  10: 'Tecnología',
  11: 'Otros',       // Ferretería y Pinturerías — sin categoría propia equivalente
  12: 'Petshops',
  13: 'Jugueterías',
  14: 'Viajes y Turismo',
  15: 'Otros',
};

function mapCategoria(mapCategories: number[]): string {
  for (const id of mapCategories) {
    const cat = CATEGORY_MAP[id];
    if (cat) return cat;
  }
  return '';
}

// ─── Redes de tarjeta: debit_list/credit_list (minúscula, normalizado por playdigital) ──

const NETWORK_NAME_MAP: Record<string, string> = {
  visa: 'VISA',
  master: 'Mastercard',
  american_express: 'American Express Banco',
  cabal: 'Cabal',
  dinners_club: 'Diners',
  diners: 'Diners',
  maestro: 'Maestro',
  confiable: 'Confiable',
};

function buildCardNetworks(debitList: string[], creditList: string[]): CardNetworkWithType[] {
  const nets: CardNetworkWithType[] = [];
  const seen = new Set<string>();
  for (const raw of debitList || []) {
    const name = NETWORK_NAME_MAP[raw];
    if (!name) continue;
    const key = `${name}|DEBIT`;
    if (seen.has(key)) continue;
    seen.add(key);
    nets.push({ network: name, type: 'DEBIT' });
  }
  for (const raw of creditList || []) {
    const name = NETWORK_NAME_MAP[raw];
    if (!name) continue;
    const key = `${name}|CREDIT`;
    if (seen.has(key)) continue;
    seen.add(key);
    nets.push({ network: name, type: 'CREDIT' });
  }
  return nets;
}

// ─── Días de la semana: días_of_week ("LMXJVSD", "X", "VSD", ...) ────────────────────
// Orden de letras confirmado: L M X J V S D (lunes..domingo). Bit mask: domingo=0.

const DAY_LETTER_TO_BIT: Record<string, number> = {
  L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0,
};

function parseValidDays(daysOfWeek: string): number {
  if (!daysOfWeek) return 127;
  let mask = 0;
  for (const letter of daysOfWeek) {
    const bit = DAY_LETTER_TO_BIT[letter];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return mask || 127;
}

// ─── Nombre de comercio: se extrae del title, NUNCA es el title completo ────────────
// El title mezcla descuento+comercio en varios formatos observados en ~500 cards reales:
//   "30% en {COMERCIO}" / "18 CSI en {COMERCIO}" / "50% de reintegro en {COMERCIO}"
//   "{COMERCIO} Selecta" / "{COMERCIO} Nivel N" / "{COMERCIO} Selecta Nivel N"
//   "30% {COMERCIO}" (sin "en" interpuesto) / "N CSI {COMERCIO}"
// ~98% de 500 cards de muestra resuelven con estos patrones; el resto (ya el title ES
// básicamente el nombre, ej. "Samsung Cyber") se deja igual.
function extractStoreName(title: string): string {
  const t = (title || '').trim();
  let m = t.match(/\ben\s+(.+)$/i);
  if (m) return m[1].trim();
  m = t.match(/^(.*?)\s+(?:Selecta(?:\s+Nivel\s*\d+)?|Nivel\s*\d+)\s*$/i);
  if (m && m[1].trim()) return m[1].trim();
  m = t.match(/^\d+(?:[.,]\d+)?%\s*(?:de reintegro\s*)?(.+)$/i);
  if (m && m[1].trim()) return m[1].trim();
  m = t.match(/^(\d+)\s*CSI\s+(.+)$/i);
  if (m && m[2].trim()) return m[2].trim();
  return t;
}

// ─── Descuento: title ("30% de reintegro...", "6 CSI en...") + trigger_type ──────────

function parseDiscount(title: string, triggerType: string, shortDescription?: string): { discount: string; discountType: string } | null {
  const pct = title.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (pct) {
    return { discount: pct[1].replace(',', '.'), discountType: 'PERCENTAGE_DESCUENTO' };
  }
  const csi = title.match(/(\d+)\s*CSI\b/i) || title.match(/(\d+)\s*cuotas?\s*sin\s*inter[eé]s/i);
  if (csi) {
    return { discount: csi[1], discountType: 'CUOTAS_SIN_INTERES' };
  }
  const nxm = title.match(/(\d+)\s*x\s*(\d+)/i);
  if (nxm) {
    return { discount: '0', discountType: `NXM_${nxm[1]}X${nxm[2]}` };
  }

  // El título a veces es solo el nombre del comercio/campaña ("CARNES EL REY",
  // "BERRIA Nivel 4") sin el dato del descuento — en esos casos el slug de
  // short_description lo trae al final (ej. "...-Presencial-NFC-30off",
  // "...-online-6csi", "...-todos-online&presencial-NFC-57k"). Confirmado sobre
  // muestras reales que cubre ~30/31 de los títulos sin % /CSI/NxM detectable.
  const slugMatch = shortDescription?.match(/-(\d+)(off|csi|k)\b/i);
  if (slugMatch) {
    const value = slugMatch[1];
    const kind = slugMatch[2].toLowerCase();
    if (kind === 'off') return { discount: value, discountType: 'PERCENTAGE_DESCUENTO' };
    if (kind === 'csi') return { discount: value, discountType: 'CUOTAS_SIN_INTERES' };
    if (kind === 'k') return { discount: String(parseInt(value, 10) * 1000), discountType: 'FIXED_AMOUNT' };
  }

  if (triggerType === 'installments') {
    // CSI sin número explícito en el title ni en el slug — no se puede inferir con seguridad, se omite.
    return null;
  }
  return null;
}

// ─── Canal de pago: payment_flow ("instore", "instore_nfc", "online", ...) ───────────

function parsePaymentChannel(paymentFlow: string): ScrapedPromo['paymentChannel'] {
  const flows = (paymentFlow || '').split(',').map(f => f.trim());
  if (flows.includes('instore_nfc')) return 'NFC';
  if (flows.includes('online') && !flows.includes('instore')) return 'ANY';
  if (flows.includes('instore')) return 'TARJETA_FISICA';
  return 'ANY';
}

// ─── Tipos crudos de la API ───────────────────────────────────────────────────────────

interface SlotCard {
  id: string;
  title: string;
  short_description?: string;
  slug?: string;
  search_tags?: string;
  where?: string;
  start_date?: string;
  stop_date?: string;
  days_of_week?: string;
  trigger_type?: string;
  promotion_type?: string;
  payment_flow?: string;
  debit_list?: string[];
  credit_list?: string[];
  categories_whitelist?: { categories?: Array<{ map_category?: number }> };
  extra_params?: { promo_id?: string };
  content?: { row?: Array<{ text?: string | null }> };
}

// content.row[4].text trae el tope de la card al abrirla: un monto numérico, el texto
// literal "Sin tope", o null/basura (ej. ".") — confirmado sobre 2356 cards reales,
// siempre presente cuando hay tope configurado. row[5] es la etiqueta de segmento/banco
// (ej. "Macro Selecta"), no tiene relación con el tope.
function parseCap(row: Array<{ text?: string | null }> | undefined): { cap: number | null; capUnlimited: boolean } | null {
  const raw = row?.[4]?.text?.trim();
  if (!raw) return null;
  if (/sin tope/i.test(raw)) return { cap: null, capUnlimited: true };
  const num = raw.replace(/[.,]/g, '');
  if (!/^\d+$/.test(num)) return null;
  const value = parseInt(num, 10);
  if (value === 0) return { cap: null, capUnlimited: true };
  return { cap: value, capUnlimited: false };
}

interface SlotsResponse {
  data?: { cards?: SlotCard[] };
  metadata?: { pagination?: { page?: number; total_pages?: number; total_results?: number } };
}

async function fetchPage(page: number): Promise<SlotsResponse | null> {
  const url = `${SLOTS_API}?slots=web-banco-hub-promos_corriendo&source=web_bank&banks=${BANK_UUID}&origin=web_bank&slot_info=false&limit=${PAGE_LIMIT}&fcalcstatus=running&page=${page}`;
  try {
    const res = await fetch(url, { headers: COMMON_HEADERS });
    if (!res.ok) {
      console.log(`[Macro] ⚠️ Página ${page}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (e: any) {
    console.log(`[Macro] ⚠️ Página ${page}: ${e.message}`);
    return null;
  }
}

// Cache por comercio dentro de la misma corrida: Macro repite el mismo comercio en
// decenas de promos (ej. YPF, ANDES con 7-9 variantes de tope/nivel) — pedir sucursales
// una sola vez por storeName en vez de una vez por promo evita cientos de fetches
// redundantes al mismo resultado.
const branchesCache = new Map<string, Promise<ScrapedPromo['branches']>>();

async function fetchBranchesRaw(promoId: string): Promise<ScrapedPromo['branches']> {
  try {
    const url = `${STORES_API}?zone=${ARGENTINA_ZONE}&application_id=${promoId}&banks=${BANK_UUID}&applications=promotions&source=web_bank`;
    const res = await fetch(url, { headers: COMMON_HEADERS });
    if (!res.ok) return undefined;
    const json: any = await res.json();
    const stores: any[] = json?.stores ?? [];
    if (stores.length === 0) return undefined;
    return stores
      .filter(s => typeof s.latitude === 'number' && typeof s.longitude === 'number' && s.address)
      .map(s => ({
        address: String(s.address),
        city: s.district || s.state || undefined,
        lat: s.latitude,
        lng: s.longitude,
      }));
  } catch {
    return undefined;
  }
}

async function fetchBranches(promoId: string, storeName: string): Promise<ScrapedPromo['branches']> {
  const cacheKey = storeName.trim().toLowerCase();
  let pending = branchesCache.get(cacheKey);
  if (!pending) {
    pending = fetchBranchesRaw(promoId);
    branchesCache.set(cacheKey, pending);
  }
  return pending;
}

export const MacroScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[Macro] ════════════════════════════════════════════');
    console.log('[Macro] API JSON directa (rewards-handler.playdigital.com.ar)');
    console.log('[Macro] ════════════════════════════════════════════');

    const cardsById = new Map<string, SlotCard>();

    let page = 1;
    let totalPages = 1;
    do {
      const resp = await fetchPage(page);
      if (!resp) break;

      const cards = resp.data?.cards ?? [];
      for (const card of cards) {
        const promoId = card.extra_params?.promo_id ?? card.id;
        if (!promoId) continue;
        cardsById.set(promoId, card);
      }

      totalPages = resp.metadata?.pagination?.total_pages ?? page;
      console.log(`[Macro] Página ${page}/${totalPages}: ${cards.length} cards (acumulado único: ${cardsById.size})`);
      page++;
    } while (page <= totalPages);

    console.log(`[Macro] Catálogo completo — ${cardsById.size} promos únicas. Procesando...`);

    const allPromos: ScrapedPromo[] = [];
    let i = 0;
    for (const [promoId, card] of cardsById) {
      i++;
      const discountParsed = parseDiscount(card.title || '', card.trigger_type || '', card.short_description || undefined);
      if (!discountParsed) {
        continue;
      }

      const mapCategories = (card.categories_whitelist?.categories ?? [])
        .map((c: { map_category?: number }) => c.map_category)
        .filter((n: number | undefined): n is number => typeof n === 'number');
      const categoria = mapCategoria(mapCategories);

      const cardNetworks = buildCardNetworks(card.debit_list ?? [], card.credit_list ?? []);
      const paymentChannel = parsePaymentChannel(card.payment_flow || '');
      const validDays = parseValidDays(card.days_of_week || '');

      const storeName = extractStoreName(card.title || '');
      const sourceUrl = card.slug ? `https://www.macro.com.ar/beneficios/beneficio?id=${promoId}` : undefined;
      const description = [card.title, card.where].filter(Boolean).join(' | ');
      const capInfo = parseCap(card.content?.row);

      const promo: ScrapedPromo = {
        title: card.title.trim(),
        description,
        sourceText: [card.where, card.search_tags].filter(Boolean).join('\n\n').slice(0, 8000),
        sourceUrl,
        source: BRANCH_SOURCE,
        externalId: promoId,
        discount: discountParsed.discount,
        discountType: discountParsed.discountType,
        validFrom: card.start_date || undefined,
        validUntil: card.stop_date || undefined,
        validDays,
        bankNames: [BANK_NAME],
        cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
        categoria,
        storeName,
        paymentChannel,
        cap: capInfo?.cap ?? undefined,
        capUnlimited: capInfo?.capUnlimited,
      };

      const branches = await fetchBranches(promoId, storeName);
      if (branches && branches.length > 0) {
        promo.branches = branches;
      }

      allPromos.push(promo);
      if (i % 100 === 0 || i === cardsById.size) {
        console.log(`[Macro] Procesadas: ${i}/${cardsById.size}`);
      }
    }

    console.log(`[Macro] Total: ${allPromos.length} promos`);
    return allPromos;
  },
};

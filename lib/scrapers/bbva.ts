// BBVA Argentina Scraper — API pública
// GET /willgo/fgo/API/v3/communications?rubros={id}&pager={n}
// No requiere autenticación ni Playwright

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { detectCategoria, decodeHtmlEntities } from './bank-helpers';

const API_BASE  = 'https://go.bbva.com.ar/willgo/fgo/API/v3';
const PAGE_URL  = 'https://www.bbva.com.ar/beneficios';
const BANK_NAME = 'BBVA';

const RUBRO_MAP: Record<number, string> = {
  13:  'Viajes y Turismo',
  3:   'Gastronomía',
  4:   'Entretenimiento',
  170: 'Indumentaria',
  173: 'Hogar',
  192: 'Tecnología',
  184: 'Deportes',
  8:   'Salud y Belleza',
  175: 'Jugueterías',
  195: 'Otros',
  27:  'Shoppings',
  174: 'Automotores',
};

function parseDias(diasPromo: string | null): number {
  if (!diasPromo) return 127;
  const parts = diasPromo.split(',');
  let mask = 0;
  for (let i = 0; i < parts.length && i < 7; i++) {
    if (parts[i].trim() === '1') mask |= 1 << i;
  }
  return mask > 0 ? mask : 127;
}

function extractStoreName(cabecera: string): string {
  const norm = cabecera.trim();
  const enMatch = norm.match(/\ben\s+(.+?)(?:\s*\.|$)/i);
  if (enMatch && /^\d+/.test(norm)) return enMatch[1].trim();
  const cleaned = norm
    .replace(/\s+\d+%.*$/i, '')
    .replace(/\s+\d+\s+cuotas?.*$/i, '')
    .replace(/\s+hasta\s+\d+.*$/i, '')
    .trim();
  return cleaned || norm;
}

function extractDiscount(text: string): { value: number; type: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:reintegro|descuento|ahorro|off)/i);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (v > 0 && v <= 100) {
      const type = /reintegro|ahorro/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
      return { value: v, type };
    }
  }
  return null;
}

function extractInstallments(text: string): number | null {
  const m = text.match(/(\d+)\s+cuotas?\s+sin\s+inter[eé]s/i)
    ?? text.match(/hasta\s+(\d+)\s+cuotas?/i);
  return m ? parseInt(m[1]) : null;
}

type CommunicationDetail = {
  requisitos?: string[];
  basesCondiciones?: string;
  branches?: Array<{ address: string; city?: string; lat: number; lng: number }>;
};

function parseItem(item: any, rubroId: number, detail?: CommunicationDetail): ScrapedPromo[] {
  const cabecera = decodeHtmlEntities(item.cabecera ?? '');
  const subcabecera = decodeHtmlEntities(item.subcabecera ?? '');
  const storeName = extractStoreName(cabecera);
  if (!storeName || storeName.length < 2) return [];

  const fullText     = `${cabecera} ${subcabecera}`;
  const discount     = extractDiscount(fullText);
  const installments = extractInstallments(fullText);
  if (!discount && !installments) return [];

  const validDays  = parseDias(item.diasPromo);
  const validFrom  = item.fechaDesde ?? undefined;
  const validUntil = item.fechaHasta ?? undefined;
  const cap        = item.montoTope ? parseFloat(String(item.montoTope).replace(/\./g, '')) : null;

  const categoria = RUBRO_MAP[rubroId] ?? detectCategoria(fullText);

  const isDebit  = /débito|debito/i.test(item.grupoTarjeta ?? '');
  const isCredit = /crédito|credito/i.test(item.grupoTarjeta ?? '');
  const cardType: 'CREDIT' | 'DEBIT' | null = isCredit && !isDebit ? 'CREDIT' : isDebit && !isCredit ? 'DEBIT' : null;
  const cardNetworks: CardNetworkWithType[] = [
    { network: 'VISA',                   type: cardType },
    { network: 'Mastercard',             type: cardType },
    { network: 'American Express Banco', type: cardType },
  ];

  const requisitosText = decodeHtmlEntities((detail?.requisitos ?? []).join(' '));
  const basesCondiciones = decodeHtmlEntities(detail?.basesCondiciones ?? '').replace(/<[^>]+>/g, ' ').trim();

  const allText = `${fullText} ${item.descripcion ?? ''} ${requisitosText} ${basesCondiciones}`.toUpperCase();
  const paymentChannel: ScrapedPromo['paymentChannel'] =
    /\bQR\b|CODIGO\s+QR/.test(allText)        ? 'QR'  :
    /\bNFC\b|CONTACTLESS|SIN\s+CONTACTO/.test(allText) ? 'NFC' :
    /\bMODO\b/.test(allText)                   ? 'QR'  : 'ANY';
  const walletNames = /\bMODO\b/.test(allText) ? ['MODO'] : undefined;

  const description = fullText.slice(0, 500);
  const legalText = basesCondiciones || [item.descripcion, item.legales, item.leyendaLegal, item.textoLegal, item.terminosCondiciones].filter(Boolean).join(' ').replace(/<[^>]+>/g, ' ').trim();
  const base: Partial<ScrapedPromo> = {
    storeName, description, sourceText: legalText || description, sourceUrl: PAGE_URL,
    validFrom, validUntil, validDays, cap,
    bankNames: [BANK_NAME], cardNetworks, categoria,
    paymentChannel, walletNames,
    storeLogoUrl: item.imagen || undefined,
    branches: detail?.branches,
  };

  const promos: ScrapedPromo[] = [];
  if (discount) {
    promos.push({
      ...base,
      title: `${discount.value}% ${discount.type.includes('REINTEGRO') ? 'reintegro' : 'descuento'} – ${storeName}`,
      discount: String(discount.value),
      discountType: discount.type,
    } as ScrapedPromo);
  }
  if (installments) {
    promos.push({
      ...base,
      title: `${installments} cuotas sin interés – ${storeName}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }
  return promos;
}

async function apiFetch(url: string): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': PAGE_URL,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const BBVAScraper: Scraper = {
  name: BANK_NAME,

  async run(): Promise<ScrapedPromo[]> {
    console.log('[BBVA] Iniciando scraper (API pública, sin browser)...');
    const allPromos: ScrapedPromo[] = [];
    const seenIds  = new Set<string>();
    const pendingItems: { item: any; rubroId: number }[] = [];

    // 1. Obtener rubros
    const rubrosData = await apiFetch(`${API_BASE}/rubros/filtro?filtro_padre=true`);
    if (!rubrosData?.rubros) {
      console.log('[BBVA] No se pudo obtener rubros');
      return [];
    }

    const rubros: any[] = rubrosData.rubros;
    console.log(`[BBVA] ${rubros.length} rubros encontrados`);

    // 2. Por cada rubro, paginar con los parámetros correctos: rubros= y pager=
    for (const rubro of rubros) {
      const { idRubro, nombre } = rubro;
      let pager = 1;
      let rubroCount = 0;

      while (true) {
        await delay(300);
        const data = await apiFetch(`${API_BASE}/communications?rubros=${idRubro}&pager=${pager}`);
        if (!data?.data || !Array.isArray(data.data) || data.data.length === 0) break;

        for (const item of data.data) {
          if (!item.id || seenIds.has(String(item.id))) continue;
          seenIds.add(String(item.id));

          // Pre-filtro: solo nos interesan items con descuento o cuotas detectables
          const fullText = `${decodeHtmlEntities(item.cabecera ?? '')} ${decodeHtmlEntities(item.subcabecera ?? '')}`;
          if (!extractDiscount(fullText) && !extractInstallments(fullText)) continue;

          pendingItems.push({ item, rubroId: idRubro });
          rubroCount++;
        }

        const totalPages = parseInt(String(data.message ?? '').match(/paginas:\s*(\d+)/i)?.[1] ?? '1');
        if (pager >= totalPages || data.data.length < 20) break;
        pager++;
      }

      console.log(`[BBVA] ${nombre} (${idRubro}): ${rubroCount} comunicaciones con descuento/cuotas`);
    }

    // 3. Fetch del detalle de cada comunicación (requisitos completos + bases y condiciones + sucursales)
    console.log(`[BBVA] Obteniendo detalle de ${pendingItems.length} comunicaciones...`);
    const BATCH = 5;
    for (let i = 0; i < pendingItems.length; i += BATCH) {
      const batch = pendingItems.slice(i, i + BATCH);
      await Promise.all(batch.map(async ({ item, rubroId }) => {
        let detail: CommunicationDetail | undefined;
        const detailRes = await apiFetch(`${API_BASE}/communication/${item.id}`);
        const d = detailRes?.data;
        if (d) {
          const requisitos = (d.beneficios ?? []).flatMap((b: any) => b.requisitos ?? []);
          const branches = (d.canalesVenta?.sucursales ?? [])
            .map((s: any) => ({
              address: decodeHtmlEntities(s.direccion ?? ''),
              city: decodeHtmlEntities(s.localidad ?? ''),
              lat: parseFloat(s.latitude),
              lng: parseFloat(s.longitude),
            }))
            .filter((b: any) => b.address && Number.isFinite(b.lat) && Number.isFinite(b.lng));
          detail = { requisitos, basesCondiciones: d.basesCondiciones, branches };
        }
        allPromos.push(...parseItem(item, rubroId, detail));
      }));
      await delay(200);
      if ((i + BATCH) % 100 === 0 || i + BATCH >= pendingItems.length) {
        console.log(`[BBVA] Detalle procesado: ${Math.min(i + BATCH, pendingItems.length)}/${pendingItems.length} → ${allPromos.length} promos`);
      }
    }

    const seen = new Set<string>();
    const unique = allPromos.filter(p => {
      const key = `${p.storeName}|${p.discount}|${p.discountType}|${p.validDays}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[BBVAScraper] Total: ${unique.length} promos únicas`);
    return unique;
  },
};

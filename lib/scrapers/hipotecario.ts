// Banco Hipotecario — WordPress con páginas de alianza server-renderizadas
// (https://www.hipotecario.com.ar/beneficios/ lista ~26 links a
// /alianzas-bh/{slug}/, cada una con un bloque .content__beneficios--(descuento|cuotas|mixto)
// que trae día(s), % y/o cuotas, condiciones (li) y bases y condiciones con fechas de vigencia).
// Sin WAF, fetch directo.

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { extractCap, extractValidDays, detectCategoria, decodeHtmlEntities, dedup } from './bank-helpers';

const BANK_NAME = 'Banco Hipotecario';
const LISTING_URL = 'https://www.hipotecario.com.ar/beneficios/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CATEGORIA_MAP: Record<string, string> = {
  'Supermercados': 'Supermercados',
  'Farmacias y Perfumerías': 'Farmacias',
  'Hogar': 'Hogar',
  'Otros': 'Otros',
  'Combustible': 'Combustible',
  'Corralones y Materiales': 'Hogar',
  'Muebles': 'Hogar',
  'Electro y Tecnología': 'Tecnología',
  'Colchonerías': 'Hogar',
  'Promociones sin Contacto': 'Otros',
};

function mapCategoria(raw: string, fallbackText: string): string {
  if (CATEGORIA_MAP[raw]) return CATEGORIA_MAP[raw];
  return detectCategoria(fallbackText) || 'Otros';
}

function stripTags(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractDiscount(text: string): { value: number; type: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:off|de\s+descuento)?/i);
  if (m) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (v > 0 && v <= 100) return { value: v, type: 'PERCENTAGE_DESCUENTO' };
  }
  return null;
}

function extractInstallments(text: string): number | null {
  const m = text.match(/(\d+)\s*cuotas?\s*sin\s*inter[eé]s/i);
  return m ? parseInt(m[1]) : null;
}

function extractCardNetworks(text: string): CardNetworkWithType[] {
  const t = text.toUpperCase();
  const isCredit = /CR[EÉ]DITO/.test(t);
  const isDebit = /D[EÉ]BITO/.test(t);
  const type: 'CREDIT' | 'DEBIT' | null = isCredit && !isDebit ? 'CREDIT' : isDebit && !isCredit ? 'DEBIT' : null;

  const nets: CardNetworkWithType[] = [];
  if (/VISA/.test(t)) nets.push({ network: 'Visa', type });
  if (/MASTERCARD|MASTER\b/.test(t)) nets.push({ network: 'Mastercard', type });
  if (/\bMODO\b/.test(t)) nets.push({ network: 'MODO', type: null });
  return nets;
}

// Fechas de bases y condiciones tipo "DESDE EL 01/07/2026 HASTA EL 9/7/2026"
function extractDatesFromLegal(text: string): { validFrom?: string; validUntil?: string } {
  const m = text.match(/DESDE\s+EL\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\s+HASTA\s+EL\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (!m) return {};
  const pad = (n: string) => n.padStart(2, '0');
  return {
    validFrom: `${m[3]}-${pad(m[2])}-${pad(m[1])}`,
    validUntil: `${m[6]}-${pad(m[5])}-${pad(m[4])}`,
  };
}

function parseDiasText(diasText: string): number {
  return extractValidDays(diasText) || 127;
}

interface AllianceBlock {
  storeName: string;
  categoria: string;
  diasText: string;
  infoText: string;
  listaText: string;
  legalText: string;
}

function parseAlliancePage(html: string, url: string): AllianceBlock | null {
  const titleM = html.match(/<h3>([^<]*)<\/h3>\s*<p>([^<]*)<\/p>/);
  if (!titleM) return null;
  const storeName = decodeHtmlEntities(titleM[1]).replace(/^[\s–-]+/, '').trim();
  const rawCategoria = decodeHtmlEntities(titleM[2]).trim();

  const blockStart = html.search(/content__beneficios--(descuento|cuotas|mixto)"/);
  if (blockStart === -1) return null;
  const block = html.slice(blockStart, blockStart + 2500);

  const diasM = block.match(/--dias"[^>]*>\s*<span[^>]*>([^<]*)</);
  const infoBlockM = block.match(/(?:info--porcentaje">|class="cuotas">)\s*<h3[^>]*>([\s\S]{0,600}?)<\/h3>/);
  const listaM = block.match(/info--lista">([\s\S]{0,1500}?)<\/div>/);

  const legalM = html.match(/byc__container--content">([\s\S]{0,4000}?)<\/div>\s*<\/div>\s*<script/);

  return {
    storeName,
    categoria: rawCategoria,
    diasText: (diasM?.[1] || '').trim(),
    infoText: stripTags(infoBlockM?.[1] || ''),
    listaText: stripTags(listaM?.[1] || ''),
    legalText: stripTags(legalM?.[1] || ''),
  };
}

function blockToPromos(b: AllianceBlock, sourceUrl: string): ScrapedPromo[] {
  if (!b.storeName) return [];

  const fullText = `${b.infoText} ${b.listaText}`;
  const discount = extractDiscount(fullText);
  const installments = extractInstallments(fullText);
  if (!discount && !installments) return [];

  const validDays = parseDiasText(b.diasText);
  const cardNetworks = extractCardNetworks(`${b.listaText} ${b.legalText}`);
  const cap = extractCap(b.listaText) ?? extractCap(b.legalText);
  const categoria = mapCategoria(b.categoria, `${b.storeName} ${fullText}`);
  const { validFrom, validUntil } = extractDatesFromLegal(b.legalText);

  const base: Partial<ScrapedPromo> = {
    description: fullText.slice(0, 500),
    sourceText: (b.legalText || fullText).slice(0, 500),
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
    storeName: b.storeName,
  };

  const promos: ScrapedPromo[] = [];
  if (discount) {
    promos.push({
      ...base,
      title: `${discount.value}% descuento – ${b.storeName}`,
      discount: String(discount.value),
      discountType: discount.type,
    } as ScrapedPromo);
  }
  if (installments) {
    promos.push({
      ...base,
      title: `${installments} cuotas sin interés – ${b.storeName}`,
      discount: String(installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }
  return promos;
}

async function fetchAllianceLinks(): Promise<string[]> {
  const res = await fetch(LISTING_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const html = await res.text();
  const links = Array.from(new Set(
    Array.from(html.matchAll(/href="(https:\/\/www\.hipotecario\.com\.ar\/alianzas-bh\/[^"]+)"/g)).map(m => m[1])
  ));
  return links;
}

export const HipotecarioScraper: Scraper = {
  name: 'Hipotecario',
  async run(): Promise<ScrapedPromo[]> {
    const all: ScrapedPromo[] = [];
    const links = await fetchAllianceLinks();

    for (const link of links) {
      try {
        const res = await fetch(link, { headers: { 'User-Agent': UA } });
        if (!res.ok) continue;
        const html = await res.text();
        const block = parseAlliancePage(html, link);
        if (block) all.push(...blockToPromos(block, link));
      } catch (e) {
        console.error(`[Hipotecario] Error scraping ${link}:`, e);
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return dedup(all);
  },
};

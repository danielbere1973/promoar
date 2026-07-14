// Grupo Petersen — 4 bancos provinciales en la misma plataforma (Next.js + Contentful)
// Banco San Juan, Nuevo Banco de Santa Fe, Banco de Entre Ríos, Banco Santa Cruz.
// Cada beneficio viene embebido en el RSC payload de la página /personas/beneficios
// (self.__next_f.push([1,"..."])). Se pagina con ?skip=N sobre la misma URL, pidiendo
// el stream RSC crudo con el header "RSC: 1" (sin necesidad de Playwright).

import { Scraper, ScrapedPromo, CardNetworkWithType } from './types';
import { extractCap, detectCategoria, dedup } from './bank-helpers';

const PAGE_SIZE = 12;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface PetersenBankConfig {
  bankName: string;
  domain: string;
}

const BANKS: PetersenBankConfig[] = [
  { bankName: 'Banco San Juan',   domain: 'www.bancosanjuan.com' },
  { bankName: 'Nuevo Banco de Santa Fe', domain: 'www.bancosantafe.com.ar' },
  { bankName: 'Banco de Entre Ríos', domain: 'www.bancoentrerios.com.ar' },
  { bankName: 'Banco Santa Cruz', domain: 'www.bancosantacruz.com' },
];

interface RawBenefit {
  id: string;
  name: string;
  description: string;
  discount?: number;
  installments?: number;
  repaymentCap?: number;
  dateFrom?: string;
  dateTo?: string;
  benefitDay?: string[];
  paymentMethod?: string[];
  storeName: string;
  storeCategories: string[];
}

const DAY_MAP: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
};

function daysToMask(days: string[] | undefined): number {
  if (!days || days.length === 0) return 127;
  let mask = 0;
  for (const d of days) {
    const bit = DAY_MAP[d.toLowerCase()];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return mask || 127;
}

function paymentMethodsToNetworks(methods: string[] | undefined): CardNetworkWithType[] {
  if (!methods) return [];
  const nets: CardNetworkWithType[] = [];
  for (const m of methods) {
    const isCredit = /cr[eé]dito/i.test(m);
    const isDebit = /d[eé]bito/i.test(m);
    const type: 'CREDIT' | 'DEBIT' | null = isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : null;
    if (/visa/i.test(m)) nets.push({ network: 'Visa', type });
    else if (/master/i.test(m)) nets.push({ network: 'Mastercard', type });
    else if (/\bqr\b/i.test(m)) nets.push({ network: 'MODO', type: null });
  }
  return nets;
}

function toISODate(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

// Extrae los objetos "benefits":[...] del stream RSC pidiendo el JSON directamente
// desde el campo storeBenefit.fields.store.fields (name + categories), sin resolver
// referencias $L de React — solo lectura de los leafs necesarios vía regex.
function parseBenefitsFromRSC(rscText: string): RawBenefit[] {
  const benefits: RawBenefit[] = [];

  // Cada beneficio empieza con {"id":"...","name":"BSJ..." o similar y contiene sus propios
  // campos hasta el storeBenefit anidado. El campo "title" es opcional (a veces ausente,
  // a veces presente y vacío) — no se puede asumir un orden de campos fijo tipo Contentful.
  const idRe = /\{"id":"([a-zA-Z0-9]+)","name":"((?:[^"\\]|\\.)*)"(?:,"title":"(?:[^"\\]|\\.)*")?,"description":"((?:[^"\\]|\\.)*)"/g;

  let match: RegExpExecArray | null;
  const starts: { idx: number; id: string; name: string; description: string }[] = [];
  while ((match = idRe.exec(rscText))) {
    starts.push({ idx: match.index, id: match[1], name: match[2], description: match[3] });
  }

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].idx;
    const end = i + 1 < starts.length ? starts[i + 1].idx : rscText.length;
    const block = rscText.slice(start, Math.min(end, start + 6000));

    const discountM = block.match(/"discount":(\d+(?:\.\d+)?)/);
    const installmentsM = block.match(/"installments":(\d+)/);
    const repaymentCapM = block.match(/"repaymentCap":(\d+(?:\.\d+)?)/);
    const dateFromM = block.match(/"dateFrom":"([^"\\]+)"/);
    const dateToM = block.match(/"dateTo":"([^"\\]+)"/);
    const benefitDayM = block.match(/"benefitDay":\[([^\]]*)\]/);
    const paymentMethodM = block.match(/"paymentMethod":\[([^\]]*)\]/);
    const storeNameM = block.match(/"store":\{[\s\S]{0,600}?"fields":\{"name":"((?:[^"\\]|\\.)*)"/);
    const categoriesM = block.match(/"categories":\[([^\]]*)\]/);

    const parseArr = (s: string | undefined) =>
      s ? s.split(',').map(x => x.replace(/"/g, '').trim()).filter(Boolean) : [];

    if (!starts[i].name && !starts[i].description) continue;

    benefits.push({
      id: starts[i].id,
      name: starts[i].name,
      description: starts[i].description.replace(/\\n/g, ' ').replace(/\\"/g, '"'),
      discount: discountM ? parseFloat(discountM[1]) : undefined,
      installments: installmentsM ? parseInt(installmentsM[1]) : undefined,
      repaymentCap: repaymentCapM ? parseFloat(repaymentCapM[1]) : undefined,
      dateFrom: dateFromM?.[1],
      dateTo: dateToM?.[1],
      benefitDay: parseArr(benefitDayM?.[1]),
      paymentMethod: parseArr(paymentMethodM?.[1]),
      storeName: (storeNameM?.[1] || '').replace(/\\"/g, '"').trim(),
      storeCategories: parseArr(categoriesM?.[1]),
    });
  }

  return benefits;
}

async function fetchPage(domain: string, skip: number): Promise<{ rscText: string; total: number } | null> {
  const url = `https://${domain}/personas/beneficios?skip=${skip}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'RSC': '1' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const totalM = text.match(/"total":(\d+)/);
    const total = totalM ? parseInt(totalM[1]) : 0;
    return { rscText: text, total };
  } catch {
    return null;
  }
}

function benefitToPromos(b: RawBenefit, bankName: string, sourceUrl: string): ScrapedPromo[] {
  if (!b.storeName) return [];

  const validDays = daysToMask(b.benefitDay);
  const validFrom = toISODate(b.dateFrom);
  const validUntil = toISODate(b.dateTo);
  const cardNetworks = paymentMethodsToNetworks(b.paymentMethod);
  const cap = b.repaymentCap ?? extractCap(b.description) ?? null;
  const categoria = b.storeCategories[0] ? mapCategoria(b.storeCategories[0]) : detectCategoria(`${b.storeName} ${b.description}`);

  const base: Partial<ScrapedPromo> = {
    storeName: b.storeName,
    description: b.description.slice(0, 500),
    sourceText: b.description.slice(0, 500),
    sourceUrl,
    validFrom,
    validUntil,
    validDays,
    cap,
    capPeriod: cap ? 'MONTHLY' : null,
    bankNames: [bankName],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    paymentChannel: 'ANY',
    categoria,
  };

  const promos: ScrapedPromo[] = [];

  if (b.discount && b.discount > 0) {
    promos.push({
      ...base,
      title: `${b.discount}% descuento – ${b.storeName}`,
      discount: String(b.discount),
      discountType: 'PERCENTAGE_DESCUENTO',
    } as ScrapedPromo);
  }
  if (b.installments && b.installments > 0) {
    promos.push({
      ...base,
      title: `${b.installments} cuotas sin interés – ${b.storeName}`,
      discount: String(b.installments),
      discountType: 'CUOTAS_SIN_INTERES',
    } as ScrapedPromo);
  }

  return promos;
}

const CATEGORIA_MAP: Record<string, string> = {
  'Otros': 'Otros',
  'Delivery': 'Gastronomía',
  'Moda': 'Indumentaria',
  'Combustible': 'Combustible',
  'Educación': 'Otros',
  'Electro y Hogar': 'Tecnología',
  'Entretenimiento': 'Entretenimiento',
  'Gastronomía': 'Gastronomía',
  'Turismo': 'Viajes y Turismo',
  'Supermercados y almacenes': 'Supermercados',
  'Construcción': 'Hogar',
  'Salud y Belleza': 'Salud y Belleza',
  'Juguetes y Libros': 'Jugueterías',
  'Autos': 'Automotores',
  'Mascotas': 'Petshops',
  'Joyas y Relojes': 'Otros',
};

function mapCategoria(raw: string): string {
  return CATEGORIA_MAP[raw] ?? '';
}

async function scrapeBank(config: PetersenBankConfig): Promise<ScrapedPromo[]> {
  const sourceUrl = `https://${config.domain}/personas/beneficios`;
  const promos: ScrapedPromo[] = [];
  const seenIds = new Set<string>();

  let skip = 0;
  let total = Infinity;
  let safety = 0;

  while (skip < total && safety < 60) {
    const page = await fetchPage(config.domain, skip);
    safety++;
    if (!page) break;
    total = page.total || 0;
    const benefits = parseBenefitsFromRSC(page.rscText);
    if (benefits.length === 0) break;

    for (const b of benefits) {
      if (seenIds.has(b.id)) continue;
      seenIds.add(b.id);
      promos.push(...benefitToPromos(b, config.bankName, sourceUrl));
    }

    skip += PAGE_SIZE;
    await new Promise(r => setTimeout(r, 200));
  }

  return promos;
}

export const PetersenScraper: Scraper = {
  name: 'Petersen',
  async run(): Promise<ScrapedPromo[]> {
    const all: ScrapedPromo[] = [];
    for (const bank of BANKS) {
      try {
        const bankPromos = await scrapeBank(bank);
        all.push(...bankPromos);
      } catch (e) {
        console.error(`[Petersen] Error scraping ${bank.bankName}:`, e);
      }
    }
    return dedup(all);
  },
};

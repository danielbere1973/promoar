// Helpers compartidos para scrapers de bancos argentinos

import { ScrapedPromo, CardNetworkWithType } from './types';

export const DAY_TO_BIT: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2,
  'miércoles': 3, 'miercoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
};

export const MONTHS: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
  'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12,
};

export function normStr(s: string): string {
  return s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function extractValidDays(text: string): number {
  const t = normStr(text);
  if (/TODOS\s+LOS\s+D[IÍ]AS|DIARIO|PERMANENTE/.test(t)) return 127;

  const DAY_NAMES = ['DOMINGO','LUNES','MARTES','MI[EÉ]RCOLES','JUEVES','VIERNES','S[AÁ]BADO'];
  const DAY_NORMS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];

  const rangeRE = new RegExp(`(${DAY_NAMES.join('|')})\\s+(?:A|AL?)\\s+(${DAY_NAMES.join('|')})`);
  const rangeMatch = t.match(rangeRE);
  if (rangeMatch) {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const a = DAY_TO_BIT[norm(rangeMatch[1])];
    const b = DAY_TO_BIT[norm(rangeMatch[2])];
    let mask = 0;
    if (a !== undefined && b !== undefined) {
      if (a <= b) for (let i = a; i <= b; i++) mask |= 1 << i;
      else { for (let i = a; i <= 6; i++) mask |= 1 << i; for (let i = 0; i <= b; i++) mask |= 1 << i; }
    }
    if (mask > 0) return mask;
  }

  let mask = 0;
  for (let i = 0; i < DAY_NAMES.length; i++) {
    if (new RegExp(`\\b${DAY_NAMES[i]}\\b`).test(t)) mask |= 1 << DAY_TO_BIT[DAY_NORMS[i]];
  }
  return mask > 0 ? mask : 127;
}

export function extractDates(text: string): { validFrom?: string; validUntil?: string } {
  const norm = normStr(text);
  const y = new Date().getFullYear();

  const parseNum = (s: string) => {
    const [dd, mm, yy = String(y)] = s.split('/');
    return `${yy.length === 2 ? '20' + yy : yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  };

  const numRange = norm.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?:AL|HASTA)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (numRange) return { validFrom: parseNum(numRange[1]), validUntil: parseNum(numRange[2]) };

  const wordRange = norm.match(/DEL?\s+(\d{1,2})\s+AL\s+(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (wordRange) {
    const month = MONTHS[wordRange[3].toLowerCase()];
    const yr = wordRange[4] ? parseInt(wordRange[4]) : y;
    if (month) return {
      validFrom:  `${yr}-${String(month).padStart(2,'0')}-${wordRange[1].padStart(2,'0')}`,
      validUntil: `${yr}-${String(month).padStart(2,'0')}-${wordRange[2].padStart(2,'0')}`,
    };
  }

  const untilMatch = norm.match(/HASTA\s+(?:EL\s+)?(\d{1,2})\s+DE\s+([A-Z]+)(?:\s+(?:DE\s+)?(\d{4}))?/);
  if (untilMatch) {
    const month = MONTHS[untilMatch[2].toLowerCase()];
    const yr = untilMatch[3] ? parseInt(untilMatch[3]) : y;
    if (month) return { validUntil: `${yr}-${String(month).padStart(2,'0')}-${untilMatch[1].padStart(2,'0')}` };
  }

  return {};
}

export function extractDiscount(text: string): { value: number; type: string } | null {
  const patterns = [
    /(?:hasta\s+)?(\d+(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:ahorro|descuento|reintegro|reembolso|bonificaci[oó]n)/i,
    /(\d+(?:[.,]\d+)?)\s*%\s*off/i,
    /(\d+(?:[.,]\d+)?)\s*%/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0 && v <= 100) {
        const type = /reintegro|reembolso/i.test(m[0]) ? 'PERCENTAGE_REINTEGRO' : 'PERCENTAGE_DESCUENTO';
        return { value: v, type };
      }
    }
  }
  return null;
}

export function extractInstallments(text: string): number | null {
  const m = text.match(/(?:hasta\s+)?(\d+)\s+cuotas?\s+(?:sin|cero)\s+inter[eé]s/i);
  return m ? parseInt(m[1]) : null;
}

export function extractCap(text: string): number | null {
  const m = text.match(/tope[:\s]+\$?\s*([\d.,]+)/i)
    ?? text.match(/m[aá]ximo[:\s]+\$?\s*([\d.,]+)/i);
  if (m) return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return null;
}

export function extractCardNetworks(text: string): CardNetworkWithType[] {
  const t = normStr(text);
  const isCredit = /CREDITO/.test(t);
  const isDebit  = /DEBITO/.test(t);
  const cardType: 'CREDIT' | 'DEBIT' | null = isCredit && !isDebit ? 'CREDIT' : isDebit && !isCredit ? 'DEBIT' : null;

  const networks: CardNetworkWithType[] = [];
  if (/VISA/.test(t)) networks.push({ network: 'Visa', type: cardType });
  if (/MASTER/.test(t)) networks.push({ network: 'Mastercard', type: cardType });
  if (/AMEX|AMERICAN/.test(t)) networks.push({ network: 'American Express Banco', type: cardType });
  if (/NARANJA/.test(t)) networks.push({ network: 'Naranja', type: cardType });
  if (/CABAL/.test(t)) networks.push({ network: 'Cabal', type: cardType });
  if (/MAESTRO/.test(t)) networks.push({ network: 'Maestro', type: 'DEBIT' });
  if (/\bMODO\b/.test(t)) networks.push({ network: 'MODO', type: null });
  return networks;
}

export function extractWallets(text: string): string[] {
  const t = normStr(text);
  const wallets: string[] = [];
  if (/\bMODO\b/.test(t)) wallets.push('MODO');
  if (/MERCADO\s*PAGO/.test(t)) wallets.push('MercadoPago');
  if (/CUENTA\s*DNI/.test(t)) wallets.push('CuentaDNI');
  if (/BUEPP|GUEPP|GÜEPP/.test(t)) wallets.push('BUEPP');
  if (/APP\s*CIUDAD|APP\s*BANCO\s*CIUDAD/.test(t)) wallets.push('MODO'); // App Ciudad usa MODO
  return wallets;
}

export function detectCategoria(text: string): string {
  const t = normStr(text);
  if (/JUMBO|CARREFOUR|DISCO|COTO|VEA|WALMART|CHANGO|DIARCO|SUPERMERCADO|ANONIMA|YAGUAR|MAXI|LA\s+GALLEGA|HIPERMAXI|CHANGOMAS|BELL'S|BELLS|COOPERATIVA|SUPER\s+VEA|LIDER|EKONO|SUPERCOOP|FOOD\s+MARKET|FERIAS\s+DE\s+LA\s+CIUDAD|\bRES\b/.test(t)) return 'Supermercados';
  if (/FARMACIA|FARMA|FARMACITY|DROGUERIA|PERFUMER|BOTICA|VANTAGE|SALCOBRAND/.test(t)) return 'Farmacias';
  if (/\bYPF\b|\bSHELL\b|\bAXION\b|\bPETROBRAS\b|\bWICO\b|\bGULF\b|NAFTA|COMBUSTIBLE|ESTACION\s+DE\s+SERVICIO|SURTIDOR|PUMA\s+ENERGY/.test(t)) return 'Combustible';
  if (/CONCESIONARIA|AUTOMOVIL|AUTOMOTOR(?!A)|0KM|CERO\s+KM|REPUESTO|PATENTAMIENTO|TALLER\s+MEC|DEALER|PEUGEOT|VOLKSWAGEN|\bFORD\b|TOYOTA|CHEVROLET|RENAULT|\bFIAT\b|\bHONDA\b|\bNISSAN\b|\bJEEP\b|HYUNDAI|WOLKSWAGEN/.test(t)) return 'Automotores';
  if (/HELADERIA|HELADOS|FREDDO|CHUNGO|GRIDO|VOLTA|CREMOLATTI|AMORINO|DOLCE\s+FREDDO/.test(t)) return 'Heladerías';
  if (/HOTEL|VUELO|AEROLINEA|AEROLINEAS\s+ARG|LATAM|FLYBONDI|JETSMART|DESPEGAR|ALMUNDO|BOOKING|EDREAMS|AGENCIA\s+DE\s+VIAJE|CRUCERO|PAQUETE\s+TURI|DRAGONPASS|ACCOR|MARRIOTT|HILTON|AIRBNB|TURISMO/.test(t)) return 'Viajes y Turismo';
  if (/\bUBER\b|\bCABIFY\b|SUBTE|COLECTIVO|\bTAXI\b|TELEPASE|PEAJE|TRANSPORTE\s+PUBLI|SUBE|TRENES\s+ARG|BUS/.test(t)) return 'Transporte';
  if (/RESTAURANT|PIZZA|BURGER|SUSHI|GASTRONOM|COMIDA|CAFE|BAR(?!\w)|BARES|BODEGON|PEDIDOS|RAPPI|DELIVERY|MCDONALD|STARBUCKS|MOSTAZA|PARRILLA|CARNICER|FIAMBRE|QUESERIA|QUESO\s|MEDIALUNA|CHURRO|EMPANADA|PICADA|ALMACEN\s+DE|GRANJA|ROTISERIA|VIANDAS|DESAYUNO|BUFFET|CONFITERIA|PANADERIA/.test(t)) return 'Gastronomía';
  if (/ELECTRO|GARBARINO|FRAVEGA|MUSIMUNDO|CELULAR|PC(?!\w)|NOTEBOOK|LENOVO|TECNOLOG|SAMSUNG|APPLE|IPHONE|COMPUTO|MEGATONE|POWERMAX|RODO/.test(t)) return 'Tecnología';
  if (/ROPA|MODA|ZAPATILLAS|CALZADO|INDUMENTARIA|ZARA|H&M|MIMO|KEVINGSTON|WRANGLER|LEVIS|VESTIMENTA|MARITHIME|RAPSODIA|JAZMIN|CHEEKY/.test(t)) return 'Indumentaria';
  if (/ADIDAS|NIKE|PUMA(?!\s+ENERGY)|REEBOK|UNDER\s+ARMOUR|BICICLETA|CICLO|DEPORTE|FITNESS|GYM|GIMNASIO|RUNNING|PILATES|YOGA|DECATHLON|SPORTV/.test(t)) return 'Deportes';
  if (/PETSHOP|PETCO|VETERINAR|MASCOTA|ZOOMUNDO|PUPPIS|CATYCAN|NATURAL\s+LIFE|PET\s+CITY|ANIMALES/.test(t)) return 'Petshops';
  if (/COLCHON|SOMMIER|MUEBLE|DECORACION|HOGAR|EASY(?!\w)|SODIMAC|FALABELLA|IKEA|PINTURA|FERRETERI|SAMPIETRO|ROSMI|EXPO\s+JARD|JARDIN|PLANTAS|VIVERO/.test(t)) return 'Hogar';
  if (/CINE|TEATRO|ENTRADAS|TICKETEK|SHOW|EVENTO|ENTRETENIMIENTO|NETFLIX|SPOTIFY|DISNEY|LUMINIS|ESPECTACULO/.test(t)) return 'Entretenimiento';
  if (/OPTICA|BELLEZA|ESTETICA|PELUQUERIA|SPA|CLINICA|MEDIC|SALUD(?!\s+Y\s+BELLEZA)|DENTAL|OSDE|SWISS\s+MED|OMINT|DIETETIC|NATURIST|NATURAL\s+MATHI|PUNTO\s+SANO|LUZ\s+AZUL/.test(t)) return 'Salud y Belleza';
  if (/JUGUETE|JUGUETERIA|TOY(?:S)?\b|KINDER(?!GARTEN)|KINDERLAND|CHILD|KIDS\b|BEBE\s+MUNDO|BABY|MUNDO\s+DEL\s+JUGUETE|MAGIC\s+TOYS|SOMOS\s+GEEK|ARCO\s+IRIS/.test(t)) return 'Jugueterías';
  if (/LIBRERIA|LIBRO|EDITORIAL|CUSPIDE|EL\s+ATENEO|YENNY|PAPELERIA/.test(t)) return 'Librerías';
  if (/SHOPPING|ALTO\s+PALERMO|DOT\s+BAIRES|UNICENTER|ABASTO|PATIO\s+BULL|GALERIA|PASEO\s+DE\s+COMPRAS/.test(t)) return 'Shoppings';
  return '';
}

export const ALL_PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

export function extractProvinces(text: string): string[] {
  const t = (text || '').toUpperCase()
    .replace(/BS\.?\s?AS\.?/g, 'BUENOS AIRES')
    .replace(/C\.?A\.?B\.?A\.?/g, 'CABA')
    .replace(/GBA|GRAN\s+BUENOS\s+AIRES/g, 'BUENOS AIRES');

  if (/TODA\s+LA\s+REP[UÚ]BLICA|TODAS?\s+LAS?\s+SUCURSAL|[AÁ]MBITO\s+NACIONAL|TODO\s+EL\s+PA[ÍI]S|A\s+NIVEL\s+NACIONAL|EN\s+TODO\s+EL\s+PAIS/.test(t)) {
    return ['Todas'];
  }

  const found = ALL_PROVINCES.filter(p => {
    const norm = p.toUpperCase()
      .replace(/[Á]/g, 'A').replace(/[É]/g, 'E').replace(/[Í]/g, 'I')
      .replace(/[Ó]/g, 'O').replace(/[Ú]/g, 'U');
    return t.includes(norm);
  });

  return found.length > 0 ? found : ['Todas'];
}

export interface RawBankPromo {
  storeName: string;
  text: string;
}

// Selector fallback list para Playwright DOM scraping
export const CARD_SELECTORS = [
  '.promotion-card', '.promo-card', '.benefit-card', '.beneficio-card',
  '.oferta-card', '.deal-card',
  '[class*="PromoCard"]', '[class*="BeneficioCard"]', '[class*="PromotionCard"]',
  '[class*="promotion"]', '[class*="beneficio"]', '[class*="oferta"]',
  'article.card', 'li.card',
  '[data-testid*="promo"]', '[data-testid*="beneficio"]',
  '.swiper-slide', '.slick-slide',
];

export function buildPromos(
  raw: RawBankPromo,
  bankName: string,
  sourceUrl: string,
  overrides: Partial<ScrapedPromo> = {}
): ScrapedPromo[] {
  const allText = `${raw.storeName} ${raw.text}`;
  const discount = extractDiscount(allText);
  const installments = extractInstallments(allText);
  if (!discount && !installments) return [];

  const validDays = extractValidDays(allText);
  const { validFrom, validUntil } = extractDates(allText);
  const cap = extractCap(allText);
  const cardNetworks = extractCardNetworks(allText);
  const walletNames = extractWallets(allText);
  const categoria = detectCategoria(allText);
  const description = raw.text.slice(0, 500);
  const storeName = raw.storeName || 'Varios';

  const base: Partial<ScrapedPromo> = {
    storeName,
    description,
    sourceText: description,
    sourceUrl,
    validFrom,
    validUntil,
    validDays,
    cap: cap ?? null,
    bankNames: [bankName],
    cardNetworks: cardNetworks.length > 0 ? cardNetworks : undefined,
    walletNames: walletNames.length > 0 ? walletNames : undefined,
    paymentChannel: 'ANY', // Default value
    categoria,
    ...overrides,
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

export function dedup(promos: ScrapedPromo[]): ScrapedPromo[] {
  const seen = new Set<string>();
  return promos.filter(p => {
    const key = `${p.title}|${p.discount}|${p.storeName}|${p.validDays}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Extrae cards del DOM usando múltiples selectores fallback
export async function extractCardsFromDOM(page: import('playwright').Page): Promise<RawBankPromo[]> {
  return page.evaluate((sels) => {
    for (const sel of sels) {
      const cards = document.querySelectorAll(sel);
      if (cards.length > 2) {
        return Array.from(cards).map(card => {
          const img = card.querySelector('img');
          const headings = card.querySelectorAll('h1,h2,h3,h4,h5');
          const storeName = img?.getAttribute('alt')?.trim()
            ?? headings[0]?.textContent?.trim()
            ?? '';
          const text = (card as HTMLElement).innerText?.trim() ?? '';
          return { storeName, text };
        }).filter(c => c.text.length > 5);
      }
    }
    // Fallback: bloques con porcentaje
    const found: { storeName: string; text: string }[] = [];
    document.querySelectorAll('div, section, li').forEach(el => {
      const t = (el as HTMLElement).innerText ?? '';
      if (/\d+\s*%/.test(t) && t.length > 10 && t.length < 600 && el.children.length < 15) {
        found.push({ storeName: '', text: t.trim() });
      }
    });
    return found;
  }, CARD_SELECTORS);
}

// Detecta si una promo es exclusivamente online o exclusivamente física
// Retorna 'ONLINE', 'FISICA', o null (no se puede determinar)
export function detectSalesChannel(text: string): 'ONLINE' | 'FISICA' | null {
  const t = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // Señales claras de ONLINE
  const onlineSignals = [
    'EXCLUSIVO ONLINE', 'SOLO ONLINE', 'UNICO ONLINE', 'SOLO EN WEB',
    'SOLO EN TIENDA ONLINE', 'COMPRAS ONLINE', 'COMPRA ONLINE',
    'VALIDO ONLINE', 'VALIDO SOLO ONLINE', 'SOLO PARA COMPRAS ONLINE',
    'EN CARREFOUR.COM', 'EN LA APP', 'SOLO APP', 'EXCLUSIVO APP',
    'NO VALIDO EN SUCURSALES', 'NO VALIDO EN TIENDAS', 'NO VALIDO EN LOCALES',
    'NO APLICA EN TIENDA', 'NO APLICA EN LOCAL', 'NO APLICA EN SUCURSAL',
  ]

  // Señales claras de FÍSICA
  const fisicaSignals = [
    'EXCLUSIVO EN LOCAL', 'SOLO EN LOCAL', 'SOLO EN TIENDA',
    'EXCLUSIVO EN TIENDA', 'SOLO EN SUCURSAL', 'EXCLUSIVO EN SUCURSAL',
    'SOLO PRESENCIAL', 'EXCLUSIVO PRESENCIAL',
    'VALIDO EN LOCALES ADHERIDOS', 'EN LOCALES ADHERIDOS',
    'NO VALIDO ONLINE', 'NO VALIDO EN COMPRAS ONLINE',
    'NO APLICA ONLINE', 'NO APLICA EN COMPRAS ONLINE',
    'NO VALIDO EN LA WEB', 'NO VALIDO EN TIENDA ONLINE',
    'NO APLICA EN ECOMMERCE', 'NO VALIDO EN ECOMMERCE',
  ]

  for (const s of onlineSignals) {
    if (t.includes(s)) return 'ONLINE'
  }
  for (const s of fisicaSignals) {
    if (t.includes(s)) return 'FISICA'
  }
  return null
}

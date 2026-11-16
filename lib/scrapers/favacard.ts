// lib/scrapers/favacard.ts
// Favacard — tarjeta regional de Buenos Aires (Mar del Plata, Bahía Blanca, Necochea, etc.)
// Fuente: JSON estático publicado por el sitio nuevo (fava.com.ar), que reemplazó a
// promosfavacard.com.ar (dominio viejo, degradado a ~7 cards). Un solo fetch trae:
// - comercios: cada uno con su lista de ids de "promo template" aplicables (`promos: ["t44", ...]`)
// - promos: ~24 templates de condiciones (kind: 'pct' | 'cuotas' | 'dual') compartidas entre comercios
// Cada combinación comercio×template es una promo real para PromoAR.
import { Scraper, ScrapedPromo } from './types'

const DATA_URL = 'https://fava.com.ar/assets/data/beneficios.json'

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

interface PromoTemplatePct {
  kind: 'pct'
  pct: number
  label: string
  dias: string
  diasSemana: number[]
  fechas?: string[]
  tope: string
  hasta: string
  cond: string
}

interface PromoTemplateCuotas {
  kind: 'cuotas'
  n: number
  label: string
  dias: string
  diasSemana: number[]
  fechas?: string[]
  tope: string
  hasta: string
  cond: string
}

interface PromoTemplateDual {
  kind: 'dual'
  a: number
  b: number
  label: string
  dias: string
  diasSemana: number[]
  fechas?: string[]
  tope: string
  hasta: string
  cond: string
}

// "cupon": requiere retirar/activar una cuponera en sucursal antes de usarse (PLANAZOS, etc.)
// Misma estructura de descuento que 'pct' (campo `pct`), se trata igual a fines de armar la promo.
interface PromoTemplateCupon {
  kind: 'cupon'
  pct: number
  label: string
  dias: string
  diasSemana: number[]
  fechas?: string[]
  tope: string
  hasta: string
  cond: string
}

type PromoTemplate = PromoTemplatePct | PromoTemplateCuotas | PromoTemplateDual | PromoTemplateCupon

interface Sucursal {
  l: string
  d: string
}

interface ComercioEntry {
  n: string
  logo: string
  r: number
  det: string
  locs: string[]
  promos: string[]
  star: number
  suc: Sucursal[]
}

interface BeneficiosData {
  source: string
  generatedAt: string
  logoBase: string
  rubros: { id: number; label: string }[]
  localidades: string[]
  promos: Record<string, PromoTemplate>
  promoGroups: [string, string[]][]
  comercios: ComercioEntry[]
}

// Favacard rubro label → PromoAR category mapping
const CAT_MAP: [RegExp, string][] = [
  [/gastronom|recreac/i, 'Gastronomía'],
  [/^super/i, 'Supermercados'],
  [/farmac/i, 'Farmacias'],
  [/combust/i, 'Combustible'],
  [/^moda/i, 'Indumentaria'],
  [/belleza/i, 'Salud y Belleza'],
  [/hogar|deco|construc/i, 'Hogar'],
  [/tecnolog/i, 'Tecnología'],
  [/librer/i, 'Librerías'],
  [/mascota/i, 'Petshops'],
  [/shopping/i, 'Shoppings'],
  [/infantil/i, 'Jugueterías'],
  [/joyer/i, 'Otros'],
  [/rodado/i, 'Automotores'],
  [/servicio/i, 'Otros'],
]

function mapCategoria(rubroLabel: string, det: string): string {
  for (const [re, cat] of CAT_MAP) {
    if (re.test(rubroLabel) || re.test(det)) return cat
  }
  return 'Otros'
}

// "30/11/2026" → Date
function parseDateDMY(s: string): Date | undefined {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return undefined
  const d = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10) - 1
  const y = parseInt(m[3], 10)
  return new Date(y, mo, d)
}

// diasSemana del JSON: 0=lunes ... 6=domingo (confirmado con "Viernes, sábados y domingos" → [4,5,6])
// Bitmask PromoAR: bit 0=domingo, bit 1=lunes ... bit 6=sábado
function diasSemanaToBitmask(diasSemana: number[]): number {
  let mask = 0
  for (const d of diasSemana) {
    const bit = d === 6 ? 0 : d + 1 // domingo(6)->bit0, lunes(0)->bit1, ... sabado(5)->bit6
    mask |= (1 << bit)
  }
  return mask || 127
}

function parseCap(tope: string): number | null {
  if (/sin tope/i.test(tope)) return null
  const m = tope.match(/\$\s*([\d.,]+)/)
  if (!m) return null
  const n = parseInt(m[1].replace(/\./g, '').replace(',', '.'), 10)
  return isNaN(n) ? null : n
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&eacute;/g, 'é').replace(/&aacute;/g, 'á').replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildDiscount(tpl: PromoTemplate): { discount: string; discountType: string; title: string } {
  if (tpl.kind === 'pct' || tpl.kind === 'cupon') {
    return { discount: String(tpl.pct), discountType: 'PERCENTAGE_REINTEGRO', title: `${tpl.pct}% de descuento` }
  }
  if (tpl.kind === 'cuotas') {
    return { discount: String(tpl.n), discountType: 'CUOTAS_SIN_INTERES', title: `${tpl.n} cuotas sin interés` }
  }
  // dual: dos descuentos según categoría de tarjeta (general vs Trayectoria) — usamos el mayor
  const value = Math.max(tpl.a, tpl.b)
  return { discount: String(value), discountType: 'PERCENTAGE_REINTEGRO', title: `Hasta ${value}% de descuento` }
}

export const FavacardScraper: Scraper = {
  name: 'favacard',

  async run(): Promise<ScrapedPromo[]> {
    const res = await fetch(DATA_URL, { headers: FETCH_HEADERS })
    if (!res.ok) throw new Error(`Favacard data fetch failed: ${res.status}`)
    const data = (await res.json()) as BeneficiosData

    if (!data.comercios?.length || !data.promos) {
      console.log('[Favacard] Respuesta sin comercios/promos')
      return []
    }

    const rubroMap = new Map<number, string>()
    for (const r of data.rubros ?? []) rubroMap.set(r.id, r.label)

    const promos: ScrapedPromo[] = []

    for (const comercio of data.comercios) {
      const rubroLabel = rubroMap.get(comercio.r) ?? ''
      const cat = mapCategoria(rubroLabel, comercio.det)
      const logoUrl = comercio.logo ? `${data.logoBase}${comercio.logo}` : undefined
      const storeName = comercio.n.trim()

      for (const promoId of comercio.promos ?? []) {
        const tpl = data.promos[promoId]
        if (!tpl) continue

        const { discount, discountType, title } = buildDiscount(tpl)
        const cap = parseCap(tpl.tope)

        promos.push({
          title: `${title} – ${storeName}`,
          description: stripHtml(tpl.cond) || `Promo Favacard: ${title} en ${storeName}`,
          sourceUrl: 'https://fava.com.ar/beneficios/',
          source: 'favacard',
          externalId: `${promoId}-${comercio.n}`,
          discount,
          discountType,
          cap,
          capPeriod: cap ? 'MONTHLY' : null,
          validFrom: undefined,
          validUntil: parseDateDMY(tpl.hasta),
          validDays: diasSemanaToBitmask(tpl.diasSemana),
          specificDates: tpl.fechas,
          walletNames: ['Favacard'],
          storeName,
          storeLogoUrl: logoUrl,
          categoria: cat,
          paymentChannel: 'TARJETA_FISICA',
          salesChannel: 'FISICA',
        })
      }
    }

    console.log(`[Favacard] ${promos.length} promos generadas (${data.comercios.length} comercios)`)
    return promos
  },
}

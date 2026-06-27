// lib/scrapers/favacard.ts
// Favacard — tarjeta regional de Buenos Aires (Mar del Plata, Bahía Blanca, Necochea, etc.)
import * as cheerio from 'cheerio'
import { Scraper, ScrapedPromo } from './types'

const BASE_URL = 'https://promosfavacard.com.ar'
const LIST_URL = `${BASE_URL}//promociones/promociones_todas.php`

const FETCH_HEADERS = {
  'Referer': `${BASE_URL}/`,
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

// Favacard → PromoAR category mapping
const CAT_MAP: [RegExp, string][] = [
  [/gastronom|restaurant|bar\b|parrilla|heladeria|heladería|cafe|café|cafetería|confiteria/i, 'Gastronomía'],
  [/super|autoserv|almacen|almacén|alimenta|carniceria|carnicería|verduleria|frutería|panaderia|panadería/i, 'Supermercados'],
  [/farmac/i, 'Farmacias'],
  [/combust|estacion|nafta|dapsa|ypf\b|shell|axion|puma/i, 'Combustible'],
  [/moda|ropa|vestim|indument|calzado|zapateria|zapatería|jeans|boutique|lenceria|lencería/i, 'Indumentaria'],
  [/belleza|peluquer|estetica|estética|spa|cosmet/i, 'Salud y Belleza'],
  [/farmac|salud|optica|óptica|clinica|clínica|medic/i, 'Salud y Belleza'],
  [/hogar|deco|mueble|cortina|colchon|colchón|bazar|menaje|ceramica|pintura|construc|ferreteria|ferretería|materiales/i, 'Hogar'],
  [/tecnol|electro|comput|celular|smartphone|informatica|informática/i, 'Tecnología'],
  [/libreria|librería|papeler|escolar|educac/i, 'Librerías'],
  [/mascota|petshop|veterinaria/i, 'Petshops'],
  [/cine|teatro|entretenimiento|recreac|juego|laser|bowling|escape/i, 'Entretenimiento'],
  [/shopping|paseo\s+de\s+compras|mall/i, 'Shoppings'],
  [/infantil|niño|bebe|bebé|juguet/i, 'Jugueterías'],
  [/joyeria|joyería|bijou|relojeria|relojería/i, 'Otros'],
  [/rodado|bicicleta|moto|auto\b|neumatico|neumático|vehiculo|vehículo/i, 'Automotores'],
  [/deport|gym|fitness|natacion|natación/i, 'Deportes'],
  [/viaje|turismo|hotel|hospedaje|aereolinea/i, 'Viajes y Turismo'],
]

function mapCategoria(rubro: string): string {
  for (const [re, cat] of CAT_MAP) {
    if (re.test(rubro)) return cat
  }
  return 'Otros'
}

// "california" → "California", "top-ten-deportes" → "Top Ten Deportes"
function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .trim()
}

// "DDMMYYYY" → Date
function parseDate(s: string): Date | undefined {
  if (s.length !== 8) return undefined
  const d = parseInt(s.slice(0, 2), 10)
  const m = parseInt(s.slice(2, 4), 10) - 1
  const y = parseInt(s.slice(4, 8), 10)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return undefined
  return new Date(y, m, d)
}

function parseDiscount(text: string): { value: number; type: string } | null {
  // "40%" or "40% de descuento"
  const pct = text.match(/(\d+)\s*%/)
  if (pct) return { value: parseInt(pct[1], 10), type: 'PERCENTAGE_REINTEGRO' }

  // "3 sin interés", "6 cuotas sin interés", "3 sin interés"
  const csi = text.match(/(\d+)\s*(?:cuotas?\s*)?sin\s*inter/i)
  if (csi) return { value: parseInt(csi[1], 10), type: 'CUOTAS_SIN_INTERES' }

  // "2x1"
  if (/2x1/i.test(text)) return { value: 2, type: 'PERCENTAGE_REINTEGRO' }

  return null
}

// Day bitmask: bit 0=Sunday, bit 1=Monday ... bit 6=Saturday
const DAY_BITS: Record<string, number> = {
  'domingo': 1 << 0,
  'lunes':   1 << 1,
  'martes':  1 << 2,
  'miercoles': 1 << 3,
  'miércoles': 1 << 3,
  'jueves':  1 << 4,
  'viernes': 1 << 5,
  'sabado':  1 << 6,
  'sábado':  1 << 6,
}

function parseDays(text: string): number {
  const t = text.toLowerCase()

  if (/todos los d[íi]as|lunes a domingo/i.test(t)) return 127

  // "Lunes a Viernes" range
  const rangeMatch = t.match(/(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+a\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/)
  if (rangeMatch) {
    const dayOrder = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
    const normalize = (s: string) => s.replace(/[áéíóú]/g, c => ({á:'a',é:'e',í:'i',ó:'o',ú:'u'}[c] ?? c))
    const from = dayOrder.indexOf(normalize(rangeMatch[1]))
    const to   = dayOrder.indexOf(normalize(rangeMatch[2]))
    if (from >= 0 && to >= 0) {
      let mask = 0
      for (let i = from; i <= to; i++) mask |= (1 << i)
      return mask
    }
  }

  // Individual days
  let mask = 0
  for (const [name, bit] of Object.entries(DAY_BITS)) {
    if (t.includes(name)) mask |= bit
  }
  return mask || 127
}

// "Tope de reintegro: $15.000" → 15000
function parseCap(text: string): number | null {
  const m = text.match(/tope[^:$\n]{0,30}:\s*\$?\s*([\d.,]+)/i)
  if (!m) return null
  const n = parseInt(m[1].replace(/\./g, '').replace(',', '.'), 10)
  return isNaN(n) ? null : n
}

interface CardData {
  promoId: string
  validFrom: Date | undefined
  validUntil: Date | undefined
  commerceSlug: string
  logoUrl: string
  rubro: string
  discountText: string
  detailUrl: string
}

interface PromoTerms {
  validDays: number
  cap: number | null
  description: string
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchPromoTerms(url: string): Promise<PromoTerms> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': FETCH_HEADERS['User-Agent'] } })
    const html = await res.text()
    const $ = cheerio.load(html)

    // Strip scripts/styles and get body text
    $('script, style, nav, header, footer').remove()
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()

    // Find days section — look for "Válido" or day names near promo details
    const validDays = parseDays(bodyText)
    const cap = parseCap(bodyText)

    // Extract promo terms from body text (skip navigation/header noise)
    const desc = bodyText.slice(0, 300).trim()

    return { validDays, cap, description: desc }
  } catch {
    return { validDays: 127, cap: null, description: '' }
  }
}

export const FavacardScraper: Scraper = {
  name: 'favacard',

  async run(): Promise<ScrapedPromo[]> {
    // 1. Fetch full promo list
    const listRes = await fetch(LIST_URL, {
      method: 'POST',
      headers: { ...FETCH_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'sucursal=todas&rubro=0&rubrosolapa=0&rubrotipo=0&destacado=0&dia=0',
    })
    if (!listRes.ok) throw new Error(`Favacard list fetch failed: ${listRes.status}`)
    const listHtml = await listRes.text()
    const $ = cheerio.load(listHtml)

    // 2. Parse cards
    const cards: CardData[] = []
    const seen = new Set<string>()

    $('.col-md-2.col-sm-4.col-6').each((_, el) => {
      const card = $(el)
      const link = card.find('a[href*="/detalles/"]').first()
      let detailUrl = link.attr('href') ?? ''
      detailUrl = detailUrl.replace(/"$/, '').trim() // strip stray trailing "

      if (!detailUrl) return

      // /detalles/1629-25062026-26062026-california-4592
      const m = detailUrl.match(/\/detalles\/(\d+)-(\d{8})-(\d{8})-(.+)-(\d+)$/)
      if (!m) return

      const [, promoId, fromStr, untilStr, commerceSlug] = m

      // Deduplicate by promoId+commerceSlug (same combo can appear multiple times)
      const key = `${promoId}|${commerceSlug}`
      if (seen.has(key)) return
      seen.add(key)

      const logoUrl = card.find('figure img').first().attr('src') ?? ''
      const rubro   = card.find('.rubro p').first().text().trim()

      // Discount: grab all text from second figure
      const figures = card.find('figure')
      const discountText = figures.length >= 2
        ? figures.eq(figures.length - 1).text().replace(/\s+/g, ' ').trim()
        : card.find('font').text().trim()

      cards.push({
        promoId,
        validFrom:  parseDate(fromStr),
        validUntil: parseDate(untilStr),
        commerceSlug,
        logoUrl,
        rubro,
        discountText,
        detailUrl,
      })
    })

    if (cards.length === 0) {
      console.log('[Favacard] Sin cards en la respuesta')
      return []
    }
    console.log(`[Favacard] ${cards.length} cards únicas encontradas`)

    // 3. Fetch promo terms once per unique promoId
    const uniquePromoIds = [...new Set(cards.map(c => c.promoId))]
    const termsCache = new Map<string, PromoTerms>()

    for (const promoId of uniquePromoIds) {
      const rep = cards.find(c => c.promoId === promoId)!
      termsCache.set(promoId, await fetchPromoTerms(rep.detailUrl))
      await sleep(300)
    }
    console.log(`[Favacard] Terms cacheados para ${uniquePromoIds.length} tipos de promo`)

    // 4. Build ScrapedPromo[]
    const promos: ScrapedPromo[] = []

    for (const card of cards) {
      const disc = parseDiscount(card.discountText)
      if (!disc || disc.value === 0) continue

      const terms = termsCache.get(card.promoId)!
      const name  = slugToName(card.commerceSlug)
      const cat   = mapCategoria(card.rubro)

      const discLabel = disc.type === 'CUOTAS_SIN_INTERES'
        ? `${disc.value} cuotas sin interés`
        : `${disc.value}% de descuento`

      promos.push({
        title:          `${discLabel} – ${name}`,
        description:    terms.description || `Promo Favacard: ${discLabel} en ${name}`,
        sourceUrl:      card.detailUrl,
        discount:       String(disc.value),
        discountType:   disc.type,
        cap:            terms.cap,
        capPeriod:      terms.cap ? 'MONTHLY' : null,
        validFrom:      card.validFrom,
        validUntil:     card.validUntil,
        validDays:      terms.validDays,
        walletNames:    ['Favacard'],
        storeName:      name,
        storeLogoUrl:   card.logoUrl || undefined,
        categoria:      cat,
        paymentChannel: 'TARJETA_FISICA',
        salesChannel:   'FISICA',
      })
    }

    console.log(`[Favacard] ${promos.length} promos generadas`)
    return promos
  },
}

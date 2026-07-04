import { NextResponse } from 'next/server'
import { findCategoryNode } from '../../../precios/categories'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

interface MultiUnitPromo {
  label: string
  effectivePrice: number
  requiredQty: number
}

const BANK_PROMO_EXCLUSION_RE = /sin\s+desc|exclu[íi]d|pnp|no\s+promo|canasta\s+b[áa]s|no\s+elegible|no\s+aplica\s+promo|producto\s+no\s+promoc|no\s+acumul/i

function isExcludedFromBankPromos(p: any): boolean {
  const clusters: string[] = [
    ...Object.keys(p.productClusters || {}),
    ...Object.values(p.productClusters || {}),
    ...Object.values(p.clusterHighlights || {}).map((v: any) => typeof v === 'object' ? v.name || '' : String(v)),
  ]
  return clusters.some(c => BANK_PROMO_EXCLUSION_RE.test(c))
}

// Marcas excluidas de promos bancarias en Coto (según legales vigentes)
const COTO_EXCLUDED_BRANDS_RE = /\b(coca[\s-]?cola|fanta|sprite|schweppes|aquarius|smartwater|cepita|powerade|monster|crush|ades|hi[\s-]?c|benedictino|luigi\s+bosca|rutini|trumpeter|chandon|terrazas\s+de\s+los\s+andes|norton|catena|cadus|monteviejo|baron\s+b|dom\s+perignon|pommery|mo[eë]t|krug|alma\s+negra|animal\s+wines?|saint\s+felicien|nicasia|tilia|la\s+posta|aruma|luca\b|bianchi|valent[íi]n\s+bianchi)\b/i

// Categorías excluidas de promos bancarias en Coto (según legales vigentes)
const COTO_EXCLUDED_CATEGORY_RE = /electrodom[eé]stico|rodado|neum[áa]tico|bicicleta|menudencia|carne\s+elaborada|leche\s+infantil|harina\b|az[úu]car\b|aceite\s+girasol|aceite\s+mezcla|pollo\s+entero|novillo|novillito|ternera\b|carnes\s+frescas/i

// Carrefour — marcas excluidas según legales vigentes
const CARREFOUR_EXCLUDED_BRANDS_RE = /\b(alamos|altaland|ang[eé]lica\s+zapata|aruma|caro\b|casa\s+de\s+herrero|chandon|cuchillo\s+de\s+palo|d\.?v\.?\s*catena|el\s+enemigo|la\s+posta|luca\b|luigi\s+bosca|nicasia|ojo\s+de\s+buen\s+cubero|ribera\s+del\s+cuarzo|rutini|saint\s+felicien|san\s+felipe|valmont)\b/i

// Carrefour — categorías excluidas según legales vigentes
const CARREFOUR_EXCLUDED_CATEGORY_RE = /electrodom[eé]stico|telefon[íi]a|fotograf[íi]a|inform[áa]tica|imagen\s+y\s+sonido|sonido\b|leche\s+infantil|maternizada|carncer[íi]a|carne\s+vacuna|cerdo\b|embutido|conservadora\s+de\s+cerveza/i

function isCarrefourExcludedFromBankPromos(p: any): boolean {
  const brand = (p.brand || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (CARREFOUR_EXCLUDED_BRANDS_RE.test(brand)) return true
  const nameAndCat = `${p.name || ''} ${p.vtexCategory || ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (CARREFOUR_EXCLUDED_CATEGORY_RE.test(nameAndCat)) return true
  return false
}

function isCotoExcludedFromBankPromos(d: any): boolean {
  // Señal directa: imagen "NoAcumulable" en alguna lista de precios
  const prices: any[] = d.price || []
  if (prices.some((p: any) => p.saleImage2 === 'NoAcumulable.png' || p.saleImage1 === 'NoAcumulable.png')) return true

  // Señal directa: comments en algún descuento activo
  const discounts: any[] = d.discounts || []
  if (discounts.some((disc: any) => BANK_PROMO_EXCLUSION_RE.test(disc.comments || ''))) return true

  // Marcas excluidas según legales vigentes
  const brand = (d.product_brand || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (COTO_EXCLUDED_BRANDS_RE.test(brand)) return true

  // Categorías excluidas — usando la jerarquía de grupos que trae la API
  const groupNames = (d.groups || []).map((g: any) => g.display_name || '').join(' ')
  const nameAndGroups = `${d.sku_display_name || ''} ${groupNames}`.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (COTO_EXCLUDED_CATEGORY_RE.test(nameAndGroups)) return true

  return false
}

interface NormalizedProduct {
  ean: string
  id: string
  supermarket: string
  name: string
  brand: string
  price: number
  finalPrice: number
  discountText: string
  imageUrl: string
  url: string
  multiUnitPromo?: MultiUnitPromo
  excludedFromBankPromos?: boolean
}

function parseMultiUnitPromo(text: string, price: number): MultiUnitPromo | undefined {
  if (!text || price <= 0) return undefined
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  // "Llevá N Pagá M" (formato Coto)
  const llevaPaga = t.match(/lleva?\s+(\d+)\s+paga?\s+(\d+)/)
  if (llevaPaga) {
    const n = parseInt(llevaPaga[1])
    const m = parseInt(llevaPaga[2])
    if (n > m && m > 0) {
      return { label: `${n}x${m}`, effectivePrice: Math.round(price * m / n), requiredQty: n }
    }
  }

  // NxM: "2x1", "4x2", "6x4", "3x2", etc.
  const nxm = t.match(/(\d+)\s*[xX]\s*(\d+)/)
  if (nxm) {
    const n = parseInt(nxm[1])
    const m = parseInt(nxm[2])
    if (n > m && m > 0) {
      return { label: `${n}x${m}`, effectivePrice: Math.round(price * m / n), requiredQty: n }
    }
  }

  // "XX% de descuento en la segunda unidad"
  const descSegunda = t.match(/(\d+)\s*%\s+de\s+descuento\s+en\s+la\s+segunda\s+unidad/)
  if (descSegunda) {
    const pct = parseInt(descSegunda[1])
    const effectivePrice = Math.round((price + price * (1 - pct / 100)) / 2)
    return { label: `2do al ${100 - pct}%`, effectivePrice, requiredQty: 2 }
  }

  // "2do al XX%" o "segundo al XX%" — XX% es el descuento en la segunda unidad
  // "2do al 80%" = 2da unidad con 80% de descuento = paga 20% → efectivo (price + 0.20*price)/2 = 0.60*price
  const segundo = t.match(/(?:2do|segundo)\s+al\s+(\d+)\s*%/)
  if (segundo) {
    const pct = parseInt(segundo[1])
    const effectivePrice = Math.round((price + price * (100 - pct) / 100) / 2)
    return { label: `2do al ${pct}%`, effectivePrice, requiredQty: 2 }
  }

  // "3er al XX%"
  const tercer = t.match(/(?:3er|tercer)\s+al\s+(\d+)\s*%/)
  if (tercer) {
    const pct = parseInt(tercer[1])
    const effectivePrice = Math.round((price * 2 + price * (100 - pct) / 100) / 3)
    return { label: `3er al ${pct}%`, effectivePrice, requiredQty: 3 }
  }

  return undefined
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json"
}

// Filtra productos cuyo nombre no contiene al menos la palabra principal de la búsqueda.
// Evita falsos positivos cuando VTEX IS devuelve top-sellers sin relación con la query.
function isRelevantForQuery(productName: string, query: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const words = normalize(query)
    .split(/\s+/)
    .filter(w => w.length >= 4 && !/^\d+$/.test(w))
  if (!words.length) return true
  const name = normalize(productName)
  const mainWord = words.sort((a, b) => b.length - a.length)[0]

  // Stem simple: si termina en 's', también aceptar el singular (heladeras → heladera)
  const stem = mainWord.endsWith('s') && mainWord.length > 4 ? mainWord.slice(0, -1) : mainWord
  const match = name.includes(mainWord) ? mainWord : name.includes(stem) ? stem : null
  if (!match) return false

  // Descartar accesorios: si el término aparece después de "para/apto para/compatible con"
  const idx = name.indexOf(match)
  const before = name.slice(0, idx).trimEnd()
  if (/\b(para|apto para|compatible con)\s*$/.test(before)) return false
  return true
}

// ---------------------------------------------------------
// VTEX CATALOG SIMPLE (Frávega, Naldo, Coppel)
// ---------------------------------------------------------
async function searchVtexCatalog(query: string, supermarket: string, baseUrl: string): Promise<NormalizedProduct[]> {
  try {
    const url = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=29`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error(`[${supermarket}] catalog HTTP ${res.status}`)
      return []
    }
    const data = await res.json()
    if (!Array.isArray(data)) {
      console.error(`[${supermarket}] catalog respuesta no es array:`, JSON.stringify(data).slice(0, 100))
      return []
    }
    console.log(`[${supermarket}] catalog ${data.length} productos`)

    return data.flatMap((p: any) => {
      return (p.items || []).map((item: any) => {
        const offer = item.sellers?.[0]?.commertialOffer || {}
        const price = offer.Price || 0
        const listPrice = offer.ListPrice || price
        if (!price || (offer.AvailableQuantity || 0) <= 0) return null

        let discountText = '-'
        if (listPrice > price) {
          const pct = Math.round((1 - price / listPrice) * 100)
          if (pct > 0) discountText = `${pct}% OFF`
        }

        const slug = supermarket.toLowerCase().replace(/\s/g, '')
        return {
          ean: String(item.ean || ''),
          id: `${slug}-${item.itemId || p.productId}`,
          supermarket,
          name: p.productName || 'Sin nombre',
          brand: p.brand || '-',
          price: listPrice,
          finalPrice: price,
          discountText,
          imageUrl: item.images?.[0]?.imageUrl || '',
          url: p.linkText ? `${baseUrl}/${p.linkText}/p` : baseUrl,
          multiUnitPromo: parseMultiUnitPromo(discountText, listPrice),
          vtexCategoryId: p.categoriesIds?.[0] || p.categoryId || '',
          vtexCategory: p.categories?.[0] || '',
          excludedFromBankPromos: isExcludedFromBankPromos(p),
        }
      }).filter(Boolean)
    }) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// WOOCOMMERCE STORE API (Depot Express, etc.)
// ---------------------------------------------------------
async function searchWooCommerceStore(query: string, supermarket: string, baseUrl: string): Promise<NormalizedProduct[]> {
  try {
    const url = `${baseUrl}/wp-json/wc/store/v1/products?search=${encodeURIComponent(query)}&per_page=20`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    const slug = supermarket.toLowerCase().replace(/\s/g, '')
    return data.map((p: any) => {
      const minorUnit = p.prices?.currency_minor_unit ?? 2
      const divisor = Math.pow(10, minorUnit)
      const price = p.prices?.regular_price ? parseInt(p.prices.regular_price) / divisor : 0
      const saleRaw = p.prices?.sale_price
      const finalPrice = saleRaw ? parseInt(saleRaw) / divisor : price
      if (!price) return null
      let discountText = '-'
      if (finalPrice < price) {
        const pct = Math.round((1 - finalPrice / price) * 100)
        if (pct > 0) discountText = `${pct}% OFF`
      }
      const ean = String(p.sku || '')
      const imageUrl = p.images?.[0]?.src || ''
      const permalink = p.permalink || baseUrl
      return {
        ean,
        id: `${slug}-${p.id}`,
        supermarket,
        name: p.name || 'Sin nombre',
        brand: '-',
        price,
        finalPrice,
        discountText,
        imageUrl,
        url: permalink,
        multiUnitPromo: undefined,
        vtexCategoryId: '',
        vtexCategory: '',
      }
    }).filter(Boolean) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// COOPERATIVA OBRERA (La Coope en Casa — custom API)
// ---------------------------------------------------------
async function searchCoopeEnCasa(query: string): Promise<NormalizedProduct[]> {
  try {
    const url = `https://api.lacoopeencasa.coop/api/buscar/articulos?q=${encodeURIComponent(query)}&offset=0&pedido=1`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://www.lacoopeencasa.coop',
        'Referer': 'https://www.lacoopeencasa.coop/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const items: any[] = Array.isArray(data) ? data : (data.datos || data.data || data.items || [])
    return items.map((p: any) => {
      const price = parseFloat(p.precio || '0')
      const promoPrice = p.precio_promo ? parseFloat(p.precio_promo) : null
      const finalPrice = promoPrice && promoPrice < price ? promoPrice : price
      let discountText = '-'
      if (p.descuento_porcentaje_promo) {
        discountText = `${Math.round(Number(p.descuento_porcentaje_promo))}% OFF`
      } else if (promoPrice && promoPrice < price) {
        const pct = Math.round((1 - promoPrice / price) * 100)
        if (pct > 0) discountText = `${pct}% OFF`
      }
      return {
        ean: String(p.cod_interno || ''),
        id: `coope-${p.cod_interno || Math.random()}`,
        supermarket: 'Cooperativa Obrera',
        name: p.descripcion || 'Sin nombre',
        brand: p.marca_desc || '-',
        price,
        finalPrice,
        discountText,
        imageUrl: p.imagen || '',
        url: 'https://www.lacoopeencasa.coop',
        multiUnitPromo: undefined,
        vtexCategoryId: '',
        vtexCategory: '',
      }
    }).filter(p => p.price > 0)
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// EASY (VTEX IO Intelligent Search)
// ---------------------------------------------------------
async function searchEasy(query: string): Promise<NormalizedProduct[]> {
  try {
    const url = `https://www.easy.com.ar/api/io/_v/api/intelligent-search/product_search?query=${encodeURIComponent(query)}&count=30`
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const products = data.products || []

    return products.flatMap((p: any) => {
      const item = p.items?.[0] || {}
      const offer = item.sellers?.[0]?.commertialOffer || {}
      const price = offer.Price || 0
      const listPrice = offer.ListPrice || price
      if (!price || (offer.AvailableQuantity || 0) <= 0) return []

      let discountText = '-'
      const highlights = offer.discountHighlights || []
      const teasers = offer.Teasers?.map((t: any) => t.Name) || []
      const promos = [...highlights.map((h: any) => h.name), ...teasers].filter(Boolean)
      if (listPrice > price) {
        const pct = Math.round((1 - price / listPrice) * 100)
        if (pct > 0) promos.unshift(`${pct}% OFF`)
      }
      if (promos.length > 0) discountText = promos[0]

      return [{
        ean: String(item.ean || ''),
        id: `easy-${item.itemId || p.productId}`,
        supermarket: 'Easy',
        name: p.productName || 'Sin nombre',
        brand: p.brand || '-',
        price: listPrice,
        finalPrice: price,
        discountText,
        imageUrl: item.images?.[0]?.imageUrl || '',
        url: p.linkText ? `https://www.easy.com.ar/${p.linkText}/p` : 'https://www.easy.com.ar',
        multiUnitPromo: parseMultiUnitPromo(discountText, listPrice),
        vtexCategoryId: p.categoriesIds?.[0] || p.categoryId || '',
        vtexCategory: p.categories?.[0] || '',
      }]
    }) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// MERCADOLIBRE (OAuth client credentials)
// ---------------------------------------------------------
let mlTokenCache: { token: string; expiresAt: number } | null = null

async function getMlToken(): Promise<string | null> {
  // Usar access token en cache si no expiró
  if (mlTokenCache && Date.now() < mlTokenCache.expiresAt) return mlTokenCache.token

  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error(`[ML token] vars no encontradas — CLIENT_ID:${!!clientId} CLIENT_SECRET:${!!clientSecret}`)
    return null
  }

  try {
    // Refresh token: primero DB (rota en cada uso), fallback a env var como seed inicial
    const dbConfig = await prisma.siteConfig.findUnique({ where: { key: 'ml_refresh_token' } }).catch(() => null)
    const refreshToken = dbConfig?.value || process.env.ML_REFRESH_TOKEN
    if (!refreshToken) {
      console.error('[ML token] no hay refresh_token en DB ni en env')
      return null
    }

    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
      signal: AbortSignal.timeout(5000),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`[ML token] refresh HTTP ${res.status} — ${text.slice(0, 200)}`)
      return null
    }
    const data = JSON.parse(text)

    // Guardar el nuevo refresh_token rotado en DB antes de retornar
    if (data.refresh_token) {
      await prisma.siteConfig.upsert({
        where: { key: 'ml_refresh_token' },
        update: { value: data.refresh_token },
        create: { key: 'ml_refresh_token', value: data.refresh_token },
      }).catch((e: any) => console.error('[ML token] error guardando refresh_token en DB:', e.message))
    }

    mlTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
    console.log(`[ML token] OK, expira en ${data.expires_in}s, refresh_token rotado`)
    return data.access_token
  } catch (e: any) {
    console.error(`[ML token] excepción: ${e.message}`)
    return null
  }
}

async function searchMercadoLibre(query: string): Promise<NormalizedProduct[]> {
  try {
    // condition=new removido — puede reducir resultados en algunas categorías
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=50`
    const headers: Record<string, string> = { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    // Token opcional — la API pública funciona sin auth (menor rate limit)
    const token = await getMlToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      const hdrs: Record<string, string> = {}
      res.headers.forEach((v, k) => { hdrs[k] = v })
      console.error(`[MercadoLibre] HTTP ${res.status} headers: ${JSON.stringify(hdrs)}`)
      console.error(`[MercadoLibre] HTTP ${res.status} body: ${body}`)
      return []
    }
    const data = await res.json()
    const items: any[] = data.results || []

    // Agrupar por EAN (cuando está disponible) o por título normalizado
    // Para ML mostramos el precio más bajo de cada producto único
    const seen = new Map<string, any>()

    for (const item of items) {
      if (item.condition !== 'new') continue
      const price = item.price || 0
      if (!price) continue

      // Clave de agrupación: EAN si existe, sino título normalizado
      const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
      const key = titleKey

      const existing = seen.get(key)
      // Preferir tienda oficial, y dentro de cada tipo el más barato
      const isOfficial = !!item.official_store_name
      const existingIsOfficial = existing ? !!existing.official_store_name : false

      if (!existing ||
          (isOfficial && !existingIsOfficial) ||
          (isOfficial === existingIsOfficial && price < existing.price)) {
        seen.set(key, item)
      }
    }

    const results = Array.from(seen.values()).slice(0, 20).map((item: any) => {
      const price = item.price || 0
      const originalPrice = item.original_price || price
      let discountText = '-'
      if (originalPrice > price) {
        const pct = Math.round((1 - price / originalPrice) * 100)
        if (pct > 0) discountText = `${pct}% OFF`
      }
      const storeName = item.official_store_name ? `ML · ${item.official_store_name}` : 'MercadoLibre'
      return {
        ean: '',
        id: `ml-${item.id}`,
        supermarket: storeName,
        name: item.title || 'Sin nombre',
        brand: '-',
        price: originalPrice,
        finalPrice: price,
        discountText,
        imageUrl: (item.thumbnail || '').replace('I.jpg', 'O.jpg'),
        url: item.permalink || 'https://www.mercadolibre.com.ar',
        multiUnitPromo: undefined,
      }
    }) as NormalizedProduct[]
    console.log(`[MercadoLibre] ${results.length} productos para "${query}" (${items.length} items raw)`)
    return results
  } catch (err: any) {
    console.error(`[MercadoLibre] Error para "${query}":`, err?.message || err)
    return []
  }
}

// ---------------------------------------------------------
// MEGATONE (HTML scraping + API de precios por SKU)
// Los productos vienen embebidos en el HTML como GlobalListado.Productos
// Los precios se obtienen por SKU via /apirecursoswebv2/api/Productos/Obtener
// ---------------------------------------------------------
async function fetchMegatoneHtml(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'es-AR,es;q=0.9',
      'Referer': 'https://www.megatone.net/',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
}

async function searchMegatone(query: string): Promise<NormalizedProduct[]> {
  try {
    const words = query.trim().split(/\s+/)
    const slug = words[0].toLowerCase()

    // 1) landing/{slug}/ — funciona para marcas (samsung) y categorías en plural (heladeras)
    // 2) landing/{slug}s/ — fallback plural si singular da 404
    // 3) buscar/{query}/ — buscador general como último recurso
    let res = await fetchMegatoneHtml(`https://www.megatone.net/landing/${encodeURIComponent(slug)}/`)
    console.log(`[Megatone] /landing/${slug}/ → ${res.status}`)
    if (!res.ok && !slug.endsWith('s')) {
      res = await fetchMegatoneHtml(`https://www.megatone.net/landing/${encodeURIComponent(slug + 's')}/`)
      console.log(`[Megatone] /landing/${slug}s/ → ${res.status}`)
    }
    if (!res.ok) {
      const searchSlug = query.trim().toLowerCase().replace(/\s+/g, '-')
      res = await fetchMegatoneHtml(`https://www.megatone.net/buscar/${encodeURIComponent(searchSlug)}/`)
      console.log(`[Megatone] /buscar/${searchSlug}/ → ${res.status}`)
    }
    if (!res.ok) return []
    const html = await res.text()

    // Extraer GlobalListado.Productos del HTML
    const match = html.match(/Productos:\s*(\[[\s\S]*?\])\s*,\s*(?:Paginado|Filtros)/)
    if (!match) return []

    // El array usa sintaxis JS (comillas simples, sin comillas en keys) — convertir a JSON válido
    let productos: any[]
    try {
      productos = JSON.parse(match[1])
    } catch {
      try {
        const items: any[] = []
        const itemRe = /\{SKU:"([^"]+)",ID:(\d+),Nombre:["']([^"']+)["'],URL:"([^"]+)",Imagen:"([^"]+)",Marca:\{[^}]*Descripcion:"([^"]+)"/g
        let m2
        while ((m2 = itemRe.exec(match[1])) !== null) {
          items.push({ SKU: m2[1], ID: parseInt(m2[2]), Nombre: m2[3], URL: m2[4], Imagen: m2[5], Marca: { Descripcion: m2[6] } })
        }
        productos = items
      } catch { return [] }
    }

    if (!productos.length) return []

    const priceMap: Record<string, number> = {}
    const priceRe = /gtmClickProductoListado\("([^"]+)",\d+,(\d+(?:\.\d+)?),/g
    let pm
    while ((pm = priceRe.exec(html)) !== null) {
      priceMap[pm[1]] = parseFloat(pm[2])
    }
    console.log(`[Megatone] ${productos.length} productos, ${Object.keys(priceMap).length} precios`)
    return productos.map((p: any) => {
      const finalPrice = priceMap[p.SKU] || 0
      if (!finalPrice) return null

      return {
        ean: String(p.EAN || ''),
        id: `megatone-${p.SKU}`,
        supermarket: 'Megatone',
        name: p.Marca?.Descripcion ? `${p.Marca.Descripcion} ${p.Nombre?.trim()}` : (p.Nombre?.trim() || 'Sin nombre'),
        brand: p.Marca?.Descripcion || '-',
        price: finalPrice,
        finalPrice,
        discountText: '-',
        imageUrl: p.Imagen || '',
        url: `https://www.megatone.net${p.URL}`,
        multiUnitPromo: undefined,
        vtexCategoryId: '',
        vtexCategory: '',
      }
    }).filter(Boolean) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// RODO (Magento GraphQL)
// ---------------------------------------------------------
async function searchRodo(query: string): Promise<NormalizedProduct[]> {
  try {
    const gql = `{
      products(search: "${query.replace(/"/g, '')}", pageSize: 30) {
        items {
          name
          sku
          url_key
          price { regularPrice { amount { value } } }
          special_price
          small_image { url }
        }
      }
    }`

    const res = await fetch('https://www.rodo.com.ar/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      body: JSON.stringify({ query: gql }),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!res.ok) return []

    const data = await res.json()
    const items = data?.data?.products?.items || []

    return items.map((item: any) => {
      const listPrice = item.price?.regularPrice?.amount?.value || 0
      const finalPrice = item.special_price || listPrice
      if (!listPrice) return null

      let discountText = '-'
      if (listPrice > finalPrice) {
        const pct = Math.round((1 - finalPrice / listPrice) * 100)
        if (pct > 0) discountText = `${pct}% OFF`
      }

      return {
        ean: '',
        id: `rodo-${item.sku}`,
        supermarket: 'Rodo',
        name: item.name || 'Sin nombre',
        brand: '-',
        price: listPrice,
        finalPrice,
        discountText,
        imageUrl: item.small_image?.url || '',
        url: item.url_key ? `https://www.rodo.com.ar/${item.url_key}` : 'https://www.rodo.com.ar',
        multiUnitPromo: parseMultiUnitPromo(discountText, listPrice),
      }
    }).filter(Boolean) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// COTO (BFF API - Includes EAN)
// ---------------------------------------------------------
async function searchCoto(query: string, isCategory = false): Promise<NormalizedProduct[]> {
  try {
    const encoded = encodeURIComponent(query)
    // Usar la API de Constructor.io directamente para categorías es complejo desde la BFF
    // Si es categoría, podríamos usar browse_id pero para el MVP de la tabla usaremos Coto's autocomplete viejo o la BFF
    // Como el usuario nos dio la URL de search:
    let url = `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/search/${encoded}?key=key_r6xzz4IAoTWcipni&num_results_per_page=15&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D&c=cio-fe-web-coto-3.3.2&i=be12c8ad-be67-4a78-ac7d-19ed91f6807d&s=4`
    
    // Si es categoría, usamos el parámetro filter
    if (isCategory) {
      // Para Coto, group_id es ej catv00001540.
      url = `https://api.coto.com.ar/api/v1/ms-digital-sitio-bff-web/api/v1/products/browse/${encoded}?key=key_r6xzz4IAoTWcipni&num_results_per_page=15&pre_filter_expression=%7B%22name%22:%22store_availability%22,%22value%22:%22200%22%7D&c=cio-fe-web-coto-3.3.2&i=be12c8ad-be67-4a78-ac7d-19ed91f6807d&s=4`
    }

    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return []
    
    const data = await res.json()
    const products = data?.response?.results || []
    
    return products.map((item: any) => {
      const d = item.data || {}
      const pList = d.product_list_price || 0
      let finalPrice = pList
      let discountText = "-"
      
      if (d.discounts && d.discounts.length > 0) {
        const disc = d.discounts[0]
        discountText = `${disc.takingText || ''} ${disc.discountText || ''}`.trim()
        const dp = String(disc.discountPrice || '').replace('$', '').replace(',', '')
        if (dp) finalPrice = parseFloat(dp)
      } else if (d.sale_type && d.sale_type.length > 0) {
        discountText = d.sale_type[0]
      }
      
      return {
        ean: String(d.product_main_ean || ''),
        id: `coto-${d.sku_plu || item.value}`,
        supermarket: 'Coto',
        name: d.sku_display_name || item.value || 'Sin nombre',
        brand: d.product_brand || '-',
        price: pList,
        finalPrice: finalPrice,
        discountText: discountText,
        imageUrl: d.image_url || '',
        url: d.url ? `https://www.cotodigital.com.ar/sitios/cdigi/productos/detalle/_/${d.url}` : '',
        multiUnitPromo: parseMultiUnitPromo(discountText, pList),
        excludedFromBankPromos: isCotoExcludedFromBankPromos(d)
      }
    })
  } catch (error) {
    console.error("Error Coto completo:", error)
    return []
  }
}

// ---------------------------------------------------------
// CARREFOUR (VTEX Catalog System)
// ---------------------------------------------------------
async function searchCarrefour(query: string, isCategory = false): Promise<NormalizedProduct[]> {
  try {
    // Búsqueda por EAN/SKU: el buscador de texto libre (ft=) de Carrefour no indexa por EAN
    // y devuelve 0 resultados. Usar el filtro fq=alternateIds_Ean: para estos casos.
    const isEan = /^\d{8,14}$/.test(query.trim())

    let url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=14`
    if (isCategory) {
      url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=C:${query}&_from=0&_to=14&O=OrderByTopSaleDESC`
    } else if (isEan) {
      url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(query.trim())}&_from=0&_to=14`
    }
    
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return []
    
    const data = await res.json()
    if (!Array.isArray(data)) return []
    
    return data.map((p: any) => {
      const item = p.items?.[0] || {}
      const offer = item.sellers?.[0]?.commertialOffer || {}
      
      const priceList = offer.ListPrice || 0
      const price = offer.Price || 0
      const available = (offer.AvailableQuantity || 0) > 0

      if (!available || price <= 0) return null
      
      let discountText = "-"
      const highlights = offer.DiscountHighLight || []
      // offer.Teasers serializa los campos como "<Name>k__BackingField" (backing fields .NET),
      // por eso t.Name siempre es undefined ahí. PromotionTeasers trae los mismos datos con Name limpio.
      const teasers = offer.PromotionTeasers?.map((t: any) => t.Name) || []
      let allPromos = [...highlights, ...teasers].filter(Boolean)

      if (priceList > price) {
        const pct = Math.round((1 - (price / priceList)) * 100)
        if (pct > 0) {
          const t = `${pct}% OFF`
          if (!allPromos.includes(t)) allPromos.unshift(t)
        }
      }

      if (allPromos.length > 0) discountText = allPromos.join(" | ")

      return {
        ean: String(item.ean || ''),
        id: `carrefour-${item.itemId || p.productId}`,
        supermarket: 'Carrefour',
        name: p.productName || 'Sin nombre',
        brand: p.brand || '-',
        price: priceList,
        finalPrice: price,
        discountText: discountText,
        imageUrl: item.images?.[0]?.imageUrl || '',
        url: p.link?.startsWith('http') ? p.link : `https://www.carrefour.com.ar${p.link || ''}`,
        multiUnitPromo: parseMultiUnitPromo(discountText, priceList)
      }
    }).filter(Boolean) as NormalizedProduct[]
  } catch (error) {
    console.error("Error Carrefour:", error)
    return []
  }
}

// ---------------------------------------------------------
// VTEX INTELLIGENT SEARCH (Jumbo, Vea, Disco, Dia)
type PromoEntry = { promoCode: string; effectiveDiscount: number; primePromoCode?: string; primeEffectiveDiscount?: number }
// Cache en memoria de promos Cencosud (leídas de DB, pobladas por GitHub Actions día por medio)
const promoCacheMemory: Record<string, { data: Record<string, PromoEntry>; ts: number }> = {}

async function getCencosudPromos(host: string, skuIds: string[]): Promise<Record<string, PromoEntry>> {
  if (!skuIds.length) return {}

  const cached = promoCacheMemory[host]
  // Cache en memoria de 30 minutos para no martillar la DB en cada request
  if (!cached || Date.now() - cached.ts > 30 * 60 * 1000) {
    try {
      const rows = await prisma.vtexPromoCache.findMany({ where: { site: host } })
      const data: Record<string, PromoEntry> = {}
      for (const row of rows) {
        if (row.segment === 'generic') {
          if (!data[row.skuId]) data[row.skuId] = { promoCode: row.promoCode, effectiveDiscount: row.effectiveDiscount }
          else { data[row.skuId].promoCode = row.promoCode; data[row.skuId].effectiveDiscount = row.effectiveDiscount }
        } else if (row.segment === 'jumbo_prime') {
          if (!data[row.skuId]) data[row.skuId] = { promoCode: '', effectiveDiscount: 0, primePromoCode: row.promoCode, primeEffectiveDiscount: row.effectiveDiscount }
          else { data[row.skuId].primePromoCode = row.promoCode; data[row.skuId].primeEffectiveDiscount = row.effectiveDiscount }
        }
      }
      promoCacheMemory[host] = { data, ts: Date.now() }
      console.log(`[${host}] promo cache cargado: ${rows.length} entradas`)
    } catch (e: any) {
      console.log(`[${host}] promo cache DB error: ${e.message}`)
      return {}
    }
  }

  const result: Record<string, PromoEntry> = {}
  for (const skuId of skuIds) {
    if (promoCacheMemory[host]?.data[skuId]) result[skuId] = promoCacheMemory[host].data[skuId]
  }
  return result
}




async function fetchVtexPromotions(baseUrl: string, itemIds: string[], headers: any): Promise<Record<string, any>> {
  if (!itemIds.length) return {}
  try {
    const h = {
      ...headers,
      'Referer': baseUrl + '/',
      'Origin': baseUrl,
      'Content-Type': 'application/json',
    }
    const host = baseUrl.split('//')[1]
    const res = await fetch(`${baseUrl}/_v/search-promotions`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ seller: '1', skus: itemIds }),
    })
    if (!res.ok) {
      console.log(`[${host}] search-promotions HTTP ${res.status}`)
      return {}
    }
    const data = await res.json()
    const allBuckets = data?.promotions || {}
    const promos: Record<string, any> = {}
    for (const bucket of Object.values(allBuckets) as any[]) {
      Object.assign(promos, bucket?.promotions || {})
    }
    console.log(`[${host}] search-promotions: ${Object.keys(promos).length} promos para ${itemIds.length} skus`)
    if (Object.keys(promos).length > 0) console.log(`[${host}] primera promo:`, JSON.stringify(Object.values(promos)[0]).slice(0, 200))
    return promos
  } catch (e: any) {
    console.log(`[${baseUrl.split('//')[1]}] search-promotions exception: ${e.message}`)
    return {}
  }
}

// ---------------------------------------------------------
// VTEX CATALOG BY EAN — para búsquedas exactas por código de barras
// Siempre devuelve PromotionTeasers con el nombre limpio de la promo
// ---------------------------------------------------------
async function searchVtexByEan(ean: string, supermarket: string, baseUrl: string): Promise<NormalizedProduct[]> {
  try {
    const url = `${baseUrl}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${encodeURIComponent(ean)}&_from=0&_to=14`
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data) || !data.length) return []

    return data.flatMap((p: any) => {
      return (p.items || []).map((item: any) => {
        const offer = item.sellers?.[0]?.commertialOffer || {}
        const priceList = offer.ListPrice || offer.Price || 0
        const price = offer.Price || 0
        if ((offer.AvailableQuantity || 0) <= 0 || price <= 0) return null

        const teasers: string[] = offer.PromotionTeasers?.map((t: any) => t.Name).filter(Boolean) || []
        if (priceList > price) {
          const pct = Math.round((1 - price / priceList) * 100)
          if (pct > 0) teasers.unshift(`${pct}% OFF`)
        }
        const discountText = teasers[0] || '-'

        return {
          ean: String(item.ean || ean),
          id: `${supermarket.toLowerCase()}-${item.itemId || p.productId}`,
          supermarket,
          name: p.productName || 'Sin nombre',
          brand: p.brand || '-',
          price: priceList,
          finalPrice: price,
          discountText,
          imageUrl: item.images?.[0]?.imageUrl || '',
          url: p.link?.startsWith('http') ? p.link : (p.linkText ? `${baseUrl}/${p.linkText}/p` : baseUrl),
          multiUnitPromo: parseMultiUnitPromo(discountText, priceList),
        } as NormalizedProduct
      }).filter(Boolean)
    }) as NormalizedProduct[]
  } catch {
    return []
  }
}

function extractPromoLabel(name: string): string {
  const m2da = name.match(/2[°oa]?\s*[au]\s*l?\s*(\d+)\s*%/i)
  if (m2da) return `2da al ${m2da[1]}%`
  const m3er = name.match(/3[°era]?\s*[au]\s*l?\s*(\d+)\s*%/i)
  if (m3er) return `3era al ${m3er[1]}%`
  const mgratis = name.match(/(\d+)[°a]?\s*(?:unidad|u\.?)?\s*gratis/i)
  if (mgratis) return `${mgratis[1]} gratis`
  const mnxm = name.match(/(\d+)\s*[xX]\s*(\d+)/)
  if (mnxm) return `${mnxm[1]}x${mnxm[2]}`
  const moff = name.match(/(\d+)\s*%\s*(?:off|desc)/i)
  if (moff) return `${moff[1]}% OFF`
  // Fallback: "LLEVANDO 2 - 2da al X%" → buscar el porcentaje directamente
  const mpct = name.match(/(\d+)\s*%/)
  if (mpct) return `${mpct[1]}% OFF`
  return ''
}

async function enrichWithCheckoutSim(
  products: NormalizedProduct[],
  baseUrl: string,
  headers: any,
): Promise<NormalizedProduct[]> {
  const toCheck = products.filter(p => p.discountText === '-' && p.finalPrice > 0)
  if (!toCheck.length) return products

  // itemId está en el id del producto: "supermarket-itemId"
  const itemIdOf = (p: NormalizedProduct) => p.id.split('-').slice(1).join('-')

  try {
    const simRes = await fetch(`${baseUrl}/api/checkout/pub/orderForms/simulation?sc=1`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: toCheck.map(p => ({ id: itemIdOf(p), quantity: 2, seller: '1' })),
        country: 'ARG',
        postalCode: '1000',
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!simRes.ok) return products
    const sim = await simRes.json()

    // Mapa itemId → descuento aplicado + nombre de la promo
    const discountByItemId = new Map<string, { discount: number; label: string }>()
    const promoNames: string[] = (sim.ratesAndBenefitsData?.rateAndBenefitsIdentifiers || [])
      .map((r: any) => String(r.name || ''))

    for (const simItem of (sim.items || [])) {
      const itemId = String(simItem.id)
      const priceTags: any[] = simItem.priceTags || []
      let totalDiscount = 0
      for (const tag of priceTags) {
        const raw = typeof tag.rawValue === 'number' ? tag.rawValue : (tag.value || 0) / 100
        if (raw < 0) totalDiscount += Math.abs(raw)
      }
      if (totalDiscount <= 0) continue

      // Buscar nombre de la promo que coincida con el tag
      let label = ''
      for (const name of promoNames) {
        label = extractPromoLabel(name)
        if (label) break
      }
      if (!label) {
        const pct = Math.round((totalDiscount / ((simItem.listPrice || 1) / 100)) * 50)
        label = pct > 0 ? `2da al ${pct}%` : '2da unidad'
      }
      discountByItemId.set(itemId, { discount: totalDiscount, label })
    }

    const host = baseUrl.split('//')[1]
    if (discountByItemId.size > 0)
      console.log(`[${host}] checkout sim: ${discountByItemId.size} promos encontradas`)

    return products.map(p => {
      if (p.discountText !== '-') return p
      const itemId = itemIdOf(p)
      const entry = discountByItemId.get(itemId)
      if (!entry) return p
      // effectivePrice por unidad = (precio × 2 - descuento total) / 2
      const effectivePrice = Math.max(1, Math.round(p.price - entry.discount / 2))
      return {
        ...p,
        discountText: entry.label,
        multiUnitPromo: { label: entry.label, effectivePrice, requiredQty: 2 },
      }
    })
  } catch (e: any) {
    console.log(`[${baseUrl.split('//')[1]}] checkout sim error: ${e.message}`)
    return products
  }
}

async function searchVtexIS(query: string, isCategory: boolean, supermarket: string, baseUrl: string, vtexMap: string = 'c'): Promise<NormalizedProduct[]> {
  // Para búsquedas por EAN en tiendas no-Cencosud: usar catalog API con EAN filter
  // (VTEX IS no siempre incluye PromotionTeasers en búsquedas de texto libre)
  const isCencosud = ['Jumbo', 'Disco', 'Vea'].includes(supermarket)
  if (!isCategory && !isCencosud && /^\d{8,14}$/.test(query.trim())) {
    return searchVtexByEan(query.trim(), supermarket, baseUrl)
  }
  try {
    const encoded = encodeURIComponent(query)
    let url = `${baseUrl}/_v/api/intelligent-search/product_search/?query=${encoded}&page=1&count=15&sort=orders:desc&hideUnavailableItems=true`

    if (isCategory) {
       url = `${baseUrl}/_v/api/intelligent-search/product_search/?query=${encoded}&map=${vtexMap}&page=1&count=15&sort=orders:desc&hideUnavailableItems=true`
    }
    
    const VTEX_SEGMENT = supermarket === 'Jumbo'
      ? "eyJjYW1wYWlnbnMiOm51bGwsImNoYW5uZWwiOiIzMiIsInByaWNlVGFibGVzIjpudWxsLCJyZWdpb25JZCI6bnVsbCwidXRtX2NhbXBhaWduIjpudWxsLCJ1dG1fc291cmNlIjpudWxsLCJ1dG1pX2NhbXBhaWduIjpudWxsLCJjdXJyZW5jeUNvZGUiOiJBUlMiLCJjdXJyZW5jeVN5bWJvbCI6IiQiLCJjb3VudHJ5Q29kZSI6IkFSRyIsImN1bHR1cmVJbmZvIjoiZXMtQVIiLCJjaGFubmVsUHJpdmFjeSI6InB1YmxpYyJ9"
      : ""

    const headers: any = { ...HEADERS }
    if (VTEX_SEGMENT) {
      headers['Cookie'] = `vtex_segment=${VTEX_SEGMENT}; VtexWorkspace=master%3A-`
    }
    
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(7000) })
    if (!res.ok) {
      console.log(`[${supermarket}] IS HTTP ${res.status} — intentando catalog fallback`)
    }
    const data = res.ok ? await res.json() : {}
    let products = data.products || []

    // Fallback al Catalog Search si IS no devuelve resultados o falla
    if (products.length === 0 && !isCategory) {
      try {
        const catUrl = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encoded}&_from=0&_to=14`
        const catRes = await fetch(catUrl, { headers, signal: AbortSignal.timeout(7000) })
        if (catRes.ok) {
          const catData = await catRes.json()
          if (Array.isArray(catData) && catData.length > 0) {
            products = catData
            console.log(`[${supermarket}] IS vacío, catalog devolvió ${products.length} productos`)
          }
        }
      } catch {}
    }

    const itemIds = products
      .flatMap((p: any) => p.items || [])
      .map((item: any) => String(item.itemId || ''))
      .filter(Boolean)

    const isCencosudSite = ['Jumbo', 'Disco', 'Vea'].includes(supermarket)
    const host = baseUrl.split('//')[1]

    let promotionsMap: Record<string, any> = {}
    if (itemIds.length > 0) {
      if (isCencosudSite) {
        // Promos de Cencosud vienen del cache en DB (poblado por GitHub Actions via Playwright)
        const cached = await getCencosudPromos(host, itemIds)
        for (const [skuId, promo] of Object.entries(cached)) {
          promotionsMap[skuId] = {
            effectiveDiscount: String(promo.effectiveDiscount),
            code: promo.promoCode,
            primeCode: promo.primePromoCode,
            primeEffectiveDiscount: promo.primeEffectiveDiscount != null ? String(promo.primeEffectiveDiscount) : undefined,
          }
        }
      } else {
        promotionsMap = await fetchVtexPromotions(baseUrl, itemIds, headers)
      }
    }

    const initial = products.map((p: any) => {
      const item = p.items?.[0] || {}
      const offer = item.sellers?.[0]?.commertialOffer || {}

      const rawListPrice = offer.ListPrice || 0
      const salePrice = offer.Price || 0
      // Cencosud tiene ListPrice corrupto (~82x el precio real) en todas sus APIs — ignorarlo siempre.
      // Para otros: usar ListPrice si es razonable (no más de 3x el precio de venta).
      const listPrice = isCencosudSite
        ? salePrice
        : (rawListPrice > 0 && rawListPrice <= salePrice * 3)
          ? rawListPrice
          : (offer.PriceWithoutDiscount || salePrice || 0)
      // Cencosud también tiene spotPrice corrupto (no es precio real al público) — ignorarlo,
      // igual que ListPrice. offer.Price ya viene resuelto con el descuento aplicado.
      const spot = isCencosudSite ? 0 : (offer.spotPrice || 0)
      const available = (offer.AvailableQuantity || 0) > 0

      if (!available || listPrice <= 0) return null

      const priceList = listPrice
      let finalPrice = spot > 0 && spot < salePrice ? spot : salePrice

      const teaserTexts: string[] = (offer.teasers || []).map((t: any) => t.name).filter(Boolean)

      // Clusters sin "Hasta" → promos específicas; con "Hasta" → fallback genérico
      const clusterTexts: string[] = []
      const clusterFallbackTexts: string[] = []
      Object.values(p.clusterHighlights || {}).forEach((val: any) => {
        const name = (typeof val === 'object' ? val.name : String(val)) || ''
        if (!name || name.startsWith('V_T:')) return
        if (/^hasta\s/i.test(name)) {
          clusterFallbackTexts.push(name) // pasar original, parseMultiUnitPromo ya stripea "Hasta"
        } else {
          clusterTexts.push(name)
        }
      })

      // Del cluster, preferir el que parezca una promo real (%, NxM, 2do, 3er, off)
      const promoCluster = clusterTexts.find(c =>
        /\d+\s*%|\d+\s*[xX]\s*\d+|2do|3er|segundo|tercer|\boff\b/i.test(c)
      ) || ''

      // Fallback: mejor cluster "Hasta X%" — strip del prefijo "Hasta "
      const hastaCluster = clusterFallbackTexts
        .map(c => c.replace(/^hasta\s+/i, '').trim())
        .find(c => /\d+\s*%|\d+\s*[xX]\s*\d+|2do|3er|segundo|tercer|\boff\b/i.test(c)) || ''

      // Buscar promo genérica
      const vtexPromo = promotionsMap[item.itemId]
      let multiUnitPromo: MultiUnitPromo | undefined

      const isMultiUnitCode = (code: string) =>
        /2do|3er|segundo|tercer|\d+[xX]\d+/i.test(code)

      const parsePromoEntry = (code: string, effectiveDiscount: string) => {
        const parsed = parseMultiUnitPromo(code, priceList)
        if (parsed && parsed.effectivePrice < finalPrice) return parsed
        // Solo crear multiUnitPromo si el código indica multi-unidad — no para descuentos simples (25%, 35%, etc.)
        if (!isMultiUnitCode(code)) return undefined
        const discount = parseFloat(effectiveDiscount)
        const nxm = code.match(/(\d+)[xX](\d+)/)
        const requiredQty = nxm ? parseInt(nxm[1]) : 2
        if (discount > 0 && discount < 1) {
          return { label: code || 'Promo', effectivePrice: Math.round(priceList * (1 - discount)), requiredQty }
        }
        return undefined
      }

      if (vtexPromo?.code) {
        multiUnitPromo = parsePromoEntry(vtexPromo.code.trim(), vtexPromo.effectiveDiscount)
      }

      // Para Cencosud: si hay effectiveDiscount pero no multiUnitPromo, aplicar el descuento al finalPrice
      if (isCencosudSite && !multiUnitPromo && vtexPromo?.effectiveDiscount) {
        const discount = parseFloat(String(vtexPromo.effectiveDiscount))
        if (discount > 0 && discount < 1) {
          finalPrice = Math.round(priceList * (1 - discount))
        }
      }

      // Para Cencosud sin dato en cache, no usar fallback de clusters (evita datos incorrectos)
      if (!multiUnitPromo && !isCencosudSite) {
        for (const pt of [...teaserTexts, promoCluster, hastaCluster].filter(Boolean)) {
          const candidate = parseMultiUnitPromo(pt, priceList)
          if (candidate && candidate.effectivePrice < finalPrice) {
            multiUnitPromo = candidate
            break
          }
        }
      }

      // Promo Prime (solo Cencosud)
      let primePromo: MultiUnitPromo | undefined
      if (isCencosudSite && vtexPromo?.primeCode) {
        primePromo = parsePromoEntry(vtexPromo.primeCode.trim(), vtexPromo.primeEffectiveDiscount || '0')
      }

      // Para Cencosud: solo mostrar texto si hay dato en cache (evita clusters incorrectos)
      const cencosudSimplePromo = isCencosudSite && !multiUnitPromo && vtexPromo?.effectiveDiscount && parseFloat(String(vtexPromo.effectiveDiscount)) > 0
        ? (vtexPromo.code && vtexPromo.code !== 'Oferta' ? vtexPromo.code : `${Math.round(parseFloat(String(vtexPromo.effectiveDiscount)) * 100)}% OFF`)
        : undefined
      let promoText = isCencosudSite
        ? (multiUnitPromo?.label || cencosudSimplePromo || (primePromo ? 'Solo Prime' : '-'))
        : (multiUnitPromo?.label || teaserTexts[0] || promoCluster || hastaCluster || '-')
      if (promoText === '-') {
        if (spot > 0 && spot < salePrice) {
          promoText = `${Math.round((1 - spot / salePrice) * 100)}% OFF`
        } else if (priceList > finalPrice * 1.04) {
          promoText = `${Math.round((1 - finalPrice / priceList) * 100)}% OFF`
        }
      }
      // JumboChecks: detectar por nombre de cluster (patrón check100/check70/check50)
      let jumboCheck: number | undefined
      if (supermarket === 'Jumbo') {
        for (const val of Object.values(p.clusterHighlights || {})) {
          const name = (typeof val === 'object' ? (val as any).name : String(val)) || ''
          const m = name.match(/check(\d+)/i)
          if (m) { jumboCheck = parseInt(m[1]); break }
        }
      }

      const productUrl = p.linkText ? `${baseUrl}/${p.linkText}/p` : ''
      return {
        ean: String(item.ean || ''),
        id: `${supermarket.toLowerCase()}-${item.itemId || p.productId}`,
        supermarket,
        name: p.productName || 'Sin nombre',
        brand: p.brand || '-',
        price: priceList,
        finalPrice,
        discountText: promoText,
        imageUrl: item.images?.[0]?.imageUrl || '',
        url: productUrl || baseUrl,
        multiUnitPromo,
        primePromo,
        jumboCheck,
        vtexCategoryId: p.categoriesIds?.[0] || p.categoryId || '',
        vtexCategory: p.categories?.[0] || '',
        excludedFromBankPromos: isExcludedFromBankPromos(p),
      }
    }).filter(Boolean) as NormalizedProduct[]

    // Para tiendas no-Cencosud con búsqueda de texto: enriquecer con promo data por EAN
    // VTEX IS no siempre incluye teasers en text search → segunda consulta por EAN al catalog API
    let result = initial
    if (!isCencosudSite && !isCategory) {
      const toEnrich = initial.filter(p => p.discountText === '-' && p.ean && p.ean.length >= 8)
      if (toEnrich.length > 0) {
        const enriched = await Promise.all(
          toEnrich.map(p => searchVtexByEan(p.ean, supermarket, baseUrl))
        )
        const enrichMap = new Map<string, NormalizedProduct>()
        enriched.flat().forEach(p => enrichMap.set(p.ean, p))
        result = initial.map(p => {
          if (p.discountText !== '-' || !enrichMap.has(p.ean)) return p
          const e = enrichMap.get(p.ean)!
          return { ...p, discountText: e.discountText, finalPrice: e.finalPrice, multiUnitPromo: e.multiUnitPromo }
        })
      }

      // Checkout simulation para promos de multi-unidad (2da al X%, 3era gratis, etc.)
      // VTEX IS no devuelve estas promos con qty=1 — aparecen solo al simular qty=2
      const needsSim = result.filter(p => p.discountText === '-')
      if (needsSim.length > 0) {
        result = await enrichWithCheckoutSim(result, baseUrl, headers)
      }
    }

    if (result.length > 0) console.log(`[${supermarket}] ${result.length} productos para "${query}"`)
    return result
  } catch (error) {
    console.error(`Error ${supermarket} completo:`, error)
    return []
  }
}

// ---------------------------------------------------------
// OPENFARMA (Spree Commerce v1)
// Taxones principales: 4098=Medicamentos, 1569=Dermocosmetica, 1740=Suplementos,
//   1713=Cuidado Personal, 1604=Maquillaje, 1639=Bebes, 4073=Diabetes
// ---------------------------------------------------------
const OPENFARMA_TAXON_MAP: Record<string, string> = {
  'analgesicos':           '4099',
  'analgésicos':           '4099',
  'digestivos':            '4101',
  'antimicoticos':         '4162',
  'antimicóticos':         '4162',
  'medicamentos':          '4098',
  'vitaminas-y-suplementos': '1740',
  'suplementos':           '1740',
  'dermocosmetica':        '1569',
  'dermocosmética':        '1569',
  'higiene-personal':      '1713',
  'cuidado-personal':      '1713',
  'bebe-y-embarazo':       '1639',
  'bebes-y-maternidad':    '1639',
  'maquillaje':            '1604',
  'diabetes':              '4073',
}

async function searchOpenFarma(query: string, taxonSlug?: string): Promise<NormalizedProduct[]> {
  try {
    const BASE = 'https://www.openfarma.com.ar'
    let url: string

    if (taxonSlug) {
      const taxonId = OPENFARMA_TAXON_MAP[taxonSlug.toLowerCase()] || OPENFARMA_TAXON_MAP[taxonSlug]
      if (taxonId) {
        url = `${BASE}/api/v1/products?q%5Btaxons_id_in%5D%5B%5D=${taxonId}&per_page=40&q%5Bs%5D=name+asc`
      } else {
        url = `${BASE}/api/v1/products?q%5Bname_cont%5D=${encodeURIComponent(query)}&per_page=40`
      }
    } else {
      url = `${BASE}/api/v1/products?q%5Bname_cont%5D=${encodeURIComponent(query)}&per_page=40`
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    if (!res.ok) {
      console.error('[OpenFarma] HTTP', res.status, url)
      return []
    }
    const data = await res.json()
    const products: any[] = data.products ?? []
    console.log(`[OpenFarma] ${products.length} productos para "${query}"`)

    return products
      .filter(p => parseFloat(p.price ?? '0') > 0 && p.total_on_hand > 0)
      .map(p => {
        const price = parseFloat(p.price)
        // Imagen: buscar en master.images o images directo
        const imgs = p.master?.images ?? p.images ?? []
        const img = imgs[0]?.product_url ?? imgs[0]?.small_url ?? imgs[0]?.thumb_url ?? ''
        return {
          ean: p.master?.sku ?? p.id.toString(),
          id: p.id.toString(),
          supermarket: 'OpenFarma',
          name: p.name ?? '',
          brand: '',
          price,
          finalPrice: price,
          discountText: '',
          imageUrl: img,
          url: `${BASE}/${p.slug}/p`,
        } as NormalizedProduct
      })
  } catch (e) {
    console.error('[OpenFarma]', e)
    return []
  }
}

// ---------------------------------------------------------
// FARMATODO (Next.js RSC - initialData en la respuesta)
// Endpoint: /buscar?product=QUERY con header RSC:1
// ---------------------------------------------------------
async function searchFarmatodo(query: string): Promise<NormalizedProduct[]> {
  try {
    const BASE = 'https://www.farmatodo.com.ar'
    const url = `${BASE}/buscar?product=${encodeURIComponent(query)}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      headers: {
        'RSC': '1',
        'Accept': 'text/x-component',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) return []
    const txt = await res.text()

    // Extraer initialData.results del RSC payload
    const idx = txt.indexOf('"initialData":{')
    if (idx < 0) return []
    // Buscar el array results dentro de initialData
    const resultsIdx = txt.indexOf('"results":[', idx)
    if (resultsIdx < 0) return []

    // Parsear el array manualmente extrayendo objetos individuales
    const products: NormalizedProduct[] = []
    let pos = resultsIdx + '"results":['.length

    while (pos < txt.length && txt[pos] !== ']') {
      if (txt[pos] !== '{') { pos++; continue }
      // Encontrar el fin del objeto (balancear llaves)
      let depth = 0, end = pos
      for (; end < txt.length; end++) {
        if (txt[end] === '{') depth++
        else if (txt[end] === '}') { depth--; if (depth === 0) { end++; break } }
      }
      try {
        const obj = JSON.parse(txt.slice(pos, end))
        if (!obj.hasStock) { pos = end; continue }
        const price = obj.fullPrice ?? 0
        const finalPrice = obj.offerPrice > 0 ? obj.offerPrice : price
        if (finalPrice <= 0) { pos = end; continue }
        products.push({
          ean: obj.barcode ?? obj.id,
          id: obj.id,
          supermarket: 'Farmatodo',
          name: obj.mediaDescription ?? obj.grayDescription ?? '',
          brand: obj.brand ?? '',
          price,
          finalPrice,
          discountText: obj.offerPrice > 0 ? `${Math.round((1 - obj.offerPrice / price) * 100)}% OFF` : '',
          imageUrl: obj.mediaImageUrl ?? '',
          url: `${BASE}/producto/${obj.id}`,
        } as NormalizedProduct)
      } catch {}
      pos = end
    }

    console.log(`[Farmatodo] ${products.length} productos para "${query}"`)
    return products
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error('[Farmatodo]', err.message)
    return []
  }
}

// ---------------------------------------------------------
// CENTRAL OESTE (Magento 2 - HTML parsing)
// EAN extraído del slug de URL cuando empieza con dígitos
// ---------------------------------------------------------
async function searchCentralOeste(query: string): Promise<NormalizedProduct[]> {
  try {
    const BASE = 'https://www.centraloeste.com.ar'
    const url = `${BASE}/catalogsearch/result/?q=${encodeURIComponent(query)}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) return []
    const html = await res.text()

    // Extraer bloques de producto
    const itemRegex = /<li[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/li>/g
    const products: NormalizedProduct[] = []
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(html)) !== null) {
      const block = match[1]

      const nameMatch = block.match(/class="product-item-link"[^>]*>([^<]+)</)
      const priceMatch = block.match(/data-price-amount="([\d.]+)"/)
      const imgMatch = block.match(/class="product-image-photo"[^>]*src="([^"]+)"/)
      const urlMatch = block.match(/class="product-item-link"[^>]*href="([^"]+)"/)

      if (!nameMatch || !priceMatch || !urlMatch) continue

      const price = parseFloat(priceMatch[1])
      if (price <= 0) continue

      // EAN desde el slug de la URL: 7796285297107-nombre-producto.html
      const slug = urlMatch[1].split('/').pop() ?? ''
      const eanMatch = slug.match(/^(\d{8,14})-/)
      const ean = eanMatch ? eanMatch[1] : slug.replace('.html', '')

      products.push({
        ean,
        id: ean,
        supermarket: 'Central Oeste',
        name: nameMatch[1].trim(),
        brand: '',
        price,
        finalPrice: price,
        discountText: '',
        imageUrl: imgMatch?.[1] ?? '',
        url: urlMatch[1],
      } as NormalizedProduct)
    }

    console.log(`[CentralOeste] ${products.length} productos para "${query}"`)
    return products
  } catch (err: any) {
    if (err.name !== 'AbortError') console.error('[CentralOeste]', err.message)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const cat = searchParams.get('cat')
  const section = searchParams.get('section') || 'supermercados'
  const storesParam = searchParams.get('stores')
  const activeStores = storesParam
    ? new Set(storesParam.split(',').map(s => s.trim()).filter(Boolean))
    : new Set(['Coto', 'Carrefour', 'Jumbo', 'Disco', 'Vea', 'Changomas', 'Más Online', 'Dia'])
  const has = (store: string) => activeStores.has(store)

  if (!q && !cat) {
    return NextResponse.json({ error: 'Missing query or category' }, { status: 400 })
  }

  const isSuper = section === 'supermercados'
  const isFarma = section === 'farmacias'
  const isElectro = section === 'electrónica'

  try {
    let cotoQ = q || '', carrQ = q || '', cencoQ = q || '', diaQ = q || '', walmartQ = q || '', farmaQ = q || ''
    let vtexMap = 'c'
    let isCategory = !!cat

    // Para electrónica con categoría: query derivada del nodo
    let electroQ = q || ''

    if (cat) {
      const node = findCategoryNode(cat)
      if (node) {
        if (isFarma) {
          farmaQ = node.farmaSlug || node.name
        } else if (isElectro) {
          electroQ = node.electroSlug || node.name
        } else {
          cotoQ = node.name
          carrQ = node.carrefourId || ''
          cencoQ = node.name
          diaQ = node.name
          walmartQ = node.name
          vtexMap = node.vtexMap || 'c'
        }
      } else {
        return NextResponse.json({ error: 'Category not mapped' }, { status: 404 })
      }
    }

    let allProducts: NormalizedProduct[] = []

    if (isSuper) {
      const [coto, carrefour, jumbo, disco, vea, dia, masOnline, changomas, theFoodMarket, cordiez, coope, toledo, depot] = await Promise.all([
        (has('Coto') && cotoQ) ? searchCoto(cotoQ, false) : Promise.resolve([]),
        (has('Carrefour') && carrQ) ? searchCarrefour(carrQ, isCategory) : Promise.resolve([]),
        (has('Jumbo') && cencoQ) ? searchVtexIS(cencoQ, false, 'Jumbo', 'https://www.jumbo.com.ar', vtexMap) : Promise.resolve([]),
        (has('Disco') && cencoQ) ? searchVtexIS(cencoQ, false, 'Disco', 'https://www.disco.com.ar', vtexMap) : Promise.resolve([]),
        (has('Vea') && cencoQ) ? searchVtexIS(cencoQ, false, 'Vea', 'https://www.vea.com.ar', vtexMap) : Promise.resolve([]),
        (has('Dia') && diaQ) ? searchVtexIS(diaQ, false, 'Dia', 'https://diaonline.supermercadosdia.com.ar', vtexMap) : Promise.resolve([]),
        (has('Más Online') && walmartQ) ? searchVtexIS(walmartQ, false, 'Más Online', 'https://www.masonline.com.ar', vtexMap) : Promise.resolve([]),
        (has('Changomas') && walmartQ) ? searchVtexIS(walmartQ, false, 'Changomas', 'https://www.changomas.com.ar', vtexMap) : Promise.resolve([]),
        (has('The Food Market') && q) ? searchVtexIS(q, isCategory, 'The Food Market', 'https://www.thefoodmarket.com.ar', vtexMap) : Promise.resolve([]),
        (has('Cordiez') && q) ? searchVtexCatalog(q, 'Cordiez', 'https://www.cordiez.com.ar') : Promise.resolve([]),
        (has('Cooperativa Obrera') && q) ? searchCoopeEnCasa(q) : Promise.resolve([]),
        (has('Toledo Digital') && q) ? searchVtexIS(q, isCategory, 'Toledo Digital', 'https://www.toledodigital.com.ar', vtexMap) : Promise.resolve([]),
        (has('Depot Express') && q) ? searchWooCommerceStore(q, 'Depot Express', 'https://depotexpress.com.ar') : Promise.resolve([]),
      ])
      allProducts = [...coto, ...carrefour, ...jumbo, ...disco, ...vea, ...dia, ...masOnline, ...changomas, ...theFoodMarket, ...cordiez, ...coope, ...toledo, ...depot]
    }

    if (isElectro) {
      // ML corre en paralelo con el resto — no después (evita timeout si algún store cuelga)
      const [megatone, fravega, naldo, coppel, rodo, easy, carrefour, coto, jumbo, disco, vea, masOnline, changomas, dia, mlProducts] = await Promise.all([
        electroQ ? searchMegatone(electroQ) : Promise.resolve([]),
        electroQ ? searchVtexCatalog(electroQ, 'Frávega', 'https://www.fravega.com') : Promise.resolve([]),
        electroQ ? searchVtexCatalog(electroQ, 'Naldo', 'https://www.naldo.com.ar') : Promise.resolve([]),
        electroQ ? searchVtexCatalog(electroQ, 'Coppel', 'https://www.coppel.com.ar') : Promise.resolve([]),
        electroQ ? searchRodo(electroQ) : Promise.resolve([]),
        electroQ ? searchEasy(electroQ) : Promise.resolve([]),
        electroQ ? searchCarrefour(electroQ, false) : Promise.resolve([]),
        electroQ ? searchCoto(electroQ, false) : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Jumbo', 'https://www.jumbo.com.ar', 'c') : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Disco', 'https://www.disco.com.ar', 'c') : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Vea', 'https://www.vea.com.ar', 'c') : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Más Online', 'https://www.masonline.com.ar', 'c') : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Changomas', 'https://www.changomas.com.ar', 'c') : Promise.resolve([]),
        electroQ ? searchVtexIS(electroQ, false, 'Dia', 'https://diaonline.supermercadosdia.com.ar', 'c') : Promise.resolve([]),
        Promise.resolve([]), // ML se busca client-side (IPs de Vercel bloqueadas)
      ])
      console.log(`[Electro] "${electroQ}" → Megatone:${megatone.length} Frávega:${fravega.length} Naldo:${naldo.length} Coppel:${coppel.length} Rodo:${rodo.length} Easy:${easy.length} ML:${mlProducts.length}`)
      allProducts = [...megatone, ...fravega, ...naldo, ...coppel, ...rodo, ...easy, ...carrefour, ...coto, ...jumbo, ...disco, ...vea, ...masOnline, ...changomas, ...dia, ...mlProducts]
    }

    if (isFarma) {
      const openFarmaSlug = cat ? findCategoryNode(cat)?.farmaSlug : undefined
      const t0 = Date.now()
      const timed = (name: string, p: Promise<NormalizedProduct[]>) =>
        p.then(r => { console.log(`[Precios] ${name}: ${Date.now() - t0}ms → ${r.length} productos`); return r })
          .catch(() => { console.log(`[Precios] ${name}: ERROR ${Date.now() - t0}ms`); return [] as NormalizedProduct[] })
      const [farmacity, farmaplus, openfarma, farmatodo, centralOeste] = await Promise.all([
        farmaQ ? timed('Farmacity', searchVtexIS(farmaQ, false, 'Farmacity', 'https://www.farmacity.com', vtexMap)) : Promise.resolve([]),
        farmaQ ? timed('Farmaplus', searchVtexIS(farmaQ, false, 'Farmaplus', 'https://www.farmaplus.com.ar', vtexMap)) : Promise.resolve([]),
        farmaQ ? timed('OpenFarma', searchOpenFarma(farmaQ, openFarmaSlug)) : Promise.resolve([]),
        farmaQ ? timed('Farmatodo', searchFarmatodo(farmaQ)) : Promise.resolve([]),
        farmaQ ? timed('Central Oeste', searchCentralOeste(farmaQ)) : Promise.resolve([]),
      ])
      allProducts = [...farmacity, ...farmaplus, ...openfarma, ...farmatodo, ...centralOeste]
    }

    allProducts = allProducts.filter(p => p.finalPrice > 0)

    // Exclusiones de promos bancarias — aplicar reglas por supermercado
    allProducts = allProducts.map(p => {
      if (p.excludedFromBankPromos) return p  // ya marcado por la función del scraper (ej. Coto)
      let excluded = false
      if (p.supermarket === 'Carrefour') excluded = isCarrefourExcludedFromBankPromos(p)
      // Regla general: si el super ya tiene su propia promo sobre el producto, no se acumula con banco
      if (!excluded && (p.price > p.finalPrice || !!p.multiUnitPromo)) excluded = true
      return excluded ? { ...p, excludedFromBankPromos: true } : p
    })

    // Para búsquedas de texto libre: descartar productos irrelevantes.
    // VTEX IS a veces devuelve top-sellers sin relación con la query.
    // Para electrónica SIEMPRE filtramos (cat o no) porque electroQ es siempre texto libre.
    const relevanceQ = isElectro ? electroQ : q
    if (relevanceQ && (!cat || isElectro)) {
      const before = allProducts.length
      allProducts = allProducts.filter(p => isRelevantForQuery(p.name, relevanceQ))
      const after = allProducts.length
      if (before !== after) console.log(`[Relevance] ${before} → ${after} (filtró ${before - after} irrelevantes para "${relevanceQ}")`)
    }

    // Electrónica: sin agrupamiento — cada producto de cada tienda es una tarjeta independiente
    if (isElectro) {
      const results = allProducts
        .sort((a, b) => a.finalPrice - b.finalPrice)
        .map(p => ({
          ean: p.id, // usar ID como key única
          name: p.name,
          brand: p.brand,
          imageUrl: p.imageUrl,
          minPrice: p.finalPrice,
          maxPrice: p.price,
          bestMarket: p.supermarket,
          availableIn: 1,
          markets: { [p.supermarket]: p },
        }))
      return NextResponse.json({ query: q, groupedCount: results.length, rawCount: allProducts.length, results })
    }

    // Agrupamiento por EAN (Consolidación) — solo para supermercados y farmacias
    const grouped = new Map<string, any>()
    
    allProducts.forEach(p => {
      // Si no tiene EAN válido, usamos su nombre normalizado como clave temporal
      const groupKey = (p.ean && p.ean.length >= 8) ? p.ean : p.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          imageUrl: p.imageUrl,
          excludedFromBankPromos: false,
          excludedFromBankPromos: p.excludedFromBankPromos ?? false,
          markets: {}
        })
      }

      const g = grouped.get(groupKey)
      // Si cualquier fuente marca el producto como excluido, lo marcamos a nivel grupo Y en el market específico
      if (p.excludedFromBankPromos) g.excludedFromBankPromos = true
      // Si el súper actual ya tiene este producto y este es MÁS BARATO, lo pisamos (por si el scraper trajo duplicados de la misma tienda)
      if (!g.markets[p.supermarket] || g.markets[p.supermarket].finalPrice > p.finalPrice) {
         g.markets[p.supermarket] = p  // p ya incluye excludedFromBankPromos por market
      }
    })

    // Convertir el mapa a array y calcular estadísticas
    const results = Array.from(grouped.values()).map(g => {
       const marketKeys = Object.keys(g.markets)
       const prices = marketKeys.map(k => g.markets[k].finalPrice)
       const minPrice = Math.min(...prices)
       const maxPrice = Math.max(...prices)
       const bestMarket = marketKeys.find(k => g.markets[k].finalPrice === minPrice) || ''
       
       return {
         ...g,
         minPrice,
         maxPrice,
         bestMarket,
         availableIn: marketKeys.length
       }
    }).sort((a, b) => isElectro
      ? a.minPrice - b.minPrice  // Electrónica: precio más bajo primero
      : b.availableIn - a.availableIn) // Supermercados: más disponibilidad primero

    return NextResponse.json({
      query: q || cat,
      groupedCount: results.length,
      rawCount: allProducts.length,
      results
    })
  } catch (error: any) {
    console.error("Search Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

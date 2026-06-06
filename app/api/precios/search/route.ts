import { NextResponse } from 'next/server'
import { findCategoryNode } from '../../../precios/categories'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

interface MultiUnitPromo {
  label: string
  effectivePrice: number
  requiredQty: number
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
  return name.includes(mainWord)
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
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []

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
        }
      }).filter(Boolean)
    }) as NormalizedProduct[]
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

  // Usar access token del env si todavía es válido (bootstrapping)
  const envToken = process.env.ML_ACCESS_TOKEN
  if (envToken && !mlTokenCache) {
    mlTokenCache = { token: envToken, expiresAt: Date.now() + 5 * 60 * 60 * 1000 } // asumir 5h
    return envToken
  }

  // Renovar con refresh token
  const clientId = process.env.ML_CLIENT_ID
  const clientSecret = process.env.ML_CLIENT_SECRET
  const refreshToken = process.env.ML_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    const res = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return envToken || null
    const data = await res.json()
    mlTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 }
    return data.access_token
  } catch { return envToken || null }
}

async function searchMercadoLibre(query: string): Promise<NormalizedProduct[]> {
  try {
    const token = await getMlToken()
    if (!token) return []
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=50&condition=new`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
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

    return Array.from(seen.values()).slice(0, 20).map((item: any) => {
      const price = item.price || 0
      const originalPrice = item.original_price || price
      let discountText = '-'
      if (originalPrice > price) {
        const pct = Math.round((1 - price / originalPrice) * 100)
        if (pct > 0) discountText = `${pct}% OFF`
      }

      const storeName = item.official_store_name
        ? `ML · ${item.official_store_name}`
        : 'MercadoLibre'

      return {
        ean: '',
        id: `ml-${item.id}`,
        supermarket: storeName,
        name: item.title || 'Sin nombre',
        brand: '-',
        price: originalPrice,
        finalPrice: price,
        discountText,
        imageUrl: (item.thumbnail || '').replace('I.jpg', 'O.jpg'), // imagen más grande
        url: item.permalink || 'https://www.mercadolibre.com.ar',
        multiUnitPromo: undefined,
      }
    }) as NormalizedProduct[]
  } catch {
    return []
  }
}

// ---------------------------------------------------------
// MEGATONE (HTML scraping + API de precios por SKU)
// Los productos vienen embebidos en el HTML como GlobalListado.Productos
// Los precios se obtienen por SKU via /apirecursoswebv2/api/Productos/Obtener
// ---------------------------------------------------------
async function searchMegatone(query: string): Promise<NormalizedProduct[]> {
  try {
    // Solo funciona para búsquedas de una sola palabra (marcas: samsung, lg, philips, etc.)
    const words = query.trim().split(/\s+/)
    const slug = words[0].toLowerCase()
    const htmlUrl = `https://www.megatone.net/landing/${encodeURIComponent(slug)}/`
    const res = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'es-AR,es;q=0.9',
        'Referer': 'https://www.megatone.net/',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    console.log(`[Megatone] ${htmlUrl} → ${res.status}`)
    if (!res.ok) return []
    const html = await res.text()

    // Extraer GlobalListado.Productos del HTML
    const match = html.match(/Productos:\s*(\[[\s\S]*?\])\s*,\s*(?:Paginado|Filtros)/)
    if (!match) return []

    // El array usa sintaxis JS (comillas simples, sin comillas en keys) — convertir a JSON válido
    let productos: any[]
    try {
      // Intentar JSON directo primero
      productos = JSON.parse(match[1])
    } catch {
      try {
        // Extraer productos con regex más simple — solo SKU, Nombre, URL, Imagen, Marca
        const items: any[] = []
        const itemRe = /\{SKU:"([^"]+)",ID:(\d+),Nombre:'([^']+)',URL:"([^"]+)",Imagen:"([^"]+)",Marca:\{[^}]*Descripcion:"([^"]+)"/g
        let m2
        while ((m2 = itemRe.exec(match[1])) !== null) {
          items.push({ SKU: m2[1], ID: parseInt(m2[2]), Nombre: m2[3], URL: m2[4], Imagen: m2[5], Marca: { Descripcion: m2[6] } })
        }
        productos = items
      } catch { return [] }
    }

    if (!productos.length) return []

    // Extraer precios del HTML usando el onclick de gtmClickProductoListado
    // Formato: gtmClickProductoListado("SKU", pos, precio, nombre, ...)
    const priceMap: Record<string, number> = {}
    const priceRe = /gtmClickProductoListado\("([^"]+)",\d+,(\d+(?:\.\d+)?),/g
    let pm
    while ((pm = priceRe.exec(html)) !== null) {
      priceMap[pm[1]] = parseFloat(pm[2])
    }

    return productos.slice(0, 15).map((p: any) => {
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
        multiUnitPromo: parseMultiUnitPromo(discountText, pList)
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
    let url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=14`
    if (isCategory) {
      url = `https://www.carrefour.com.ar/api/catalog_system/pub/products/search?fq=C:${query}&_from=0&_to=14&O=OrderByTopSaleDESC`
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
      const teasers = offer.Teasers?.map((t: any) => t.Name) || []
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
        url: `https://www.carrefour.com.ar${p.link || ''}`,
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

async function searchVtexIS(query: string, isCategory: boolean, supermarket: string, baseUrl: string, vtexMap: string = 'c'): Promise<NormalizedProduct[]> {
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
    
    const res = await fetch(url, { headers })
    if (!res.ok) return []

    const data = await res.json()
    let products = data.products || []

    // Fallback al Catalog Search si IS no devuelve resultados
    if (products.length === 0 && !isCategory) {
      try {
        const catUrl = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encoded}&_from=0&_to=14`
        const catRes = await fetch(catUrl, { headers })
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
      const spot = offer.spotPrice || 0
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
      }
    }).filter(Boolean) as NormalizedProduct[]

    return initial
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
  const section = searchParams.get('section') || 'supermercados' // 'supermercados' | 'farmacias'

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

    if (cat) {
      const node = findCategoryNode(cat)
      if (node) {
        if (isFarma) {
          farmaQ = node.farmaSlug || node.name
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
      const [coto, carrefour, jumbo, disco, vea, dia, masOnline, changomas] = await Promise.all([
        cotoQ ? searchCoto(cotoQ, false) : Promise.resolve([]),
        carrQ ? searchCarrefour(carrQ, isCategory) : Promise.resolve([]),
        cencoQ ? searchVtexIS(cencoQ, false, 'Jumbo', 'https://www.jumbo.com.ar', vtexMap) : Promise.resolve([]),
        cencoQ ? searchVtexIS(cencoQ, false, 'Disco', 'https://www.disco.com.ar', vtexMap) : Promise.resolve([]),
        cencoQ ? searchVtexIS(cencoQ, false, 'Vea', 'https://www.vea.com.ar', vtexMap) : Promise.resolve([]),
        diaQ ? searchVtexIS(diaQ, false, 'Dia', 'https://diaonline.supermercadosdia.com.ar', vtexMap) : Promise.resolve([]),
        walmartQ ? searchVtexIS(walmartQ, false, 'Más Online', 'https://www.masonline.com.ar', vtexMap) : Promise.resolve([]),
        walmartQ ? searchVtexIS(walmartQ, false, 'Changomas', 'https://www.changomas.com.ar', vtexMap) : Promise.resolve([]),
      ])
      allProducts = [...coto, ...carrefour, ...jumbo, ...disco, ...vea, ...dia, ...masOnline, ...changomas]
    }

    if (isElectro) {
      const [megatone, fravega, naldo, coppel, rodo, easy, carrefour, coto, jumbo, disco, vea, masOnline, changomas, dia] = await Promise.all([
        q ? searchMegatone(q) : Promise.resolve([]),
        q ? searchVtexCatalog(q, 'Frávega', 'https://www.fravega.com') : Promise.resolve([]),
        q ? searchVtexCatalog(q, 'Naldo', 'https://www.naldo.com.ar') : Promise.resolve([]),
        q ? searchVtexCatalog(q, 'Coppel', 'https://www.coppel.com.ar') : Promise.resolve([]),
        q ? searchRodo(q) : Promise.resolve([]),
        q ? searchEasy(q) : Promise.resolve([]),
        q ? searchCarrefour(q, false) : Promise.resolve([]),
        q ? searchCoto(q, false) : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Jumbo', 'https://www.jumbo.com.ar', 'c') : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Disco', 'https://www.disco.com.ar', 'c') : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Vea', 'https://www.vea.com.ar', 'c') : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Más Online', 'https://www.masonline.com.ar', 'c') : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Changomas', 'https://www.changomas.com.ar', 'c') : Promise.resolve([]),
        q ? searchVtexIS(q, false, 'Dia', 'https://diaonline.supermercadosdia.com.ar', 'c') : Promise.resolve([]),
      ])
      // ML se agrega por separado — múltiples vendedores, se trata diferente en la UI
      const mlProducts = q ? await searchMercadoLibre(q) : []
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

    // Para búsquedas de texto libre: descartar productos irrelevantes.
    // VTEX IS a veces devuelve top-sellers sin relación con la query ("tostador 2 panes" → lavandina).
    if (q && !cat) {
      const before = allProducts.length
      allProducts = allProducts.filter(p => isRelevantForQuery(p.name, q))
      const after = allProducts.length
      if (before !== after) console.log(`[Relevance] ${before} → ${after} (filtró ${before - after} irrelevantes para "${q}")`)
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
          // Guardaremos los resultados de cada supermercado en un diccionario
          markets: {}
        })
      }
      
      const g = grouped.get(groupKey)
      // Si el súper actual ya tiene este producto y este es MÁS BARATO, lo pisamos (por si el scraper trajo duplicados de la misma tienda)
      if (!g.markets[p.supermarket] || g.markets[p.supermarket].finalPrice > p.finalPrice) {
         g.markets[p.supermarket] = p
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

import { NextResponse } from 'next/server'
import { findCategoryNode } from '../../../precios/categories'
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

  // "2do al XX%" o "segundo al XX%"
  const segundo = t.match(/(?:2do|segundo)\s+al\s+(\d+)\s*%/)
  if (segundo) {
    const pct = parseInt(segundo[1])
    const effectivePrice = Math.round((price + price * pct / 100) / 2)
    return { label: `2do al ${pct}%`, effectivePrice, requiredQty: 2 }
  }

  // "3er al XX%"
  const tercer = t.match(/(?:3er|tercer)\s+al\s+(\d+)\s*%/)
  if (tercer) {
    const pct = parseInt(tercer[1])
    const effectivePrice = Math.round((price * 2 + price * pct / 100) / 3)
    return { label: `3er al ${pct}%`, effectivePrice, requiredQty: 3 }
  }

  return undefined
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json"
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
// Cache de sesiones por supermarket (dura 10 minutos)
const sessionCache: Record<string, { cookies: string; ts: number }> = {}

async function getVtexSession(baseUrl: string, headers: any): Promise<string> {
  const cached = sessionCache[baseUrl]
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) return cached.cookies

  try {
    const res = await fetch(baseUrl + '/', { headers, redirect: 'follow', cache: 'no-store' })
    const setCookies = res.headers.getSetCookie?.() || []
    const cookies = setCookies.map(c => c.split(';')[0]).join('; ')
    sessionCache[baseUrl] = { cookies, ts: Date.now() }
    return cookies
  } catch {
    return ''
  }
}

// ---------------------------------------------------------
async function fetchCencosudProductPromo(baseUrl: string, itemId: string, price: number, headers: any): Promise<MultiUnitPromo | undefined> {
  try {
    const sessionCookies = await getVtexSession(baseUrl, headers)
    const url = `${baseUrl}/api/catalog_system/pub/products/search?fq=skuId:${itemId}`
    const res = await fetch(url, {
      headers: { ...headers, 'Referer': baseUrl + '/', 'Cookie': sessionCookies },
      cache: 'no-store'
    })
    if (!res.ok) return undefined
    const data = await res.json()
    const product = Array.isArray(data) ? data[0] : null
    if (!product) return undefined

    const item = product.items?.find((i: any) => String(i.itemId) === String(itemId)) || product.items?.[0]
    const offer = item?.sellers?.[0]?.commertialOffer
    if (!offer) return undefined

    const teasers: string[] = (offer.Teasers || offer.teasers || []).map((t: any) => t.Name || t.name).filter(Boolean)
    const spot = offer.spotPrice || 0

    // Clusters del catalog (más completos que el IS search)
    const catalogClusters: string[] = Object.values(product.clusterHighlights || {})
      .map((v: any) => String(v))
      .filter(n => n && !n.startsWith('V_T:') && !/^hasta\s/i.test(n))

    for (const t of [...teasers, ...catalogClusters]) {
      const promo = parseMultiUnitPromo(t, price)
      if (promo) return promo
    }
    if (spot > 0 && spot < price) {
      return { label: `${Math.round((1 - spot / price) * 100)}% OFF`, effectivePrice: Math.round(spot), requiredQty: 1 }
    }
  } catch {
    // silencioso
  }
  return undefined
}

// ---------------------------------------------------------
async function fetchVtexPromotions(baseUrl: string, headers: any): Promise<Record<string, any>> {
  try {
    const h = { ...headers, 'Referer': baseUrl + '/', 'Origin': baseUrl, 'Content-Type': 'application/json' }
    const res = await fetch(`${baseUrl}/_v/search-promotions`, { method: 'POST', headers: h, body: '{}' })
    if (!res.ok) return {}
    const data = await res.json()
    return data?.promotions?.generic?.promotions || {}
  } catch {
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
    
    const [res, promotionsMap] = await Promise.all([
      fetch(url, { headers }),
      fetchVtexPromotions(baseUrl, headers)
    ])

    if (!res.ok) return []

    const data = await res.json()
    const products = data.products || []

    const initial = products.map((p: any) => {
      const item = p.items?.[0] || {}
      const offer = item.sellers?.[0]?.commertialOffer || {}

      const rawListPrice = offer.ListPrice || 0
      const salePrice = offer.Price || 0
      // ListPrice válido solo si es razonable (no más de 3x el precio de venta)
      const listPrice = (rawListPrice > 0 && rawListPrice <= salePrice * 3)
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

      // Buscar promo: 1) itemId en search-promotions 2) teasers 3) clusters sin "Hasta"
      const vtexPromo = promotionsMap[item.itemId]
      let multiUnitPromo: MultiUnitPromo | undefined
      if (vtexPromo?.effectiveDiscount) {
        const discount = parseFloat(vtexPromo.effectiveDiscount)
        const code = (vtexPromo.code || '').trim()
        const nxm = code.match(/(\d+)[xX](\d+)/)
        const requiredQty = nxm ? parseInt(nxm[1]) : 2
        multiUnitPromo = {
          label: code || vtexPromo.name?.split('|')[0].trim() || 'Promo',
          effectivePrice: Math.round(priceList * (1 - discount)),
          requiredQty,
        }
      }
      if (!multiUnitPromo) {
        for (const pt of [...teaserTexts, ...clusterTexts]) {
          multiUnitPromo = parseMultiUnitPromo(pt, priceList)
          if (multiUnitPromo) break
        }
      }
      // Fallback: clusters con "Hasta" (genéricos de categoría)
      if (!multiUnitPromo) {
        for (const pt of clusterFallbackTexts) {
          multiUnitPromo = parseMultiUnitPromo(pt, priceList)
          if (multiUnitPromo) break
        }
      }

      let promoText = multiUnitPromo?.label || teaserTexts[0] || clusterTexts[0] || '-'
      if (promoText === '-' && priceList > finalPrice) {
        promoText = `${Math.round((1 - finalPrice / priceList) * 100)}% OFF`
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
        _productUrl: productUrl,
        _itemId: String(item.itemId || ''),
      }
    }).filter(Boolean) as any[]

    // Segundo paso: para productos sin promo, fetchear página del producto en paralelo
    const withoutPromo = initial.filter((p: any) => !p.multiUnitPromo && p._productUrl)
    if (withoutPromo.length > 0) {
      const fetched = await Promise.all(
        withoutPromo.map((p: any) => fetchCencosudProductPromo(baseUrl, p._itemId, p.price, headers))
      )
      fetched.forEach((promo: any, i: number) => {
        if (promo) {
          withoutPromo[i].multiUnitPromo = promo
          withoutPromo[i].discountText = promo.label
        }
      })
    }

    return initial.map(({ _productUrl, _itemId, ...p }: any) => p) as NormalizedProduct[]
  } catch (error) {
    console.error(`Error ${supermarket} completo:`, error)
    return []
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const cat = searchParams.get('cat') // Si viene cat, significa que es ID de categoría unificada

  if (!q && !cat) {
    return NextResponse.json({ error: 'Missing query or category' }, { status: 400 })
  }

  try {
    let cotoQ = q || '', carrQ = q || '', cencoQ = q || '', diaQ = q || '', walmartQ = q || ''
    let vtexMap = 'c'
    let isCategory = !!cat

    // Si es búsqueda por categoría, traducir los IDs
    if (cat) {
      const node = findCategoryNode(cat)
      if (node) {
         cotoQ = node.name
         carrQ = node.carrefourId || ''
         cencoQ = node.name
         diaQ = node.name
         walmartQ = node.name
         vtexMap = node.vtexMap || 'c'
      } else {
         return NextResponse.json({ error: 'Category not mapped' }, { status: 404 })
      }
    }

    // Ejecutar todas en paralelo
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

    const allProducts = [...coto, ...carrefour, ...jumbo, ...disco, ...vea, ...dia, ...masOnline, ...changomas]
      .filter(p => p.finalPrice > 0)

    // Agrupamiento por EAN (Consolidación)
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
    }).sort((a, b) => b.availableIn - a.availableIn) // Ordenar por productos que están en MÁS supermercados primero

    return NextResponse.json({
      query: q || cat,
      groupedCount: results.length,
      rawCount: allProducts.length,
      debugLengths: { coto: coto.length, carrefour: carrefour.length, jumbo: jumbo.length, disco: disco.length, vea: vea.length, dia: dia.length },
      debugData: {
        coto0: coto[0],
        disco0: disco[0]
      },
      results
    })
  } catch (error: any) {
    console.error("Search Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

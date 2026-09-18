'use client'

import React, { useState, useEffect } from 'react'
import { Search, Loader2, Plus, Minus, Trash2, X, ArrowRight, RotateCcw, ExternalLink, Info, AlertTriangle, FileText, Check, ShoppingBag, Zap } from 'lucide-react'

export interface MultiUnitPromo {
  label: string
  effectivePrice: number
  requiredQty: number
}

export interface MarketProduct {
  id: string
  supermarket: string
  name: string
  price: number
  finalPrice: number
  discountText: string
  url: string
  multiUnitPromo?: MultiUnitPromo
  primePromo?: MultiUnitPromo
  jumboCheck?: number
  vtexCategoryId?: string
  vtexCategory?: string
  excludedFromBankPromos?: boolean
}

export function extractCategory(vtexCategory?: string): string {
  if (!vtexCategory) return ''
  const segs = vtexCategory.replace(/\/$/, '').split('/').filter(Boolean)
  // Devolver el segundo nivel si hay 3+, sino el primero
  return segs.length >= 2 ? segs[1] : segs[0] || ''
}

export interface GroupedProduct {
  ean: string
  name: string
  brand: string
  imageUrl: string
  minPrice: number
  maxPrice: number
  bestMarket: string
  availableIn: number
  excludedFromBankPromos?: boolean
  markets: Record<string, MarketProduct>
}

export interface CartRow {
  ean: string
  name: string
  imageUrl: string
  quantity: number
  // Override de cantidad por super (ej. simular "2do al 50%" comprando 2 solo en
  // Carrefour sin afectar la cantidad de los demás supers de la misma fila). Un super
  // sin entrada acá sigue la `quantity` global de la fila; con entrada, usa la propia.
  marketQuantities?: Record<string, number>
  vtexCategoryId?: string
  vtexCategory?: string
  searchQuery?: string  // búsqueda original para encontrar similares
  markets: Record<string, {
    id?: string
    name?: string
    price: number
    finalPrice: number
    effectivePrice: number
    promoLabel?: string
    promoQty?: number
    jumboCheck?: number
    excludedFromBankPromos?: boolean
    url: string
  }>
}

export interface Toast {
  id: number
  message: string
}

export interface BankPromoInfo {
  label: string
  discountValue: number
  discountType: string
  stacking: 'ALWAYS' | 'NEVER' | 'UNKNOWN'
  matchingEntityNames: string[]
  capAmount?: number | null
  capPeriod?: string | null
  promoId?: string | null
  slug?: string | null
  title?: string | null
  description?: string | null
  sourceUrl?: string | null
  sourceText?: string | null
  stackableNote?: string | null
  commerceNote?: string | null
  betterDay?: {
    dayLabel: string
    discountValue: number
    discountType: string
    label: string
  }
}

export interface StoreVerdict {
  market: string
  itemsCovered: number
  itemsTotal: number
  gondolaTotal: number
  listTotal: number
  gondolaSavings?: number
  bankDiscount: {
    label: string
    amount: number
    confidence: 'confirmed' | 'unconfirmed'
    appliedStrategy: 'stacked' | 'best_of_two' | 'none'
    capped?: boolean
    capAmount?: number | null
  } | null
  finalTotal: number
  isCompleteBasket: boolean
}

export const formatPrice = (p: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p)

// Cantidad efectiva de una fila del carrito para un super puntual: usa el override de
// `marketQuantities` si ese super fue independizado del +/- global, si no cae a `quantity`.
export const getRowQuantity = (row: CartRow, market: string): number => row.marketQuantities?.[market] ?? row.quantity

export const ALL_SUPERMARKETS_SUPER = ['Jumbo', 'Disco', 'Vea', 'Coto', 'Carrefour', 'Más Online', 'Dia', 'Changomas', 'The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
export const NATIONAL_STORES_SUPER = ['Coto', 'Carrefour', 'Jumbo', 'Disco', 'Vea', 'Changomas', 'Más Online', 'Dia']
export const REGIONAL_STORES_SUPER = ['The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
export const ALL_SUPERMARKETS_FARMA = ['Farmacity', 'Farmaplus', 'OpenFarma']
export const ALL_SUPERMARKETS_ELECTRO = ['Megatone', 'Frávega', 'Naldo', 'Coppel', 'Rodo', 'Easy', 'Carrefour', 'Coto', 'Jumbo', 'Disco', 'Vea', 'Más Online', 'Changomas', 'Dia']

export const STORE_LOGOS: Record<string, string> = {
  'Frávega': 'https://www.google.com/s2/favicons?domain=fravega.com&sz=64',
  'Naldo': 'https://www.google.com/s2/favicons?domain=naldo.com.ar&sz=64',
  'Coppel': 'https://www.google.com/s2/favicons?domain=coppel.com.ar&sz=64',
  'Rodo': 'https://www.google.com/s2/favicons?domain=rodo.com.ar&sz=64',
  'Easy': 'https://www.google.com/s2/favicons?domain=easy.com.ar&sz=64',
  'Megatone': 'https://www.google.com/s2/favicons?domain=megatone.net&sz=64',
  'Carrefour': 'https://www.google.com/s2/favicons?domain=carrefour.com.ar&sz=64',
  'Coto': 'https://www.google.com/s2/favicons?domain=cotodigital3.com.ar&sz=64',
  'Jumbo': 'https://www.google.com/s2/favicons?domain=jumbo.com.ar&sz=64',
  'Disco': 'https://www.google.com/s2/favicons?domain=disco.com.ar&sz=64',
  'Vea': 'https://www.google.com/s2/favicons?domain=vea.com.ar&sz=64',
  'Más Online': 'https://www.google.com/s2/favicons?domain=masonline.com.ar&sz=64',
  'Changomas': 'https://www.google.com/s2/favicons?domain=changomas.com.ar&sz=64',
  'Dia': 'https://www.google.com/s2/favicons?domain=supermercadosdia.com.ar&sz=64',
  'MercadoLibre': 'https://www.google.com/s2/favicons?domain=mercadolibre.com.ar&sz=64',
  'The Food Market': 'https://www.google.com/s2/favicons?domain=thefoodmarket.com.ar&sz=64',
  'Cordiez': 'https://www.google.com/s2/favicons?domain=cordiez.com.ar&sz=64',
  'Cooperativa Obrera': 'https://www.google.com/s2/favicons?domain=lacoopeencasa.coop&sz=64',
  'Toledo Digital': 'https://www.google.com/s2/favicons?domain=toledodigital.com.ar&sz=64',
  'Depot Express': 'https://www.google.com/s2/favicons?domain=depotexpress.com.ar&sz=64',
}

export const SUPERMARKET_COLORS: Record<string, string> = {
  'Coto': 'bg-red-500 text-white',
  'Carrefour': 'bg-blue-600 text-white',
  'Jumbo': 'bg-green-600 text-white',
  'Dia': 'bg-red-600 text-white',
  'Disco': 'bg-red-700 text-white',
  'Vea': 'bg-yellow-500 text-black',
  'Más Online': 'bg-blue-500 text-white',
  'Changomas': 'bg-orange-500 text-white',
  'Farmacity': 'bg-green-500 text-white',
  'Farmaplus': 'bg-teal-600 text-white',
  'OpenFarma': 'bg-purple-600 text-white',
  'Farmatodo': 'bg-red-500 text-white',
  'Central Oeste': 'bg-blue-700 text-white',
  'Megatone': 'bg-orange-600 text-white',
  'Frávega': 'bg-red-600 text-white',
  'Naldo': 'bg-blue-800 text-white',
  'Coppel': 'bg-yellow-600 text-white',
  'Rodo': 'bg-slate-700 text-white',
  'Easy': 'bg-yellow-400 text-black',
  'The Food Market': 'bg-emerald-700 text-white',
  'Cordiez': 'bg-red-800 text-white',
  'Cooperativa Obrera': 'bg-sky-700 text-white',
  'Toledo Digital': 'bg-violet-700 text-white',
  'Depot Express': 'bg-orange-700 text-white',
  'default': 'bg-gray-800 text-white'
}

export const SUPERMARKET_DOT: Record<string, string> = {
  'Coto': 'bg-red-500',
  'Carrefour': 'bg-blue-600',
  'Jumbo': 'bg-green-600',
  'Dia': 'bg-red-600',
  'Disco': 'bg-red-700',
  'Vea': 'bg-yellow-500',
  'Más Online': 'bg-blue-500',
  'Changomas': 'bg-orange-500',
  'Farmacity': 'bg-green-500',
  'Farmaplus': 'bg-teal-600',
  'OpenFarma': 'bg-purple-600',
  'Farmatodo': 'bg-red-500',
  'Central Oeste': 'bg-blue-700',
  'Megatone': 'bg-orange-600',
  'Frávega': 'bg-red-600',
  'Naldo': 'bg-blue-800',
  'Coppel': 'bg-yellow-600',
  'Rodo': 'bg-slate-600',
  'Easy': 'bg-yellow-400',
  'The Food Market': 'bg-emerald-700',
  'Cordiez': 'bg-red-800',
  'Cooperativa Obrera': 'bg-sky-700',
  'Toledo Digital': 'bg-violet-700',
  'Depot Express': 'bg-orange-700',
  'default': 'bg-gray-500'
}

// Configuración de tiendas que soportan carga directa del carrito por URL (VTEX / WooCommerce)
export const DIRECT_CART_STORES: Record<string, {
  type: 'vtex' | 'woocommerce'
  baseUrl: string
  supportsMultiSku: boolean
}> = {
  'Carrefour': { type: 'vtex', baseUrl: 'https://www.carrefour.com.ar', supportsMultiSku: true },
  'Jumbo': { type: 'vtex', baseUrl: 'https://www.jumbo.com.ar', supportsMultiSku: true },
  'Disco': { type: 'vtex', baseUrl: 'https://www.disco.com.ar', supportsMultiSku: true },
  'Vea': { type: 'vtex', baseUrl: 'https://www.vea.com.ar', supportsMultiSku: true },
  'Dia': { type: 'vtex', baseUrl: 'https://diaonline.supermercadosdia.com.ar', supportsMultiSku: true },
  'Día': { type: 'vtex', baseUrl: 'https://diaonline.supermercadosdia.com.ar', supportsMultiSku: true },
  'Más Online': { type: 'vtex', baseUrl: 'https://www.masonline.com.ar', supportsMultiSku: true },
  'Changomas': { type: 'vtex', baseUrl: 'https://www.changomas.com.ar', supportsMultiSku: true },
  'Cordiez': { type: 'vtex', baseUrl: 'https://www.cordiez.com.ar', supportsMultiSku: true },
  'The Food Market': { type: 'vtex', baseUrl: 'https://www.thefoodmarket.com.ar', supportsMultiSku: true },
  'Toledo Digital': { type: 'vtex', baseUrl: 'https://www.toledodigital.com.ar', supportsMultiSku: true },
  'Farmacity': { type: 'vtex', baseUrl: 'https://www.farmacity.com', supportsMultiSku: true },
  'Farmaplus': { type: 'vtex', baseUrl: 'https://www.farmaplus.com.ar', supportsMultiSku: true },
  'Depot Express': { type: 'woocommerce', baseUrl: 'https://depotexpress.com.ar', supportsMultiSku: false },
}

// Extrae el SKU ID o Item ID limpio a partir del id o url del producto
export function extractStoreSkuId(idOrUrl?: string): string | null {
  if (!idOrUrl) return null
  // Formato tipo "carrefour-12345" o "jumbo-98765"
  const dashMatch = idOrUrl.match(/^[a-z0-9_-]+-(\d+)$/i)
  if (dashMatch) return dashMatch[1]

  // Formato puramente numérico
  if (/^\d+$/.test(idOrUrl.trim())) return idOrUrl.trim()

  // Formato URL VTEX: /p?skuId=12345 o /12345/p
  const queryMatch = idOrUrl.match(/[?&]skuId=(\d+)/i)
  if (queryMatch) return queryMatch[1]

  const pathMatch = idOrUrl.match(/\/(\d+)\/p(?:[?#]|$)/i)
  if (pathMatch) return pathMatch[1]

  return null
}

// Genera la URL para inyectar los productos directo en el carrito de la tienda
export function buildDirectCartUrl(market: string, cart: CartRow[]): string | null {
  const storeConfig = DIRECT_CART_STORES[market]
  if (!storeConfig) return null

  const items = cart
    .map(row => {
      const m = row.markets[market]
      if (!m) return null
      const qty = getRowQuantity(row, market)
      if (qty <= 0) return null
      const skuId = extractStoreSkuId(m.id) || extractStoreSkuId(m.url) || extractStoreSkuId(row.ean)
      return skuId ? { skuId, qty, url: m.url } : null
    })
    .filter(Boolean) as { skuId: string; qty: number; url: string }[]

  if (items.length === 0) return null

  if (storeConfig.type === 'vtex') {
    // VTEX standard deep link:
    // https://{dominio}/checkout/cart/add?sku={sku1}&qty={qty1}&seller=1&sku={sku2}&qty={qty2}&seller=1&redirect=true
    const queryParts = items
      .map(it => `sku=${encodeURIComponent(it.skuId)}&qty=${it.qty}&seller=1`)
      .join('&')
    return `${storeConfig.baseUrl}/checkout/cart/add?${queryParts}&redirect=true`
  }

  if (storeConfig.type === 'woocommerce') {
    // WooCommerce soporta carga directa de producto al carrito
    if (items.length === 1) {
      return `${storeConfig.baseUrl}/?add-to-cart=${encodeURIComponent(items[0].skuId)}&quantity=${items[0].qty}`
    }
    // Si son múltiples, WooCommerce requiere el primer item o la tienda/carrito directo
    return `${storeConfig.baseUrl}/carrito/`
  }

  return null
}

export function getBestPromo(markets: Record<string, MarketProduct>, minRegularPrice: number): { market: string; promo: MultiUnitPromo; effectivePrice: number } | null {
  let best: { market: string; promo: MultiUnitPromo; effectivePrice: number } | null = null
  for (const [name, m] of Object.entries(markets)) {
    if (!m.multiUnitPromo) continue
    const effectivePrice = Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice)
    if (effectivePrice >= minRegularPrice) continue
    if (!best || effectivePrice < best.effectivePrice) {
      best = { market: name, promo: m.multiUnitPromo, effectivePrice }
    }
  }
  return best
}

// Precio unitario del mejor mercado (sin exigir la cantidad de la promo multi-unidad)
export function getUnitPrice(p: GroupedProduct): number {
  return p.minPrice
}

// Precio con la mejor promo activada (multi-unidad o no) — el que ya usa la tarjeta hoy
export function getPromoPrice(p: GroupedProduct): number {
  const best = getBestPromo(p.markets, p.minPrice)
  return best ? best.effectivePrice : p.minPrice
}

// Precio final "de góndola" de un producto: si hay promo multi-unidad activa, ese;
// si no, el mejor finalPrice regular entre mercados. Usado para el filtro de rango
// "desde/hasta" (final con descuento incluido) — siempre el mejor precio posible.
export function getFinalDiscountedPrice(p: GroupedProduct): number {
  const promo = getBestPromo(p.markets, p.minPrice)
  return promo ? promo.effectivePrice : p.minPrice
}

// Descuento efectivo de la promo completa (ej. 2x1=50%, 3x2=33%) tomando el mejor
// precio regular vs el mejor precio con promo entre todos los mercados.
export function getEffectiveDiscountPct(p: GroupedProduct): number {
  let regular = 0
  let withPromo = Infinity
  for (const m of Object.values(p.markets)) {
    if (m.price > regular) regular = m.price
    const eff = m.multiUnitPromo ? Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice) : m.finalPrice
    if (eff < withPromo) withPromo = eff
  }
  if (!regular || withPromo === Infinity || withPromo >= regular) return 0
  return ((regular - withPromo) / regular) * 100
}

export function getEffectiveDiscountAmount(p: GroupedProduct): number {
  let regular = 0
  let withPromo = Infinity
  for (const m of Object.values(p.markets)) {
    if (m.price > regular) regular = m.price
    const eff = m.multiUnitPromo ? Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice) : m.finalPrice
    if (eff < withPromo) withPromo = eff
  }
  if (!regular || withPromo === Infinity || withPromo >= regular) return 0
  return regular - withPromo
}

export function hasAnyPromo(p: GroupedProduct): boolean {
  return Object.values(p.markets).some(m => m.multiUnitPromo || (m.discountText && m.discountText !== '-'))
}

export type SuperSortKey = 'price_asc' | 'price_desc' | 'alpha_asc' | 'alpha_desc' | 'discount_pct' | 'discount_amount' | 'availability'

export function stripAccents(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Última carpeta no vacía de vtexCategory (ej. "/Gaseosas/Cola/" → "Cola").
// Solo lo trae VTEX (Jumbo/Disco/Vea/Carrefour/Dia/...), Coto no.
export function lastCategorySegment(vtexCategory?: string): string | null {
  if (!vtexCategory) return null
  const segs = vtexCategory.replace(/^\/|\/$/g, '').split('/').filter(Boolean)
  return segs.length ? segs[segs.length - 1] : null
}

export function mostCommonVtexCategory(p: GroupedProduct): string | null {
  const segs = Object.values(p.markets).map(m => lastCategorySegment(m.vtexCategory)).filter(Boolean) as string[]
  if (!segs.length) return null
  const counts = new Map<string, number>()
  for (const s of segs) counts.set(s, (counts.get(s) || 0) + 1)
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
}

// Palabras genéricas que no aportan como filtro de variante (unidades, tamaños, marcas
// comunes de envase, conectores). Todo lo demás que se repita entre varios productos de
// un mismo resultado de búsqueda es candidato a chip de variante (ej. "Zero", "Entera").
const STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'con', 'sin', 'sabor', 'x', 'un', 'una',
  'lt', 'lts', 'l', 'ml', 'g', 'gr', 'kg', 'cc', 'un.', 'unid', 'unidad', 'unidades',
  'pack', 'pet', 'lata', 'botella', 'bot', 'tetra', 'caja', 'combo',
])

// Deriva "chips" de variante a partir de palabras que se repiten en varios nombres de
// producto dentro del mismo resultado de búsqueda — sin listas hardcodeadas por rubro.
// Une esta señal con la categoría VTEX (cuando existe) para cubrir también el caso en
// que la variante real es la categoría del comercio (ej. "Cola" vs "Otras Gaseosas").
export function getSubcategoriesForQuery(query: string, products: GroupedProduct[]): { label: string; count: number; type: 'vtex' | 'keyword' }[] {
  if (!query.trim() || products.length < 2) return []

  const queryWords = new Set(stripAccents(query).split(/\s+/).filter(Boolean))

  // 1) Categorías VTEX (la última carpeta de cada producto)
  const vtexCounts = new Map<string, number>()
  for (const p of products) {
    const cat = mostCommonVtexCategory(p)
    if (cat) vtexCounts.set(cat, (vtexCounts.get(cat) || 0) + 1)
  }
  const vtexChips = Array.from(vtexCounts.entries())
    .filter(([, count]) => count >= 2 && count < products.length) // descarta si es 1 sola o todas iguales (no filtra nada)
    .map(([label, count]) => ({ label, count, type: 'vtex' as const }))

  // 2) Palabras clave repetidas en los nombres (variantes tipo Zero/Original/Entera)
  const wordCounts = new Map<string, number>()
  const wordDisplay = new Map<string, string>()
  for (const p of products) {
    const rawWords = p.name.split(/\s+/).filter(Boolean)
    const seenInThisProduct = new Set<string>()
    for (const raw of rawWords) {
      const clean = stripAccents(raw.replace(/[.,%()]/g, ''))
      if (!clean || clean.length < 3) continue
      if (STOPWORDS.has(clean)) continue
      if (queryWords.has(clean)) continue // no repetir la palabra ya buscada
      if (/^\d+([.,]\d+)?$/.test(clean)) continue // tamaños sueltos ("1", "2,25")
      if (seenInThisProduct.has(clean)) continue
      seenInThisProduct.add(clean)
      wordCounts.set(clean, (wordCounts.get(clean) || 0) + 1)
      if (!wordDisplay.has(clean)) wordDisplay.set(clean, raw.replace(/[.,%()]/g, ''))
    }
  }
  const keywordChips = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2 && count < products.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // top 8 para no saturar la barra de chips
    .map(([word, count]) => ({ label: wordDisplay.get(word) || word, count, type: 'keyword' as const }))

  return [...vtexChips, ...keywordChips].sort((a, b) => b.count - a.count)
}

export function SimilarProductModal({ ean, market, catId, excludeEan, cartRow, onSelect, onClose }: {
  ean: string
  market: string
  catId: string
  excludeEan: string
  cartRow: CartRow
  onSelect: (market: string, item: { ean: string; name: string; price: number; imageUrl: string; url: string }) => void
  onClose: () => void
}) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')

  const doSearch = async (q: string) => {
    if (q.length < 3) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/precios/search?q=${encodeURIComponent(q)}&section=supermercados`)
      const data = await res.json()
      const filtered = (data.results || [])
        .filter((p: any) => p.markets?.[market] && p.ean !== excludeEan)
        .map((p: any) => ({
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          price: p.markets[market].finalPrice,
          imageUrl: p.imageUrl,
          url: p.markets[market].url || '',
        }))
      setResults(filtered)
    } catch {}
    setLoading(false)
  }

  // No búsqueda automática al abrir — el usuario escribe lo que quiere

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const filtered = results

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Buscar similar en {market}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Reemplaza "{cartRow.name.slice(0, 40)}..."</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Ej: leche, jabón, galletitas..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Mostrando productos disponibles en {market}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : filtered.length === 0 && query.length >= 3 ? (
            <p className="text-center text-slate-500 py-10 text-sm">No hay "{query}" en {market} — probá con otro término</p>
          ) : query.length < 3 ? (
            <p className="text-center text-slate-500 py-10 text-sm">Escribí al menos 3 letras</p>
          ) : (
            filtered.map(item => (
              <button
                key={item.ean || item.itemId}
                onClick={() => onSelect(market, { ean: item.ean, name: item.name, price: item.price, imageUrl: item.imageUrl, url: '' })}
                className="w-full flex items-center gap-3 p-3 bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-indigo-500/30 rounded-xl transition-colors text-left"
              >
                <div className="w-12 h-12 bg-white rounded-lg p-1 shrink-0">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/48x48/eee/999?text=?' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-tight">{item.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{item.brand}</p>
                </div>
                <p className="text-sm font-black text-white shrink-0">{formatPrice(item.price)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Modal exhaustivo con las condiciones legales, bases, links oficiales y disclaimer de responsabilidad
export function PromoTermsModal({
  market,
  bankPromo,
  bankDiscount,
  cart,
  onClose,
}: {
  market: string
  bankPromo: BankPromoInfo
  bankDiscount?: StoreVerdict['bankDiscount'] | null
  cart: CartRow[]
  onClose: () => void
}) {
  const coveredRows = cart.filter(row => !!row.markets[market] && !row.markets[market]?.excludedFromBankPromos)
  const excludedRows = cart.filter(row => !!row.markets[market] && !!row.markets[market]?.excludedFromBankPromos)
  const pctLabel = bankPromo.discountType === 'CUOTAS_SIN_INTERES' ? `${bankPromo.discountValue} CSI` : `${bankPromo.discountValue}%`

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3 shrink-0 bg-[#181818]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl shrink-0">
              🏦
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                <span className="text-xs font-bold text-slate-400">{market}</span>
              </div>
              <h3 className="text-base font-black text-white leading-tight">
                {bankPromo.label} ({pctLabel})
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Tarjeta de impacto del beneficio */}
          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium">Beneficio estimado en tu compra:</span>
              <span className="text-emerald-400 font-black text-sm">
                {bankDiscount ? `-${formatPrice(bankDiscount.amount)}` : pctLabel}
              </span>
            </div>
            {bankPromo.capAmount && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Tope de reintegro:</span>
                <span className="font-bold text-white">
                  {formatPrice(bankPromo.capAmount)} {bankPromo.capPeriod ? `(${bankPromo.capPeriod.toLowerCase()})` : ''}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-white/5">
              <p className="text-slate-300">
                <strong className="text-white">Cálculo de acumulación: </strong>
                {bankPromo.stacking === 'NEVER' ? (
                  <span className="text-amber-300">
                    No acumulable con ofertas de góndola en {market}. PromoAR calcula el ahorro tomando la mejor alternativa de precio de lista para evitar estimaciones infladas.
                  </span>
                ) : bankPromo.stacking === 'ALWAYS' ? (
                  <span className="text-emerald-300">
                    Acumulable con ofertas de góndola sobre los productos elegibles del ticket.
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Sujeto a confirmación según las condiciones de caja en la sucursal.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Bancos / Medios adheridos */}
          {bankPromo.matchingEntityNames && bankPromo.matchingEntityNames.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Entidades participantes</p>
              <div className="flex flex-wrap gap-1.5">
                {bankPromo.matchingEntityNames.map(name => (
                  <span key={name} className="text-[11px] font-semibold text-slate-200 bg-white/5 border border-white/10 rounded-lg px-2 py-1">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Letra Chica / Condiciones Legales directas */}
          <div>
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">Condiciones y bases legales informadas</p>
            <div className="p-3.5 rounded-2xl bg-[#1A1A1A] border border-white/10 text-slate-300 leading-relaxed max-h-48 overflow-y-auto space-y-2 text-[11px]">
              {bankPromo.title && <p className="font-bold text-white">{bankPromo.title}</p>}
              {bankPromo.description && <p>{bankPromo.description}</p>}
              {bankPromo.sourceText && bankPromo.sourceText !== bankPromo.description && (
                <p className="text-slate-400 font-mono text-[10px] whitespace-pre-wrap">{bankPromo.sourceText}</p>
              )}
              {bankPromo.commerceNote && (
                <p className="text-amber-300/90 font-medium">📌 {bankPromo.commerceNote}</p>
              )}
              {bankPromo.stackableNote && (
                <p className="text-slate-400 italic">ℹ️ {bankPromo.stackableNote}</p>
              )}
              {!bankPromo.description && !bankPromo.sourceText && (
                <p className="text-slate-500 italic">Condiciones generales vigentes para clientes del banco/billetera en {market}.</p>
              )}
            </div>

            {/* Enlaces directos para que no tengan que buscarlo */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              {bankPromo.slug && (
                <a
                  href={`/promos/${bankPromo.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Ver ficha completa en PromoAR</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}
              {bankPromo.sourceUrl && (
                <a
                  href={bankPromo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <span>Ver en sitio oficial del emisor</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}
            </div>
          </div>

          {/* Desglose de Productos Elegibles vs Excluidos en el carrito */}
          <div>
            <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-1.5">
              Productos de tu carrito en {market} ({coveredRows.length} elegibles{excludedRows.length > 0 ? `, ${excludedRows.length} excluidos` : ''})
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {coveredRows.map(row => (
                <div key={row.ean} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-[11px]">
                  <span className="text-slate-300 truncate">{row.name}</span>
                  <span className="text-slate-400 font-bold shrink-0">x{getRowQuantity(row, market)}</span>
                </div>
              ))}
              {excludedRows.map(row => (
                <div key={row.ean} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-[11px]">
                  <span className="text-slate-400 truncate line-through">{row.name}</span>
                  <span className="text-amber-400 text-[10px] font-bold shrink-0">🚫 Excluido por categoría o legales</span>
                </div>
              ))}
            </div>
          </div>

          {/* DISCLAIMER DE RESPONSABILIDAD LEGAL OBLIGATORIO */}
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200/90 leading-relaxed text-[11px]">
            <div className="flex items-center gap-1.5 font-black text-amber-300 uppercase tracking-wide mb-1 text-[10px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Aviso de responsabilidad y verificación</span>
            </div>
            <p>
              PromoAR es una plataforma independiente de guía, cálculo y comparación. Los precios, promociones, topes de reintegro y exclusiones son de carácter <strong>estrictamente orientativo e informativo</strong>, calculados a partir de los datos públicos provistos por comercios y entidades.
            </p>
            <p className="mt-1.5">
              <strong>PromoAR no es parte de la transacción comercial ni se responsabiliza por rechazos, modificaciones de términos o exclusiones de la entidad o supermercado.</strong> El cliente debe verificar siempre las condiciones legales directamente en el comercio antes de abonar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end shrink-0 bg-[#181818]">
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-2 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}

// Badge de ahorro bancario/billetera — reemplaza el texto de 9px por un bloque propio
// que "grita" el monto ahorrado, y abre el modal completo de bases legales y disclaimer.
export function BankSavingsBadge({ market, bankPromo, bankDiscount, cart }: {
  market: string
  bankPromo: BankPromoInfo | null | undefined
  bankDiscount: StoreVerdict['bankDiscount']
  cart: CartRow[]
}) {
  const [openModal, setOpenModal] = useState(false)
  if (!bankPromo || !bankDiscount) return null

  const pctLabel = bankPromo.discountType === 'CUOTAS_SIN_INTERES' ? `${bankPromo.discountValue} CSI` : `${bankPromo.discountValue}%`
  const isUnconfirmed = bankDiscount.confidence === 'unconfirmed'

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpenModal(true)}
        className={`w-full rounded-lg border px-2 py-1.5 text-left transition-all hover:scale-[1.02] active:scale-[0.99] cursor-pointer ${
          isUnconfirmed
            ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15'
            : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
        }`}
        title="Clic para ver condiciones legales, bases y exclusiones"
      >
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[13px] font-black leading-none ${isUnconfirmed ? 'text-amber-400' : 'text-emerald-400'}`}>
            -{formatPrice(bankDiscount.amount)}
          </span>
          <span className={`text-[9px] font-black uppercase rounded px-1 py-0.5 leading-none ${isUnconfirmed ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
            {pctLabel}
          </span>
        </div>
        <p className="text-[9px] text-slate-400 truncate mt-0.5">🏦 {bankPromo.label}</p>
        {bankDiscount.appliedStrategy === 'best_of_two' && (
          <p className="text-[8px] text-slate-500 leading-tight">no acumulable con promo de góndola</p>
        )}
        {isUnconfirmed && (
          <p className="text-[8px] text-amber-400/80 leading-tight">⚠️ no confirmado si acumula</p>
        )}
        <p className="text-[8px] text-blue-400/90 leading-tight mt-0.5 flex items-center gap-0.5 font-semibold">
          <span>Ver legales y bases ↗</span>
        </p>
      </button>

      {bankPromo.betterDay && (
        <p className="text-[8px] font-bold text-sky-400 mt-1 leading-tight">
          💡 {bankPromo.betterDay.dayLabel}: {bankPromo.betterDay.discountType === 'CUOTAS_SIN_INTERES' ? `${bankPromo.betterDay.discountValue} CSI` : `${bankPromo.betterDay.discountValue}%`} con {bankPromo.betterDay.label} (hoy {pctLabel})
        </p>
      )}

      {openModal && (
        <PromoTermsModal
          market={market}
          bankPromo={bankPromo}
          bankDiscount={bankDiscount}
          cart={cart}
          onClose={() => setOpenModal(false)}
        />
      )}
    </div>
  )
}

export function MobileCart({ cart, allMarkets, cartTotals, lowestTotalMarket, storeVerdicts, winnerMarket, bankPromos, getEffectivePrice, updateQuantity, updateMarketQuantity, resetMarketQuantity, removeFromCart, onOpenBuyAssistant, onOpenPromoDetail }: {
  cart: CartRow[]
  allMarkets: string[]
  cartTotals: Record<string, number>
  lowestTotalMarket: string
  storeVerdicts: Record<string, StoreVerdict>
  winnerMarket: string
  bankPromos: Record<string, BankPromoInfo | null>
  getEffectivePrice: (m: CartRow['markets'][string], qty: number) => number
  updateQuantity: (ean: string, delta: number) => void
  updateMarketQuantity: (ean: string, market: string, delta: number) => void
  resetMarketQuantity: (ean: string, market: string) => void
  removeFromCart: (ean: string) => void
  onOpenBuyAssistant?: (market: string) => void
  onOpenPromoDetail?: (detail: any) => void
}) {
  const [selectedMarket, setSelectedMarket] = useState<string>(winnerMarket || allMarkets[0] || '')
  const [termsModalMarket, setTermsModalMarket] = useState<string | null>(null)

  // Mantener el súper seleccionado actualizado si cambia el ganador
  const activeMarket = allMarkets.includes(selectedMarket) ? selectedMarket : (winnerMarket || allMarkets[0] || '')

  // Totales de precio de lista (sin descuentos)
  const listTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + m.price * getRowQuantity(row, market) : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const winnerData = storeVerdicts[winnerMarket]
  const currentVerdict = storeVerdicts[activeMarket]
  const isCurrentWinner = activeMarket === winnerMarket
  const bp = bankPromos[activeMarket]

  return (
    <div className="md:hidden p-3 space-y-4">
      {/* Selector de Pestañas por Supermercado */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Comparativa por Supermercado
          </span>
          <span className="text-[11px] text-slate-400 font-bold">
            {cart.length} productos
          </span>
        </div>

        <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-2xl overflow-x-auto border border-white/10">
          {allMarkets.map(market => {
            const isActive = activeMarket === market
            const isWin = market === winnerMarket
            const v = storeVerdicts[market]
            const total = v?.finalTotal ?? cartTotals[market] ?? 0

            return (
              <button
                key={market}
                onClick={() => setSelectedMarket(market)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center shrink-0 min-w-[85px] ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1">
                  {isWin && <span>🥇</span>}
                  <span className="truncate">{market}</span>
                </span>
                <span className={`text-[11px] font-extrabold mt-0.5 ${isWin ? 'text-emerald-400' : 'text-slate-300'}`}>
                  ${Math.round(total / 1000)}k
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Resumen del Súper Activo (Tarjeta Limpia) */}
      {currentVerdict && (
        <div className={`p-4 rounded-2xl border ${isCurrentWinner ? 'bg-gradient-to-b from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-500/50 shadow-lg' : 'bg-slate-900/60 border-slate-800'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[activeMarket] || SUPERMARKET_DOT.default}`} />
                <p className="text-xs text-slate-400 font-bold uppercase">{activeMarket}</p>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <p className={`text-2xl font-black ${isCurrentWinner ? 'text-emerald-400' : 'text-white'}`}>
                  {formatPrice(currentVerdict.finalTotal)}
                </p>
                {!isCurrentWinner && winnerData && currentVerdict.finalTotal > winnerData.finalTotal && (
                  <span className="text-xs font-bold text-rose-400">
                    (+{formatPrice(currentVerdict.finalTotal - winnerData.finalTotal)})
                  </span>
                )}
              </div>
            </div>

            {isCurrentWinner ? (
              <span className="bg-emerald-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                🥇 Más barato
              </span>
            ) : (
              !currentVerdict.isCompleteBasket && (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Canasta incompleta
                </span>
              )
            )}
          </div>

          {/* Desglose de 3 líneas limpias */}
          <div className="text-xs text-slate-400 space-y-1.5 pt-3 border-t border-slate-800">
            <div className="flex justify-between">
              <span>Total de góndola:</span>
              <span className="text-slate-200">{formatPrice(currentVerdict.gondolaTotal)}</span>
            </div>

            {(listTotals[activeMarket] || 0) > currentVerdict.gondolaTotal && (
              <div className="flex justify-between text-emerald-400">
                <span>Ahorro en góndola (ofertas):</span>
                <span>-{formatPrice((listTotals[activeMarket] || 0) - currentVerdict.gondolaTotal)}</span>
              </div>
            )}

            {currentVerdict.bankDiscount && (
              <div className="flex justify-between items-center text-amber-400 font-bold">
                <span className="truncate pr-2">
                  🏦 {currentVerdict.bankDiscount.label} {currentVerdict.bankDiscount.capped ? '(Tope máx)' : ''}:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span>-{formatPrice(currentVerdict.bankDiscount.amount)}</span>
                  {bankPromos[activeMarket] && (
                    <button
                      onClick={() => setTermsModalMarket(activeMarket)}
                      className="text-[9px] text-blue-400 underline font-normal hover:text-blue-300 transition-colors"
                      title="Ver bases legales y exclusiones de la promoción"
                    >
                      (Ver bases)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Nota de estimación prudente y disclaimer */}
          <div className="mt-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-300">Estimación prudente:</strong> El ahorro aplica exclusiones legales para no inflar expectativas. Verificá siempre las condiciones comerciales vigentes en el comercio antes de pagar.
            </p>
          </div>

          {(() => {
            const directUrl = buildDirectCartUrl(activeMarket, cart)
            return (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                {directUrl && (
                  <a
                    href={`/api/r?url=${encodeURIComponent(directUrl)}&src=precios`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-950/40 cursor-pointer"
                    title={`Cargar automáticamente los productos de tu changuito en ${activeMarket}`}
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Cargar changuito en {activeMarket}</span>
                    <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
                  </a>
                )}
                {onOpenBuyAssistant && (
                  <button
                    onClick={() => onOpenBuyAssistant(activeMarket)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      directUrl
                        ? 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 shrink-0'
                        : isCurrentWinner
                          ? 'w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md'
                          : 'w-full bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    <span>{directUrl ? 'Ver checklist' : `Ir a comprar en ${activeMarket}`}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Lista Vertical de Productos (Limpia con Steppers Individuales) */}
      <div className="space-y-2">
        {cart.map(row => {
          const m = row.markets[activeMarket]
          const marketQty = getRowQuantity(row, activeMarket)
          const isOverridden = row.marketQuantities?.[activeMarket] !== undefined
          const promoActiva = m?.promoQty ? marketQty >= m.promoQty : false
          const faltanParaPromo = m?.promoQty && !promoActiva ? m.promoQty - marketQty : 0
          const precioUnit = m ? getEffectivePrice(m, marketQty) : 0
          const totalLine = precioUnit * marketQty

          return (
            <div key={row.ean} className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-white rounded-xl p-1 shrink-0">
                  <img src={row.imageUrl} alt={row.name} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{row.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {m?.promoLabel && (
                      <button
                        onClick={() => onOpenPromoDetail?.({
                          name: row.name,
                          imageUrl: row.imageUrl,
                          market: activeMarket,
                          listPrice: m.price,
                          effectivePrice: precioUnit,
                          qty: marketQty,
                          promoLabel: m.promoLabel,
                          promoQty: m.promoQty,
                          excludedFromBank: m.excludedFromBankPromos
                        })}
                        className={`inline-flex items-center gap-0.5 text-[9px] font-black border px-1.5 py-0.5 rounded transition-all active:scale-95 cursor-pointer ${
                          promoActiva
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title="Ver desglose de la promo"
                      >
                        <span>🔥 {m.promoLabel}{!promoActiva && faltanParaPromo > 0 ? ` (+${faltanParaPromo})` : ''}</span>
                        <Info className="w-2.5 h-2.5 opacity-70" />
                      </button>
                    )}
                    {m?.excludedFromBankPromos && (
                      <span className="text-[9px] text-slate-500 bg-slate-800 px-1 py-0.2 rounded">
                        🚫 Sin reintegro
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Control individual de cantidad para este súper en mobile */}
              <div
                className={`flex items-center rounded-lg border px-1 py-0.5 gap-1 shrink-0 transition-all ${
                  isOverridden
                    ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <button
                  onClick={() => updateMarketQuantity(row.ean, activeMarket, -1)}
                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                  title={`Restar 1 en ${activeMarket}`}
                >
                  <Minus className="w-2.5 h-2.5" />
                </button>
                <span
                  className={`text-xs font-black w-3.5 text-center ${
                    isOverridden ? 'text-blue-300 font-extrabold' : 'text-white'
                  }`}
                  title={isOverridden ? `Cantidad exclusiva para ${activeMarket} (Base: ${row.quantity})` : `Cantidad base (${row.quantity})`}
                >
                  {marketQty}
                </span>
                <button
                  onClick={() => updateMarketQuantity(row.ean, activeMarket, 1)}
                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                  title={`Sumar 1 en ${activeMarket}`}
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
                {isOverridden && (
                  <button
                    onClick={() => resetMarketQuantity(row.ean, activeMarket)}
                    title={`Volver a cantidad base (${row.quantity})`}
                    className="w-4 h-4 flex items-center justify-center text-blue-400 hover:text-blue-200 ml-0.5 transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              <div className="text-right shrink-0 min-w-[55px]">
                {m ? (
                  <>
                    {m.price > precioUnit && (
                      <p className="text-[9px] text-slate-500 line-through leading-none mb-0.5">
                        {formatPrice(m.price)} u.
                      </p>
                    )}
                    <p className="text-sm font-black text-white">{formatPrice(totalLine)}</p>
                    <p className={`text-[10px] ${m.price > precioUnit ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                      {formatPrice(precioUnit)} c/u
                    </p>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">
                    Sin stock
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {termsModalMarket && bankPromos[termsModalMarket] && (
        <PromoTermsModal
          market={termsModalMarket}
          bankPromo={bankPromos[termsModalMarket]!}
          bankDiscount={storeVerdicts[termsModalMarket]?.bankDiscount}
          cart={cart}
          onClose={() => setTermsModalMarket(null)}
        />
      )}
    </div>
  )
}


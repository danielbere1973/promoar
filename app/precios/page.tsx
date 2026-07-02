'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, ShoppingCart, Loader2, Plus, Minus, Trash2, X, ExternalLink, SlidersHorizontal, ChevronRight, Filter, ArrowRight, Camera } from 'lucide-react'
import dynamic from 'next/dynamic'
import CategorySelector from './CategorySelector'
import { CATEGORIES } from './categories'

const BarcodeScannerModal = dynamic(() => import('./BarcodeScannerModal'), { ssr: false })

interface MultiUnitPromo {
  label: string
  effectivePrice: number
  requiredQty: number
}

interface MarketProduct {
  id: string
  supermarket: string
  price: number
  finalPrice: number
  discountText: string
  url: string
  multiUnitPromo?: MultiUnitPromo
  primePromo?: MultiUnitPromo
  jumboCheck?: number
  vtexCategoryId?: string
  vtexCategory?: string
}

function extractCategory(vtexCategory?: string): string {
  if (!vtexCategory) return ''
  const segs = vtexCategory.replace(/\/$/, '').split('/').filter(Boolean)
  // Devolver el segundo nivel si hay 3+, sino el primero
  return segs.length >= 2 ? segs[1] : segs[0] || ''
}

interface GroupedProduct {
  ean: string
  name: string
  brand: string
  imageUrl: string
  minPrice: number
  maxPrice: number
  bestMarket: string
  availableIn: number
  markets: Record<string, MarketProduct>
}

interface CartRow {
  ean: string
  name: string
  imageUrl: string
  quantity: number
  vtexCategoryId?: string
  vtexCategory?: string
  searchQuery?: string  // búsqueda original para encontrar similares
  markets: Record<string, {
    price: number
    finalPrice: number
    effectivePrice: number
    promoLabel?: string
    promoQty?: number
    jumboCheck?: number
    url: string
  }>
}

interface Toast {
  id: number
  message: string
}

const formatPrice = (p: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p)

const ALL_SUPERMARKETS_SUPER = ['Jumbo', 'Disco', 'Vea', 'Coto', 'Carrefour', 'Más Online', 'Dia', 'Changomas', 'The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
const NATIONAL_STORES_SUPER = ['Coto', 'Carrefour', 'Jumbo', 'Disco', 'Vea', 'Changomas', 'Más Online', 'Dia']
const REGIONAL_STORES_SUPER = ['The Food Market', 'Cordiez', 'Cooperativa Obrera', 'Toledo Digital', 'Depot Express']
const ALL_SUPERMARKETS_FARMA = ['Farmacity', 'Farmaplus', 'OpenFarma']
const ALL_SUPERMARKETS_ELECTRO = ['Megatone', 'Frávega', 'Naldo', 'Coppel', 'Rodo', 'Easy', 'Carrefour', 'Coto', 'Jumbo', 'Disco', 'Vea', 'Más Online', 'Changomas', 'Dia']

const STORE_LOGOS: Record<string, string> = {
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

const SUPERMARKET_COLORS: Record<string, string> = {
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

const SUPERMARKET_DOT: Record<string, string> = {
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

function getBestPromo(markets: Record<string, MarketProduct>, minRegularPrice: number): { market: string; promo: MultiUnitPromo; effectivePrice: number } | null {
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

function SimilarProductModal({ ean, market, catId, excludeEan, cartRow, onSelect, onClose }: {
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

function MobileCart({ cart, allMarkets, cartTotals, lowestTotalMarket, getEffectivePrice, updateQuantity, removeFromCart }: {
  cart: CartRow[]
  allMarkets: string[]
  cartTotals: Record<string, number>
  lowestTotalMarket: string
  getEffectivePrice: (m: CartRow['markets'][string], qty: number) => number
  updateQuantity: (ean: string, delta: number) => void
  removeFromCart: (ean: string) => void
}) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
  const [expandedTotals, setExpandedTotals] = useState(false)

  // Totales de precio de lista (sin descuentos)
  const listTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + m.price * row.quantity : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const toggleProduct = (ean: string) => setExpandedProducts(prev => {
    const next = new Set(prev)
    next.has(ean) ? next.delete(ean) : next.add(ean)
    return next
  })

  return (
    <div className="md:hidden p-2 space-y-1.5">
      {/* Totales arriba */}
      <div className="bg-[#0A0A0A] rounded-xl border border-white/10 overflow-hidden">
        <button className="w-full flex items-center justify-between px-3 py-2" onClick={() => setExpandedTotals(prev => !prev)}>
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-wide font-bold">Total más barato · {lowestTotalMarket}</p>
            <p className="text-emerald-400 font-black text-base">{formatPrice(cartTotals[lowestTotalMarket] || 0)}</p>
            <p className="text-[9px] text-emerald-700">
              Ahorrás {formatPrice((listTotals[lowestTotalMarket] || 0) - (cartTotals[lowestTotalMarket] || 0))} vs precio de lista
            </p>
          </div>
          <ArrowRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedTotals ? 'rotate-90' : ''}`} />
        </button>

        {expandedTotals && (
          <div className="border-t border-white/10">
            {allMarkets.map(market => {
              const lista = listTotals[market] || 0
              const conDesc = cartTotals[market] || 0
              const ahorrado = lista - conDesc
              const isBest = market === lowestTotalMarket
              return (
                <div key={market} className={`px-3 py-2 border-b border-white/5 ${isBest ? 'bg-emerald-500/5' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                      <p className={`text-[11px] font-bold ${isBest ? 'text-emerald-400' : 'text-slate-300'}`}>{market} {isBest && '★'}</p>
                    </div>
                    <p className={`text-sm font-black ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(conDesc)}</p>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 pl-3">
                    <span>Lista: {formatPrice(lista)}</span>
                    {ahorrado > 0 && <span className="text-emerald-700">Ahorrás {formatPrice(ahorrado)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Productos */}
      {cart.map(row => {
        const isExpanded = expandedProducts.has(row.ean)
        const bestPrice = Math.min(...Object.values(row.markets).map(m => getEffectivePrice(m, row.quantity)))
        const bestMarketForRow = allMarkets.find(mk => row.markets[mk] && getEffectivePrice(row.markets[mk], row.quantity) === bestPrice) || ''
        const hasPromo = Object.values(row.markets).some(m => m.promoLabel)

        return (
          <div key={row.ean} className="bg-[#1A1A1A] rounded-xl border border-white/10 overflow-hidden">
            {/* Fila compacta */}
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-8 h-8 bg-white rounded-lg p-0.5 shrink-0">
                <img src={row.imageUrl} alt={row.name} className="w-full h-full object-contain mix-blend-multiply" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-slate-200 line-clamp-1 leading-tight">{row.name}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SUPERMARKET_DOT[bestMarketForRow] || SUPERMARKET_DOT.default}`} />
                  <p className="text-emerald-400 font-black text-[11px]">{formatPrice(bestPrice)}</p>
                  {hasPromo && <span className="text-[9px] text-orange-400">🔥</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 rounded-lg px-1.5 py-1 border border-white/10 shrink-0">
                <button onClick={() => updateQuantity(row.ean, -1)} className="text-slate-400"><Minus className="w-3 h-3" /></button>
                <span className="text-[11px] font-medium w-3 text-center">{row.quantity}</span>
                <button onClick={() => updateQuantity(row.ean, 1)} className="text-slate-400"><Plus className="w-3 h-3" /></button>
              </div>
              <button onClick={() => removeFromCart(row.ean)} className="text-slate-600 hover:text-red-400 shrink-0 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {hasPromo && (
                <button onClick={() => toggleProduct(row.ean)} className="text-slate-500 shrink-0">
                  <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            {/* Detalle promos por super (expandido) */}
            {isExpanded && (
              <div className="border-t border-white/10">
                {allMarkets.map(market => {
                  const m = row.markets[market]
                  if (!m || !m.promoLabel) return null
                  const promoActiva = m.promoQty ? row.quantity >= m.promoQty : false
                  const faltanParaPromo = m.promoQty && !promoActiva ? m.promoQty - row.quantity : 0
                  const precioUnit = getEffectivePrice(m, row.quantity)
                  return (
                    <div key={market} className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                        <div>
                          <p className="text-[10px] font-bold text-slate-300">{market}</p>
                          <p className={`text-[9px] font-bold ${promoActiva ? 'text-orange-400' : 'text-amber-500/60'}`}>
                            🔥 {m.promoLabel}{faltanParaPromo > 0 ? ` (agregá ${faltanParaPromo} más)` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {m.price > precioUnit && <p className="text-[9px] text-slate-500 line-through">{formatPrice(m.price)}</p>}
                        <p className="text-[11px] font-bold text-white">{formatPrice(precioUnit)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

    </div>
  )
}

export default function PreciosPage() {
  const [section, setSection] = useState<'supermercados' | 'farmacias' | 'electrónica'>('supermercados')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<GroupedProduct[]>([])
  // Filtros para sección Electrónica
  const [electroFilters, setElectroFilters] = useState<{
    brands: string[]
    stores: string[]
    categories: string[]
    priceMin: number
    priceMax: number
  }>({ brands: [], stores: [], categories: [], priceMin: 0, priceMax: Infinity })
  const [showElectroFilters, setShowElectroFilters] = useState(true)

  const [cart, setCart] = useState<CartRow[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('promoar-precios-cart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [similarSearch, setSimilarSearch] = useState<{ ean: string; market: string; catId: string; excludeEan: string } | null>(null)

  // Persistir carrito en localStorage
  useEffect(() => {
    try { localStorage.setItem('promoar-precios-cart', JSON.stringify(cart)) } catch {}
  }, [cart])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [mlLoading, setMlLoading] = useState(false)
  const mlQueryRef = useRef<string>('')

  const [selectedStores, setSelectedStores] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(NATIONAL_STORES_SUPER)
    try {
      const saved = localStorage.getItem('promoar-precios-stores')
      if (saved) return new Set(JSON.parse(saved))
    } catch {}
    return new Set(NATIONAL_STORES_SUPER)
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('promoar-precios-stores', JSON.stringify(Array.from(selectedStores))) } catch {}
  }, [selectedStores])

  const toggleStore = (store: string) => {
    setSelectedStores(prev => {
      const next = new Set(prev)
      if (next.has(store)) next.delete(store)
      else next.add(store)
      return next
    })
  }

  const showToast = (message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const fetchMLClientSide = useCallback(async (q: string) => {
    mlQueryRef.current = q
    setMlLoading(true)
    try {
      const res = await fetch(
        `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}&limit=50&condition=new`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok || mlQueryRef.current !== q) return
      const data = await res.json()
      const items: GroupedProduct[] = (data.results || [])
        .filter((item: any) => item.price > 0 && item.condition === 'new')
        .slice(0, 30)
        .map((item: any) => {
          const originalPrice: number = item.original_price || item.price
          const finalPrice: number = item.price
          const discountPct = originalPrice > finalPrice ? Math.round((1 - finalPrice / originalPrice) * 100) : 0
          const brand = item.attributes?.find((a: any) => a.id === 'BRAND')?.value_name || '-'
          return {
            ean: `ml-${item.id}`,
            name: item.title,
            brand,
            imageUrl: (item.thumbnail || '').replace('-I.jpg', '-O.jpg').replace('http:', 'https:'),
            minPrice: finalPrice,
            maxPrice: originalPrice,
            bestMarket: 'MercadoLibre',
            availableIn: 1,
            markets: {
              MercadoLibre: {
                id: item.id,
                supermarket: 'MercadoLibre',
                price: originalPrice,
                finalPrice,
                discountText: discountPct > 0 ? `${discountPct}% OFF` : '-',
                url: item.permalink,
              }
            },
          }
        })
      if (mlQueryRef.current !== q) return
      setProducts(prev => {
        const existingEans = new Set(prev.map(p => p.ean))
        const newItems = items.filter(i => !existingEans.has(i.ean))
        return [...prev, ...newItems]
      })
    } catch {
      // silencioso — ML client-side es best-effort
    } finally {
      if (mlQueryRef.current === q) setMlLoading(false)
    }
  }, [])

  const handleSearch = async (e?: React.FormEvent, isCategory = false, categoryId = '', overrideQ?: string) => {
    if (e) e.preventDefault()
    const effectiveQ = overrideQ !== undefined ? overrideQ : query
    if (!isCategory && !effectiveQ.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      const storesParam = section === 'supermercados'
        ? `&stores=${Array.from(selectedStores).join(',')}`
        : section === 'farmacias'
        ? `&stores=${ALL_SUPERMARKETS_FARMA.join(',')}`
        : ''
      const url = isCategory
        ? `/api/precios/search?cat=${categoryId}&section=${section}${storesParam}`
        : `/api/precios/search?q=${encodeURIComponent(effectiveQ)}&section=${section}${storesParam}`

      const data = await fetch(url).then(r => r.json())
      if (data.results) {
        setProducts(data.results)
        setElectroFilters({ brands: [], stores: [], categories: [], priceMin: 0, priceMax: Infinity })
        // ML se busca desde el browser (las IPs de Vercel están bloqueadas por ML)
        if (section === 'electrónica' && effectiveQ.trim()) {
          fetchMLClientSide(effectiveQ.trim())
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSectionChange = (newSection: 'supermercados' | 'farmacias' | 'electrónica') => {
    setSection(newSection)
    setProducts([])
    setHasSearched(false)
    setQuery('')
  }

  const addToCart = (product: GroupedProduct) => {
    // Construir datos por supermercado — precios base, la promo se activa dinámicamente según cantidad
    const marketsData: CartRow['markets'] = {}
    for (const [name, m] of Object.entries(product.markets)) {
      const hasDiscount = m.price > m.finalPrice || m.multiUnitPromo
      marketsData[name] = {
        price: m.price,
        finalPrice: m.finalPrice,
        effectivePrice: m.multiUnitPromo ? m.multiUnitPromo.effectivePrice : m.finalPrice,
        promoLabel: m.multiUnitPromo?.label || (hasDiscount && m.discountText !== '-' ? m.discountText : undefined),
        promoQty: m.multiUnitPromo?.requiredQty,
        jumboCheck: m.jumboCheck,
        url: m.url,
      }
    }

    setCart(prev => {
      const existing = prev.find(r => r.ean === product.ean)
      if (existing) {
        return prev.map(r => r.ean === product.ean ? { ...r, quantity: r.quantity + 1, markets: marketsData } : r)
      }
      // Tomar vtexCategoryId del primer mercado que lo tenga
      const firstMarket = Object.values(product.markets)[0] as any
      return [...prev, {
        ean: product.ean,
        name: product.name,
        imageUrl: product.imageUrl,
        quantity: 1,
        vtexCategoryId: firstMarket?.vtexCategoryId || '',
        vtexCategory: firstMarket?.vtexCategory || '',
        searchQuery: query, // guardar la búsqueda original
        markets: marketsData
      }]
    })

    showToast(`${product.name.slice(0, 30)}... agregado al carrito`)
    setIsCartOpen(true)
  }

  const updateQuantity = (ean: string, delta: number) => {
    setCart(prev => prev.map(r => {
      if (r.ean !== ean) return r
      return { ...r, quantity: Math.max(0, r.quantity + delta) }
    }).filter(r => r.quantity > 0))
  }

  const removeFromCart = (ean: string) => setCart(prev => prev.filter(r => r.ean !== ean))

  const replaceMarket = (ean: string, market: string, replacement: {
    price: number; effectivePrice: number; promoLabel?: string; promoQty?: number; url: string
  }) => {
    setCart(prev => prev.map(r => {
      if (r.ean !== ean) return r
      return {
        ...r,
        markets: {
          ...r.markets,
          [market]: {
            price: replacement.price,
            finalPrice: replacement.price,
            effectivePrice: replacement.effectivePrice,
            promoLabel: replacement.promoLabel,
            promoQty: replacement.promoQty,
            url: replacement.url,
          }
        }
      }
    }))
  }

  // Precio efectivo por unidad según cantidad: activa la promo si se cumple la condición
  const getEffectivePrice = (m: CartRow['markets'][string], qty: number): number =>
    (m.promoQty && qty >= m.promoQty) ? m.effectivePrice : m.finalPrice

  // Totales por supermercado considerando los productos disponibles en cada uno
  // Siempre mostrar todas las columnas de supermercados de la sección activa
  const baseMarkets = section === 'farmacias' ? ALL_SUPERMARKETS_FARMA
    : section === 'electrónica' ? ALL_SUPERMARKETS_ELECTRO
    : ALL_SUPERMARKETS_SUPER.filter(s => selectedStores.has(s))
  // Agregar cualquier supermercado extra que esté en el carrito pero no en la lista base
  const cartMarkets = Array.from(new Set(cart.flatMap(r => Object.keys(r.markets))))
  const allMarkets = Array.from(new Set([...baseMarkets, ...cartMarkets]))
  const cartTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + getEffectivePrice(m, row.quantity) * row.quantity : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const cartTotalItems = cart.reduce((acc, r) => acc + r.quantity, 0)
  const lowestTotalMarket = Object.entries(cartTotals).filter(([, v]) => (v as number) > 0).sort(([, a], [, b]) => (a as number) - (b as number))[0]?.[0] || ''

  const rootCats = CATEGORIES.filter(c => !c.section || c.section === 'supermercados')
  const farmaCats = CATEGORIES.filter(c => c.section === 'farmacias')
  const electroCats = CATEGORIES.filter(c => c.section === 'electrónica')

  const sidebarInner = (
    <>
      {/* Logo — solo en desktop */}
      <Link href="/promos" className="hidden lg:flex items-center justify-center pb-4 border-b border-gray-200/60 dark:border-slate-700/60 mb-4">
        <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={80} height={80} className="w-20 h-20 object-contain" />
      </Link>

      <div className="hidden lg:block mb-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2 font-bold px-1">Sección</p>
        {(['supermercados', 'farmacias', 'electrónica'] as const).map(s => (
          <button key={s} onClick={() => handleSectionChange(s)}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm mb-1 flex items-center gap-2 transition-colors font-medium ${section === s
              ? (s === 'farmacias' ? 'bg-green-600' : s === 'electrónica' ? 'bg-purple-600' : 'bg-[#1E3A5F]') + ' text-white shadow-sm'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
            {s === 'supermercados' ? '🛒 Supermercados' : s === 'farmacias' ? '💊 Farmacias' : '📺 Electrónica'}
          </button>
        ))}
      </div>

      {section === 'supermercados' && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-bold">Dónde buscar</p>
            <button onClick={() => setSelectedStores(new Set(NATIONAL_STORES_SUPER))} className="text-[10px] text-[#1E3A5F] dark:text-blue-400 hover:underline transition-colors font-semibold">Nacionales</button>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-600 mb-1 mt-2 uppercase tracking-wide font-bold px-1">Nacional</p>
          {NATIONAL_STORES_SUPER.map(store => (
            <label key={store} className="flex items-center gap-2.5 py-1.5 cursor-pointer group px-1">
              <input type="checkbox" checked={selectedStores.has(store)} onChange={() => toggleStore(store)} className="w-3.5 h-3.5 cursor-pointer accent-[#1E3A5F]" />
              <span className={`w-2 h-2 rounded-full shrink-0 ${SUPERMARKET_DOT[store] || SUPERMARKET_DOT.default}`} />
              <span className="text-sm text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-none">{store}</span>
            </label>
          ))}
          <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-3 mb-1 uppercase tracking-wide font-bold px-1">Interior</p>
          {REGIONAL_STORES_SUPER.map(store => (
            <label key={store} className="flex items-center gap-2.5 py-1.5 cursor-pointer group px-1">
              <input type="checkbox" checked={selectedStores.has(store)} onChange={() => toggleStore(store)} className="w-3.5 h-3.5 cursor-pointer accent-[#1E3A5F]" />
              <span className={`w-2 h-2 rounded-full shrink-0 ${SUPERMARKET_DOT[store] || SUPERMARKET_DOT.default}`} />
              <span className="text-sm text-gray-600 dark:text-slate-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors leading-none">{store}</span>
            </label>
          ))}
        </div>
      )}

      {(section === 'supermercados' || section === 'farmacias' || section === 'electrónica') && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2 font-bold px-1">Categorías</p>
          {(section === 'farmacias' ? farmaCats : section === 'electrónica' ? electroCats : rootCats).map(cat => (
            <button key={cat.id}
              onClick={() => { handleSearch(undefined, true, cat.id); setSidebarOpen(false) }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-between group transition-colors font-medium">
              <span>{cat.name}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-gray-500 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Volver a PromoAR */}
      <div className="mt-auto pt-4 border-t border-gray-200/60 dark:border-slate-700/60">
        <Link href="/promos" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-[#1E3A5F] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium">
          ← Volver a PromoAR
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans">
      {/* Barcode scanner */}
      {scannerOpen && (
        <BarcodeScannerModal
          onDetect={(ean) => {
            setScannerOpen(false)
            setQuery(ean)
            handleSearch(undefined, false, '', ean)
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Toasts */}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1E3A5F] text-white text-sm px-4 py-2.5 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            {t.message}
          </div>
        ))}
      </div>

      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-700/60 lg:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/promos" className="flex items-center gap-2.5">
            <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="font-black text-[#1E3A5F] dark:text-white tracking-tight text-lg leading-none">PromoAR</span>
          </Link>
          <div className="flex items-center gap-2">
            {section !== 'electrónica' && (
              <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-slate-400" />
                {cartTotalItems > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#1E3A5F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartTotalItems}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-950 border-r border-gray-200/60 dark:border-slate-700/60 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex bg-[#1A1A1A] border border-white/10 rounded-xl p-0.5 gap-0.5">
                {(['supermercados', 'farmacias', 'electrónica'] as const).map(s => (
                  <button key={s} onClick={() => { handleSectionChange(s); setSidebarOpen(false) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${section === s ? (s === 'farmacias' ? 'bg-green-600' : s === 'electrónica' ? 'bg-purple-600' : 'bg-indigo-600') + ' text-white' : 'text-slate-400 hover:text-white'}`}>
                    {s === 'supermercados' ? '🛒' : s === 'farmacias' ? '💊' : '📺'}
                  </button>
                ))}
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-gray-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-950 p-4 pt-6 gap-0">
          {sidebarInner}
        </aside>

        <main className="flex-1 min-w-0 px-4 lg:px-8 py-8">
          {/* Mobile: botón filtros + section tabs */}
          <div className="flex items-center gap-2 mb-5 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium shadow-sm">
              <Filter className="w-4 h-4" />
              Filtros
              {section === 'supermercados' && selectedStores.size !== ALL_SUPERMARKETS_SUPER.length && (
                <span className="text-xs bg-[#1E3A5F] text-white rounded-full px-1.5 py-0.5 font-bold">{selectedStores.size}</span>
              )}
            </button>
            <div className="flex bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-0.5 gap-0.5 shadow-sm">
              {(['supermercados', 'farmacias', 'electrónica'] as const).map(s => (
                <button key={s} onClick={() => handleSectionChange(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${section === s ? (s === 'farmacias' ? 'bg-green-600' : s === 'electrónica' ? 'bg-purple-600' : 'bg-[#1E3A5F]') + ' text-white shadow-sm' : 'text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'}`}>
                  {s === 'supermercados' ? '🛒' : s === 'farmacias' ? '💊' : '📺'}
                </button>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-700 ease-out flex flex-col items-center ${hasSearched ? 'mt-0 mb-12' : 'mt-[5vh]'}`}>
            {!hasSearched && (
              <div className="text-center mb-10 space-y-4">
                <div className="flex items-center justify-center">
                  <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={140} height={140} className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-sm" />
                </div>
                <p className="text-base text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
                  {section === 'supermercados'
                    ? 'Buscá un producto o elegí una categoría del menú lateral.'
                    : section === 'farmacias'
                    ? 'Buscá un medicamento o producto de farmacia.'
                    : 'Buscá un producto electrónico y comparalo entre tiendas.'}
                </p>
              </div>
            )}
            <div className="w-full max-w-2xl flex flex-col gap-4">
              <form onSubmit={handleSearch} className="w-full">
                <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm focus-within:border-[#1E3A5F]/40 dark:focus-within:border-blue-500/40 transition-colors">
                  <div className="pl-3 pr-2"><Search className="w-5 h-5 text-gray-400 dark:text-slate-500" /></div>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={section === 'supermercados' ? 'Buscá un producto o escaneá el código de barras 📷' : section === 'farmacias' ? 'Ej. Ibuprofeno 400mg...' : 'Ej. Samsung TV 55", Heladera no frost...'}
                    className="flex-1 bg-transparent text-base py-2.5 px-2 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 min-w-0"
                  />
                  {section === 'supermercados' && (
                    <button type="button" onClick={() => setScannerOpen(true)} title="Escanear código de barras"
                      className="p-2.5 text-gray-400 hover:text-[#1E3A5F] dark:hover:text-blue-400 transition-colors shrink-0 mr-0.5">
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                  <button type="submit" disabled={loading || !query.trim()} className="bg-[#1E3A5F] hover:bg-[#162d4a] text-white px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        {hasSearched && (
          <div className="space-y-6">
            {/* Header de resultados */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              {section === 'electrónica' && query && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                  <span>Electrónica</span>
                  <span className="text-gray-300 dark:text-slate-600">/</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{query}</span>
                  {mlLoading && <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400"><Loader2 className="w-3 h-3 animate-spin" />MercadoLibre...</span>}
                </div>
              )}
              {section !== 'electrónica' && <h3 className="text-xl font-black tracking-tight text-[#1E3A5F] dark:text-white">Resultados</h3>}
              <div className="flex items-center gap-3 ml-auto">
                {section === 'electrónica' && (
                  <button
                    onClick={() => setShowElectroFilters(!showElectroFilters)}
                    className="flex items-center gap-2 text-xs font-bold px-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl transition-colors hover:border-gray-300 shadow-sm"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" /> Filtrar
                  </button>
                )}
                {section !== 'electrónica' && (
                  <button onClick={() => setIsCartOpen(true)} className="relative flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white shadow-sm transition-colors">
                    <ShoppingCart className="w-4 h-4" />
                    Carrito
                    {cartTotalItems > 0 && <span className="bg-[#1E3A5F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{cartTotalItems}</span>}
                  </button>
                )}
                <p className="text-gray-400 dark:text-slate-500 text-sm">{(() => {
                  const filtered = section === 'electrónica' ? products.filter(p => {
                    const market = Object.values(p.markets)[0] as any
                    const store = market?.supermarket || p.bestMarket
                    const cat = extractCategory(market?.vtexCategory)
                    if (electroFilters.brands.length && !electroFilters.brands.includes(p.brand)) return false
                    if (electroFilters.stores.length && !electroFilters.stores.includes(store)) return false
                    if (electroFilters.categories.length && (!cat || !electroFilters.categories.includes(cat))) return false
                    if (p.minPrice < electroFilters.priceMin || p.minPrice > electroFilters.priceMax) return false
                    return true
                  }) : products
                  return `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
                })()}</p>
              </div>
            </div>

            {/* Layout con filtros para Electrónica */}
            <div className={section === 'electrónica' ? 'flex gap-6' : ''}>
              {/* Panel de filtros */}
              {section === 'electrónica' && showElectroFilters && (() => {
                const allBrands = Array.from(new Set(products.map(p => p.brand).filter(b => b && b !== '-'))).sort()
                const allStores = Array.from(new Set(products.map(p => {
                  const market = Object.values(p.markets)[0] as any
                  return market?.supermarket || p.bestMarket
                }))).sort()
                const allCategories = Array.from(new Set(products.map(p => {
                  const market = Object.values(p.markets)[0] as any
                  return extractCategory(market?.vtexCategory)
                }).filter(Boolean))).sort()
                const prices = products.map(p => p.minPrice).filter(Boolean)
                const globalMin = Math.min(...prices)
                const globalMax = Math.max(...prices)
                return (
                  <div className="w-56 shrink-0 space-y-4">
                    {allCategories.length > 0 && (
                      <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Categoría</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {allCategories.map(cat => (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                              <input type="checkbox" checked={electroFilters.categories.includes(cat)}
                                onChange={() => setElectroFilters(f => ({
                                  ...f, categories: f.categories.includes(cat) ? f.categories.filter(c => c !== cat) : [...f.categories, cat]
                                }))}
                                className="w-3.5 h-3.5 rounded accent-indigo-500" />
                              <span className="text-xs text-slate-300">{cat}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Marca</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allBrands.map(brand => (
                          <label key={brand} className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" checked={electroFilters.brands.includes(brand)}
                              onChange={() => setElectroFilters(f => ({
                                ...f, brands: f.brands.includes(brand) ? f.brands.filter(b => b !== brand) : [...f.brands, brand]
                              }))}
                              className="w-3.5 h-3.5 rounded accent-indigo-500" />
                            <span className="text-xs text-slate-300">{brand}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Tienda</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allStores.map(store => (
                          <label key={store} className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" checked={electroFilters.stores.includes(store)}
                              onChange={() => setElectroFilters(f => ({
                                ...f, stores: f.stores.includes(store) ? f.stores.filter(s => s !== store) : [...f.stores, store]
                              }))}
                              className="w-3.5 h-3.5 rounded accent-indigo-500" />
                            <span className="text-xs text-slate-300">{store}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Precio</p>
                      <div className="space-y-2">
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Mínimo</p>
                          <input type="number" min={globalMin} max={globalMax}
                            value={electroFilters.priceMin || ''}
                            onChange={e => setElectroFilters(f => ({ ...f, priceMin: Number(e.target.value) || 0 }))}
                            placeholder={formatPrice(globalMin)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 mb-1">Máximo</p>
                          <input type="number" min={globalMin} max={globalMax}
                            value={electroFilters.priceMax === Infinity ? '' : electroFilters.priceMax}
                            onChange={e => setElectroFilters(f => ({ ...f, priceMax: Number(e.target.value) || Infinity }))}
                            placeholder={formatPrice(globalMax)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none" />
                        </div>
                      </div>
                    </div>
                    {(electroFilters.brands.length > 0 || electroFilters.stores.length > 0 || electroFilters.categories.length > 0 || electroFilters.priceMin > 0 || electroFilters.priceMax < Infinity) && (
                      <button onClick={() => setElectroFilters({ brands: [], stores: [], categories: [], priceMin: 0, priceMax: Infinity })}
                        className="w-full text-xs text-slate-400 hover:text-white py-2 border border-white/10 rounded-xl transition-colors">
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                )
              })()}

            {/* Grid de productos */}
            <div className="flex-1">
            {products.length === 0 && !loading && (
              <div className="py-20 text-center text-slate-500 bg-[#1A1A1A] rounded-3xl border border-white/5">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No se encontraron resultados.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(section === 'electrónica' ? products.filter(p => {
                const market = Object.values(p.markets)[0] as any
                const store = market?.supermarket || p.bestMarket
                const cat = extractCategory((Object.values(p.markets)[0] as any)?.vtexCategory)
                if (electroFilters.brands.length && !electroFilters.brands.includes(p.brand)) return false
                if (electroFilters.stores.length && !electroFilters.stores.includes(store)) return false
                if (electroFilters.categories.length && (!cat || !electroFilters.categories.includes(cat))) return false
                if (p.minPrice < electroFilters.priceMin || p.minPrice > electroFilters.priceMax) return false
                return true
              }) : products).map(p => {
                const bestPromo = getBestPromo(p.markets, p.minPrice)
                return (
                  <div key={p.ean} className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col">
                    <div className="relative h-32 bg-white p-3 flex items-center justify-center">
                      {section !== 'electrónica' && (
                        <span className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-white px-3 py-1 text-xs font-bold rounded-full shadow-md z-10">
                          EAN: {p.ean || 'N/A'}
                        </span>
                      )}
                      {section === 'electrónica' && STORE_LOGOS[p.bestMarket] && (
                        <div className="absolute top-2 right-2 w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden border border-slate-100 z-10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={STORE_LOGOS[p.bestMarket]} alt={p.bestMarket} className="w-6 h-6 object-contain" />
                        </div>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain mix-blend-multiply" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400/eeeeee/999999?text=Sin+Imagen' }} />
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-3">
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{p.brand}</p>
                        <h4 className="text-base font-medium text-slate-200 line-clamp-2 leading-snug mt-1">{p.name}</h4>
                      </div>

                      {/* Badge precio normal */}
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {section === 'electrónica' && STORE_LOGOS[p.bestMarket] && (
                              <img src={STORE_LOGOS[p.bestMarket]} alt={p.bestMarket} className="w-4 h-4 object-contain rounded" />
                            )}
                            <p className="text-[10px] uppercase font-bold text-indigo-400">{p.bestMarket}</p>
                          </div>
                          <p className="text-2xl font-bold text-white tracking-tight">{formatPrice(p.minPrice)}</p>
                          {p.markets[p.bestMarket]?.discountText !== '-' && !p.markets[p.bestMarket]?.multiUnitPromo && (
                            <p className="text-[10px] text-emerald-400 font-bold mt-1 bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded">
                              {p.markets[p.bestMarket]?.discountText}
                            </p>
                          )}
                          {(() => {
                            const jc = Object.values(p.markets).find(m => (m as any).jumboCheck)
                            return jc ? (
                              <p className="text-[10px] font-black mt-1 bg-green-500/20 text-green-400 inline-block px-1.5 py-0.5 rounded border border-green-500/30">
                                J{(jc as any).jumboCheck}% Jumbo Cheques
                              </p>
                            ) : null
                          })()}
                        </div>
                        <p className="text-xs text-slate-400">En {p.availableIn} supers</p>
                      </div>

                      {/* Badge mejor precio en promo */}
                      {bestPromo && (
                        <div className="rounded-xl bg-gradient-to-r from-orange-500/25 to-amber-500/25 border border-orange-500/50 px-4 py-3 flex items-center justify-between shadow-lg shadow-orange-500/10">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-orange-400 mb-0.5">Mejor Precio en Promo · {bestPromo.market}</p>
                            <p className="text-xl font-black text-orange-300">{formatPrice(bestPromo.effectivePrice)}<span className="text-xs font-normal text-orange-400/70 ml-1">c/u</span></p>
                            <p className="text-[10px] text-amber-300/70 mt-0.5">comprando {bestPromo.promo.requiredQty} · {bestPromo.promo.label}</p>
                          </div>
                          <span className="text-2xl">🔥</span>
                        </div>
                      )}

                      <div className="mt-auto flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
                        >
                          Ver precios
                        </button>
                        {section !== 'electrónica' && <button
                          onClick={() => addToCart(p)}
                          className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                          title="Agregar al carrito"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            </div>{/* fin flex-1 grid */}
            </div>{/* fin flex gap-6 layout */}
          </div>
        )}
        </main>
      </div>{/* fin max-w-7xl flex */}

      {/* Modal de producto */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header del modal */}
            <div className="p-5 border-b border-white/10 flex items-start gap-4">
              <div className="w-16 h-16 bg-white rounded-xl p-1 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" onError={(e) => { e.currentTarget.src = 'https://placehold.co/100x100/eeeeee/999999?text=?' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wider">{selectedProduct.brand}</p>
                <p className="text-sm font-semibold text-white leading-snug mt-0.5">{selectedProduct.name}</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Lista de supers */}
            <div className="p-3 space-y-1.5 overflow-y-auto flex-1">
              {(() => {
                const modalBestPromo = getBestPromo(selectedProduct.markets, selectedProduct.minPrice)
                const overallWinner = modalBestPromo && modalBestPromo.promo.effectivePrice < selectedProduct.minPrice
                  ? modalBestPromo.market
                  : selectedProduct.bestMarket

                return Object.entries(selectedProduct.markets)
                  .sort(([, a], [, b]) => {
                    const aEff = a.multiUnitPromo ? a.multiUnitPromo.effectivePrice : a.finalPrice
                    const bEff = b.multiUnitPromo ? b.multiUnitPromo.effectivePrice : b.finalPrice
                    return aEff - bEff
                  })
                  .map(([marketName, m]) => {
                    const isWinner = marketName === overallWinner
                    return (
                      <div key={marketName} className={`rounded-2xl overflow-hidden border transition-all ${isWinner ? 'border-emerald-500/50 bg-emerald-500/5' : 'bg-[#1A1A1A] border-white/5'}`}>
                        {isWinner && (
                          <div className="bg-emerald-500/20 px-4 py-1 flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">★ Mejor precio</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${SUPERMARKET_DOT[marketName] || SUPERMARKET_DOT.default}`} />
                            <div>
                              <p className="text-sm font-semibold text-slate-200">{marketName}</p>
                              {m.discountText !== '-' && !m.multiUnitPromo && (
                                <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{m.discountText}</p>
                              )}
                              {(m as any).jumboCheck && (
                                <p className="text-[10px] font-black text-green-400 mt-0.5">J{(m as any).jumboCheck}% Jumbo Cheques</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              {m.multiUnitPromo ? (
                                <p className="text-base font-bold text-slate-400 line-through">{formatPrice(m.price)}</p>
                              ) : (
                                <>
                                  {m.price > m.finalPrice && <p className="text-[10px] text-slate-500 line-through">{formatPrice(m.price)}</p>}
                                  <p className="text-base font-bold text-white">{formatPrice(m.finalPrice)}</p>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => addToCart(selectedProduct)}
                              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                              title="Agregar en todos los supermercados"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>

                        {m.primePromo && (
                          <div className="mx-3 mb-2 rounded-xl px-3 py-2.5 flex items-center justify-between border bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/40">
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-violet-300">⭐ Prime: {m.primePromo.label}</p>
                              <p className="text-[11px] text-violet-300/60 mt-0.5">comprando {m.primePromo.requiredQty} unidades</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-violet-400/70">c/u con Prime</p>
                              <p className="font-black text-violet-300 text-base">
                                {formatPrice(Math.min(m.finalPrice, m.primePromo.effectivePrice))}
                              </p>
                            </div>
                          </div>
                        )}

                        {m.multiUnitPromo && (
                          <div className={`mx-3 mb-3 rounded-xl px-3 py-2.5 flex items-center justify-between border ${isWinner ? 'bg-gradient-to-r from-orange-500/30 to-amber-500/30 border-orange-500/60' : 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30'}`}>
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-orange-400">🔥 {m.multiUnitPromo.label}</p>
                              <p className="text-[11px] text-amber-300/70 mt-0.5">comprando {m.multiUnitPromo.requiredQty} unidades</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-orange-400/70">c/u efectivo</p>
                              <p className={`font-black text-orange-300 ${isWinner ? 'text-xl' : 'text-base'}`}>
                                {formatPrice(Math.min(m.finalPrice, m.multiUnitPromo.effectivePrice))}
                              </p>
                            </div>
                          </div>
                        )}

                        {m.url && (
                          <a href={`/api/r?url=${encodeURIComponent(m.url)}&src=precios`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 pb-3 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                            <ExternalLink className="w-3 h-3" /> Ver en {marketName}
                          </a>
                        )}
                      </div>
                    )
                  })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Cart Table — solo para supermercados y farmacias */}
      {isCartOpen && cart.length > 0 && section !== 'electrónica' && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative m-4 mt-16 bg-[#111111] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold">Comparador de Carrito</h2>
                <span className="text-xs text-slate-400">{cart.length} producto{cart.length !== 1 ? 's' : ''}</span>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile: tarjetas verticales / Desktop: tabla horizontal */}
            <div className="flex-1 overflow-auto">

              {/* MOBILE: acordeón */}
              <MobileCart
                cart={cart}
                allMarkets={allMarkets}
                cartTotals={cartTotals}
                lowestTotalMarket={lowestTotalMarket}
                getEffectivePrice={getEffectivePrice}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />

              {/* DESKTOP: tabla horizontal */}
              <table className="hidden md:table w-full text-sm border-collapse">
                <thead>
                  {/* Fila de totales arriba — sticky */}
                  <tr className="border-b-2 border-white/20 bg-[#0A0A0A]">
                    <td className="p-3 sticky left-0 bg-[#0A0A0A]">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-wide">TOTAL</p>
                    </td>
                    <td />
                    {allMarkets.map(market => {
                      const lista = cart.reduce((sum, row) => { const m = row.markets[market]; return m ? sum + m.price * row.quantity : sum }, 0)
                      const conDesc = cartTotals[market] || 0
                      const ahorrado = lista - conDesc
                      const isBest = market === lowestTotalMarket
                      return (
                        <td key={market} className={`p-3 text-center ${isBest ? 'bg-emerald-500/10' : ''}`}>
                          <p className={`text-base font-black ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(conDesc)}</p>
                          {lista > conDesc && <p className="text-[9px] text-slate-500 line-through">{formatPrice(lista)}</p>}
                          {ahorrado > 0 && <p className="text-[9px] text-emerald-600 font-bold">-{formatPrice(ahorrado)}</p>}
                          {isBest && <p className="text-[9px] text-emerald-500 font-bold uppercase mt-0.5">Más barato ★</p>}
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                  {/* Headers de columnas */}
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-slate-400 font-medium text-xs uppercase tracking-wide sticky left-0 bg-[#111111] min-w-[200px]">Producto</th>
                    <th className="text-center p-4 text-slate-400 font-medium text-xs uppercase tracking-wide min-w-[60px]">Cant.</th>
                    {allMarkets.map(market => (
                      <th key={market} className={`text-center p-4 text-xs font-bold uppercase tracking-wide min-w-[140px] ${market === lowestTotalMarket ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                          {market}
                          {market === lowestTotalMarket && <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.5 rounded font-black">★</span>}
                        </div>
                      </th>
                    ))}
                    <th className="p-4 min-w-[40px]" />
                  </tr>
                </thead>
                <tbody>
                  {cart.map(row => (
                    <tr key={row.ean} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="p-4 sticky left-0 bg-[#111111]">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg p-1 shrink-0">
                            <img src={row.imageUrl} alt={row.name} className="w-full h-full object-contain mix-blend-multiply" />
                          </div>
                          <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-tight">{row.name}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2 bg-black/40 rounded-lg p-1 border border-white/10">
                          <button onClick={() => updateQuantity(row.ean, -1)} className="p-0.5 hover:bg-white/10 rounded text-slate-400"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs font-medium w-5 text-center">{row.quantity}</span>
                          <button onClick={() => updateQuantity(row.ean, 1)} className="p-0.5 hover:bg-white/10 rounded text-slate-400"><Plus className="w-3 h-3" /></button>
                        </div>
                      </td>
                      {allMarkets.map(market => {
                        const m = row.markets[market]
                        const isBest = market === lowestTotalMarket
                        if (!m) return (
                          <td key={market} className="p-3 text-center">
                            <button
                              onClick={() => setSimilarSearch({ ean: row.ean, market, catId: row.vtexCategoryId || '', excludeEan: row.ean })}
                              className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors border border-white/10 hover:border-indigo-500/40 rounded-lg px-2 py-1"
                            >
                              + similar
                            </button>
                          </td>
                        )
                        const promoActiva = m.promoQty ? row.quantity >= m.promoQty : false
                        const precioUnit = getEffectivePrice(m, row.quantity)
                        const totalLine = precioUnit * row.quantity
                        const faltanParaPromo = m.promoQty && !promoActiva ? m.promoQty - row.quantity : 0
                        return (
                          <td key={market} className={`p-3 text-center ${isBest ? 'bg-emerald-500/5' : ''}`}>
                            {m.price > precioUnit && <p className="text-[10px] text-slate-500 line-through">{formatPrice(m.price)}</p>}
                            <p className={`text-sm font-bold ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(precioUnit)}</p>
                            {m.promoLabel && (
                              <p className={`text-[9px] font-bold mt-0.5 ${promoActiva ? 'text-orange-400' : 'text-amber-500/60'}`}>
                                🔥 {m.promoLabel}{!promoActiva && faltanParaPromo > 0 ? ` (+${faltanParaPromo})` : ''}
                              </p>
                            )}
                            <p className="text-[10px] text-slate-500 mt-1">{formatPrice(totalLine)}</p>
                            <button
                              onClick={() => setSimilarSearch({ ean: row.ean, market, catId: row.vtexCategoryId || '', excludeEan: row.ean })}
                              className="text-[9px] text-slate-600 hover:text-indigo-400 transition-colors mt-0.5"
                            >
                              ↔ reemplazar
                            </button>
                          </td>
                        )
                      })}
                      <td className="p-4">
                        <button onClick={() => removeFromCart(row.ean)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal buscar similar */}
      {similarSearch && (
        <SimilarProductModal
          ean={similarSearch.ean}
          market={similarSearch.market}
          catId={similarSearch.catId}
          excludeEan={similarSearch.excludeEan}
          cartRow={cart.find(r => r.ean === similarSearch.ean)!}
          onSelect={(market, item) => {
            replaceMarket(similarSearch.ean, market, {
              price: item.price,
              effectivePrice: item.price,
              url: item.url || '',
            })
            // Actualizar nombre e imagen del carrito para ese mercado
            setCart(prev => prev.map(r => {
              if (r.ean !== similarSearch.ean) return r
              return { ...r, name: item.name, imageUrl: item.imageUrl, ean: item.ean }
            }))
            setSimilarSearch(null)
          }}
          onClose={() => setSimilarSearch(null)}
        />
      )}
    </div>
  )
}

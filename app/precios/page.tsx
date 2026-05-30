'use client'

import React, { useState } from 'react'
import { Search, ShoppingCart, Loader2, Store, Plus, Minus, Trash2, ArrowRight, X, ExternalLink } from 'lucide-react'
import CategorySelector from './CategorySelector'

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
  markets: Record<string, {
    price: number         // precio de lista
    finalPrice: number    // precio sin promo multiunit
    effectivePrice: number // precio por unidad CON promo activa
    promoLabel?: string
    promoQty?: number     // unidades requeridas para activar la promo
    url: string
  }>
}

interface Toast {
  id: number
  message: string
}

const formatPrice = (p: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(p)

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
  const [section, setSection] = useState<'supermercados' | 'farmacias'>('supermercados')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<GroupedProduct[]>([])
  const [cart, setCart] = useState<CartRow[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = (message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const handleSearch = async (e?: React.FormEvent, isCategory = false, categoryId = '') => {
    if (e) e.preventDefault()
    if (!isCategory && !query.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      const url = isCategory
        ? `/api/precios/search?cat=${categoryId}&section=${section}`
        : `/api/precios/search?q=${encodeURIComponent(query)}&section=${section}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) setProducts(data.results || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSectionChange = (newSection: 'supermercados' | 'farmacias') => {
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
        url: m.url,
      }
    }

    setCart(prev => {
      const existing = prev.find(r => r.ean === product.ean)
      if (existing) {
        return prev.map(r => r.ean === product.ean ? { ...r, quantity: r.quantity + 1, markets: marketsData } : r)
      }
      return [...prev, { ean: product.ean, name: product.name, imageUrl: product.imageUrl, quantity: 1, markets: marketsData }]
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

  // Precio efectivo por unidad según cantidad: activa la promo si se cumple la condición
  const getEffectivePrice = (m: CartRow['markets'][string], qty: number): number =>
    (m.promoQty && qty >= m.promoQty) ? m.effectivePrice : m.finalPrice

  // Totales por supermercado considerando los productos disponibles en cada uno
  const allMarkets = [...new Set(cart.flatMap(r => Object.keys(r.markets)))]
  const cartTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + getEffectivePrice(m, row.quantity) * row.quantity : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const cartTotalItems = cart.reduce((acc, r) => acc + r.quantity, 0)
  const lowestTotalMarket = Object.entries(cartTotals).filter(([, v]) => v > 0).sort(([, a], [, b]) => a - b)[0]?.[0] || ''

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-[#1A1A1A] border border-white/10 text-sm text-white px-4 py-2.5 rounded-xl shadow-xl animate-in slide-in-from-bottom-4 duration-300">
            {t.message}
          </div>
        ))}
      </div>

      <header className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Store className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              PromoAR <span className="font-light">Precios B2B</span>
            </h1>
          </div>
          <button onClick={() => setIsCartOpen(true)} className="relative p-3 rounded-xl hover:bg-white/5 transition-colors group">
            <ShoppingCart className="w-6 h-6 text-slate-300 group-hover:text-white transition-colors" />
            {cartTotalItems > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-indigo-500 text-white text-xs font-bold rounded-full flex items-center justify-center ring-2 ring-[#0A0A0A]">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Tabs de sección */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-[#1A1A1A] border border-white/10 rounded-2xl p-1 gap-1">
            <button
              onClick={() => handleSectionChange('supermercados')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${section === 'supermercados' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              🛒 Supermercados
            </button>
            <button
              onClick={() => handleSectionChange('farmacias')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${section === 'farmacias' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              💊 Farmacias
            </button>
          </div>
        </div>

        <div className={`transition-all duration-700 ease-out flex flex-col items-center ${hasSearched ? 'mt-0 mb-12' : 'mt-[5vh]'}`}>
          {!hasSearched && (
            <div className="text-center mb-10 space-y-4">
              <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight">
                {section === 'supermercados' ? 'Consolidá el mercado' : 'Compará farmacias'}
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                {section === 'supermercados'
                  ? 'Buscá un producto y mirá su precio en los principales supermercados cruzando por EAN.'
                  : 'Buscá un medicamento o producto de farmacia y comparalo entre Farmacity y Farmaplus.'}
              </p>
            </div>
          )}
          <div className="w-full max-w-3xl flex flex-col gap-4">
            <form onSubmit={handleSearch} className="relative group w-full">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
              <div className="relative flex items-center bg-[#1A1A1A] border border-white/10 rounded-2xl p-2 shadow-2xl focus-within:border-indigo-500/50 transition-colors">
                <div className="pl-4 pr-2"><Search className="w-6 h-6 text-slate-400" /></div>
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={section === 'supermercados' ? 'Ej. Coca Cola Lata...' : 'Ej. Ibuprofeno 400mg...'}
                  className="flex-1 bg-transparent text-base py-3 px-2 outline-none text-white placeholder:text-slate-500 min-w-0"
                />
                <button type="submit" disabled={loading || !query.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 sm:px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                </button>
              </div>
            </form>
            <div className="flex justify-center">
              <CategorySelector section={section} onSelectCategory={(catId) => handleSearch(undefined, true, catId)} />
            </div>
          </div>
        </div>

        {hasSearched && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold">Resultados Consolidados</h3>
              <p className="text-slate-400">{products.length} productos agrupados</p>
            </div>
            {products.length === 0 && !loading && (
              <div className="py-20 text-center text-slate-500 bg-[#1A1A1A] rounded-3xl border border-white/5">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No se encontraron resultados.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(p => {
                const bestPromo = getBestPromo(p.markets, p.minPrice)
                return (
                  <div key={p.ean} className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col">
                    <div className="relative h-32 bg-white p-3 flex items-center justify-center">
                      <span className="absolute top-3 right-3 bg-black/80 backdrop-blur-md text-white px-3 py-1 text-xs font-bold rounded-full shadow-md z-10">
                        EAN: {p.ean || 'N/A'}
                      </span>
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
                          <p className="text-[10px] uppercase font-bold text-indigo-400 mb-0.5">Mejor Precio en {p.bestMarket}</p>
                          <p className="text-2xl font-bold text-white tracking-tight">{formatPrice(p.minPrice)}</p>
                          {p.markets[p.bestMarket]?.discountText !== '-' && !p.markets[p.bestMarket]?.multiUnitPromo && (
                            <p className="text-[10px] text-emerald-400 font-bold mt-1 bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded">
                              {p.markets[p.bestMarket]?.discountText}
                            </p>
                          )}
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
                        <button
                          onClick={() => addToCart(p)}
                          className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                          title="Agregar al carrito"
                        >
                          <Plus className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

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

      {/* Cart Table */}
      {isCartOpen && cart.length > 0 && (
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
                        if (!m) return <td key={market} className="p-4 text-center text-slate-600 text-xs">—</td>
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
    </div>
  )
}

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

interface CartItem {
  id: string
  ean: string
  supermarket: string
  name: string
  imageUrl: string
  price: number
  finalPrice: number
  quantity: number
  promoLabel?: string
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

export default function PreciosPage() {
  const [section, setSection] = useState<'supermercados' | 'farmacias'>('supermercados')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<GroupedProduct[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
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

  const addToCart = (product: GroupedProduct, marketName: string) => {
    const market = product.markets[marketName]
    const qty = market.multiUnitPromo?.requiredQty ?? 1
    const promoLabel = market.multiUnitPromo?.label

    setCart(prev => {
      const existing = prev.find(p => p.id === market.id)
      if (existing) {
        return prev.map(p => p.id === market.id ? { ...p, quantity: p.quantity + qty } : p)
      }
      return [...prev, {
        id: market.id,
        ean: product.ean,
        supermarket: marketName,
        name: product.name,
        imageUrl: product.imageUrl,
        price: market.price,
        finalPrice: market.finalPrice,
        quantity: qty,
        promoLabel,
      }]
    })

    if (promoLabel) {
      showToast(`Se agregaron ${qty} para aprovechar el ${promoLabel}`)
    } else {
      showToast(`${product.name.slice(0, 30)}... agregado al carrito`)
    }
    setIsCartOpen(true)
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(p => {
      if (p.id !== id) return p
      return { ...p, quantity: Math.max(0, p.quantity + delta) }
    }).filter(p => p.quantity > 0))
  }

  const cartTotals = cart.reduce((acc, item) => {
    if (!acc[item.supermarket]) acc[item.supermarket] = 0
    acc[item.supermarket] += item.finalPrice * item.quantity
    return acc
  }, {} as Record<string, number>)

  const cartTotalItems = cart.reduce((acc, item) => acc + item.quantity, 0)
  const lowestTotalMarket = Object.entries(cartTotals).sort(([, a], [, b]) => a - b)[0]?.[0] || ''

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
                  placeholder={section === 'supermercados' ? 'Ej. Coca Cola Lata, Galletitas Oreo...' : 'Ej. Ibuprofeno 400mg, Paracetamol...'}
                  className="flex-1 bg-transparent text-xl py-3 px-2 outline-none text-white placeholder:text-slate-500"
                />
                <button type="submit" disabled={loading || !query.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
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
                    <div className="relative h-48 bg-white p-4 flex items-center justify-center">
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

                      <button
                        onClick={() => setSelectedProduct(p)}
                        className="mt-auto w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors"
                      >
                        Ver precios en todos los supers
                      </button>
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
          <div className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
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
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
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
                              onClick={() => addToCart(selectedProduct, marketName)}
                              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>

                        {m.multiUnitPromo && (
                          <div className={`mx-3 mb-2 rounded-xl px-3 py-2.5 flex items-center justify-between border ${isWinner ? 'bg-gradient-to-r from-orange-500/30 to-amber-500/30 border-orange-500/60' : 'bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30'}`}>
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

                        {m.primePromo && (
                          <div className="mx-3 mb-3 rounded-xl px-3 py-2.5 flex items-center justify-between border bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/40">
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

                        {m.url && (
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 pb-3 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
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

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-[#111111] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-indigo-400" />
                <h2 className="text-xl font-bold">Tu Carrito ({cartTotalItems})</h2>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                  <ShoppingCart className="w-16 h-16 opacity-20" />
                  <p>Tu carrito está vacío</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="bg-[#1A1A1A] p-3 rounded-2xl border border-white/5 flex gap-4">
                    <div className="w-16 h-16 bg-white rounded-xl p-1 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain mix-blend-multiply" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-tight">{item.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-wider flex-shrink-0 ${SUPERMARKET_COLORS[item.supermarket] || SUPERMARKET_COLORS.default}`}>
                            {item.supermarket}
                          </span>
                        </div>
                        {item.promoLabel && (
                          <span className="text-[10px] text-orange-400 font-bold mt-0.5 inline-block">🔥 {item.promoLabel}</span>
                        )}
                        <p className="text-indigo-400 font-bold mt-1">{formatPrice(item.finalPrice)}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1 border border-white/10">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white/10 rounded-md text-slate-400">
                            {item.quantity === 1 ? <Trash2 className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4" />}
                          </button>
                          <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white/10 rounded-md text-slate-400">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-slate-300">Total: {formatPrice(item.finalPrice * item.quantity)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 bg-[#1A1A1A] border-t border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total por Supermercado</h3>
                <div className="space-y-3">
                  {Object.entries(cartTotals).map(([market, total]) => (
                    <div key={market} className={`flex items-center justify-between p-3 rounded-xl border ${market === lowestTotalMarket ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/5 bg-black/40'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                        <span className="font-medium text-slate-200">{market}</span>
                        {market === lowestTotalMarket && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-sm font-bold ml-2">MÁS BARATO</span>}
                      </div>
                      <span className={`font-bold ${market === lowestTotalMarket ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

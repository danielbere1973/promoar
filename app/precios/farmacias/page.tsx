'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, ShoppingCart, Loader2, Plus, Minus, Trash2, X, ExternalLink, ChevronRight, Filter, Camera } from 'lucide-react'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '../categories'
import {
  formatPrice,
  ALL_SUPERMARKETS_FARMA,
  SUPERMARKET_DOT,
  getBestPromo,
  SimilarProductModal,
  MobileCart,
  type GroupedProduct,
  type CartRow,
  type Toast,
  type BankPromoInfo,
  type StoreVerdict,
} from '../shared'

const BarcodeScannerModal = dynamic(() => import('../BarcodeScannerModal'), { ssr: false })

const SECTION = 'farmacias' as const

export default function PreciosFarmaciasPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<GroupedProduct[]>([])

  const [cart, setCart] = useState<CartRow[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem('promoar-precios-cart-farmacias')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [isCartOpen, setIsCartOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = localStorage.getItem('promoar-precios-cart-farmacias')
      const parsed = saved ? JSON.parse(saved) : []
      return Array.isArray(parsed) && parsed.length > 0
    } catch { return false }
  })
  const [similarSearch, setSimilarSearch] = useState<{ ean: string; market: string; catId: string; excludeEan: string } | null>(null)
  const [bankPromos, setBankPromos] = useState<Record<string, BankPromoInfo | null>>({})

  useEffect(() => {
    try { localStorage.setItem('promoar-precios-cart-farmacias', JSON.stringify(cart)) } catch {}
  }, [cart])
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)

  const showToast = (message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  const handleSearch = async (e?: React.FormEvent, isCategory = false, categoryId = '', overrideQ?: string) => {
    if (e) e.preventDefault()
    const effectiveQ = overrideQ !== undefined ? overrideQ : query
    if (!isCategory && !effectiveQ.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      const storesParam = `&stores=${ALL_SUPERMARKETS_FARMA.join(',')}`
      const url = isCategory
        ? `/api/precios/search?cat=${categoryId}&section=${SECTION}${storesParam}`
        : `/api/precios/search?q=${encodeURIComponent(effectiveQ)}&section=${SECTION}${storesParam}`

      const data = await fetch(url).then(r => r.json())
      if (data.results) {
        setProducts(data.results)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (product: GroupedProduct) => {
    const marketsData: CartRow['markets'] = {}
    for (const [name, m] of Object.entries(product.markets)) {
      const hasDiscount = m.price > m.finalPrice || m.multiUnitPromo
      marketsData[name] = {
        name: m.name,
        price: m.price,
        finalPrice: m.finalPrice,
        effectivePrice: m.multiUnitPromo ? m.multiUnitPromo.effectivePrice : m.finalPrice,
        promoLabel: m.multiUnitPromo?.label || (hasDiscount && m.discountText !== '-' ? m.discountText : undefined),
        promoQty: m.multiUnitPromo?.requiredQty,
        jumboCheck: m.jumboCheck,
        excludedFromBankPromos: m.excludedFromBankPromos,
        url: m.url,
      }
    }

    setCart(prev => {
      const existing = prev.find(r => r.ean === product.ean)
      if (existing) {
        return prev.map(r => r.ean === product.ean ? { ...r, quantity: r.quantity + 1, markets: marketsData } : r)
      }
      const firstMarket = Object.values(product.markets)[0] as any
      return [...prev, {
        ean: product.ean,
        name: product.name,
        imageUrl: product.imageUrl,
        quantity: 1,
        vtexCategoryId: firstMarket?.vtexCategoryId || '',
        vtexCategory: firstMarket?.vtexCategory || '',
        searchQuery: query,
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

  // /precios/farmacias no tiene override de cantidad por-super (solo /precios/super) —
  // se pasan como no-op para satisfacer el prop compartido de MobileCart.
  const updateMarketQuantity = (_ean: string, _market: string, _delta: number) => {}
  const resetMarketQuantity = (_ean: string, _market: string) => {}

  const replaceMarket = (ean: string, market: string, replacement: {
    name: string; price: number; effectivePrice: number; promoLabel?: string; promoQty?: number; url: string
  }) => {
    setCart(prev => prev.map(r => {
      if (r.ean !== ean) return r
      return {
        ...r,
        markets: {
          ...r.markets,
          [market]: {
            name: replacement.name,
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

  const getEffectivePrice = (m: CartRow['markets'][string], qty: number): number =>
    (m.promoQty && qty >= m.promoQty) ? m.effectivePrice : m.finalPrice

  const baseMarkets = ALL_SUPERMARKETS_FARMA
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

  const marketsWithItems = allMarkets.filter(m => (cartTotals[m] || 0) > 0)
  const marketsKey = marketsWithItems.slice().sort().join(',')
  useEffect(() => {
    if (!isCartOpen || !marketsWithItems.length) return
    fetch('/api/precios/bank-promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commerces: marketsWithItems }),
    })
      .then(r => r.json())
      .then(data => setBankPromos(data.promos || {}))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCartOpen, marketsKey])

  const listTotals = allMarkets.reduce((acc, market) => {
    acc[market] = cart.reduce((sum, row) => {
      const m = row.markets[market]
      return m ? sum + m.price * row.quantity : sum
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const cartItemsTotal = cart.length
  const storeVerdicts: Record<string, StoreVerdict> = allMarkets.reduce((acc, market) => {
    const gondolaTotal = cartTotals[market] || 0
    const listTotal = listTotals[market] || 0
    const itemsCovered = cart.filter(row => !!row.markets[market]).length
    const bp = bankPromos[market]

    let bankDiscount: StoreVerdict['bankDiscount'] = null
    let finalTotal = gondolaTotal

    if (bp && gondolaTotal > 0 && bp.discountType !== 'CUOTAS_SIN_INTERES') {
      const confidence: 'confirmed' | 'unconfirmed' = bp.stacking === 'UNKNOWN' ? 'unconfirmed' : 'confirmed'
      if (bp.stacking === 'NEVER') {
        const withBankOnList = listTotal * (1 - bp.discountValue / 100)
        finalTotal = Math.min(gondolaTotal, withBankOnList)
        bankDiscount = {
          label: bp.label,
          amount: Math.max(0, gondolaTotal - finalTotal),
          confidence,
          appliedStrategy: 'best_of_two',
        }
      } else {
        const amount = gondolaTotal * (bp.discountValue / 100)
        finalTotal = gondolaTotal - amount
        bankDiscount = { label: bp.label, amount, confidence, appliedStrategy: 'stacked' }
      }
    }

    acc[market] = {
      market,
      itemsCovered,
      itemsTotal: cartItemsTotal,
      gondolaTotal,
      listTotal,
      bankDiscount,
      finalTotal,
      isCompleteBasket: cartItemsTotal > 0 && itemsCovered === cartItemsTotal,
    }
    return acc
  }, {} as Record<string, StoreVerdict>)

  const rankedVerdicts = Object.values(storeVerdicts).filter(v => v.finalTotal > 0).sort((a, b) => a.finalTotal - b.finalTotal)
  const completeVerdicts = rankedVerdicts.filter(v => v.isCompleteBasket)
  const winnerMarket = completeVerdicts[0]?.market || ''

  const cartTotalsWithBank = allMarkets.reduce((acc, market) => {
    acc[market] = storeVerdicts[market]?.finalTotal ?? (cartTotals[market] || 0)
    return acc
  }, {} as Record<string, number>)
  const lowestTotalMarket = winnerMarket || rankedVerdicts[0]?.market || ''

  const farmaCats = CATEGORIES.filter(c => c.section === 'farmacias')

  const sidebarInner = (
    <>
      <Link href="/promos" className="hidden lg:flex items-center justify-center pb-4 border-b border-gray-200/60 dark:border-slate-700/60 mb-4">
        <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={80} height={80} className="w-20 h-20 object-contain" />
      </Link>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2 font-bold px-1">Categorías</p>
        {farmaCats.map(cat => {
          const hasChildren = !!cat.children && cat.children.length > 0
          const isExpanded = expandedCatId === cat.id
          return (
            <div key={cat.id}>
              <button
                onClick={() => {
                  if (hasChildren) {
                    setExpandedCatId(isExpanded ? null : cat.id)
                  } else {
                    handleSearch(undefined, true, cat.id)
                    setSidebarOpen(false)
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-between group transition-colors font-medium">
                <span>{cat.name}</span>
                <ChevronRight className={`w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
              {hasChildren && isExpanded && (
                <div className="ml-3 pl-2 border-l border-gray-200 dark:border-slate-700">
                  <button
                    onClick={() => { handleSearch(undefined, true, cat.id); setSidebarOpen(false); setExpandedCatId(null) }}
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs italic text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                    Ver todo {cat.name}
                  </button>
                  {cat.children!.map(sub => (
                    <button key={sub.id}
                      onClick={() => { handleSearch(undefined, true, sub.id); setSidebarOpen(false); setExpandedCatId(null) }}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-gray-200/60 dark:border-slate-700/60">
        <Link href="/promos" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:text-[#1E3A5F] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors font-medium">
          ← Volver a PromoAR
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans">
      {scannerOpen && (
        <BarcodeScannerModal
          onDetect={(code, format) => {
            setScannerOpen(false)
            const isNumeric = /^\d{8,14}$/.test(code)
            const isEanFormat = /ean|upc|itf/i.test(format || '')
            if (isNumeric || isEanFormat) {
              setQuery(code)
              handleSearch(undefined, false, '', code)
            } else {
              let q = code
              try {
                const url = new URL(code)
                const slug = url.pathname.split('/').filter(Boolean).pop() || ''
                if (slug) q = slug.replace(/[-_]/g, ' ')
              } catch {}
              setQuery(q)
              handleSearch(undefined, false, '', q)
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

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
            <button onClick={() => setIsCartOpen(true)} className="relative p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
              <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              {cartTotalItems > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#1E3A5F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartTotalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-slate-950 border-r border-gray-200/60 dark:border-slate-700/60 overflow-y-auto p-5 flex flex-col gap-4">
            <div className="flex items-center justify-end">
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            {sidebarInner}
          </aside>
        </div>
      )}

      <div className="max-w-7xl mx-auto flex">
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen overflow-y-auto border-r border-gray-200/60 dark:border-slate-700/60 bg-white dark:bg-slate-950 p-4 pt-6 gap-0">
          {sidebarInner}
        </aside>

        <main className="flex-1 min-w-0 px-4 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-5 lg:hidden">
            <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors font-medium shadow-sm">
              <Filter className="w-4 h-4" />
              Categorías
            </button>
          </div>

          <div className={`transition-all duration-700 ease-out flex flex-col items-center ${hasSearched ? 'mt-0 mb-12' : 'mt-[5vh]'}`}>
            {!hasSearched && (
              <div className="text-center mb-10 space-y-4">
                <div className="flex items-center justify-center">
                  <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={140} height={140} className="w-28 h-28 md:w-36 md:h-36 object-contain drop-shadow-sm" />
                </div>
                <p className="text-base text-gray-500 dark:text-slate-400 max-w-xl mx-auto">
                  Buscá un producto de farmacia o elegí una categoría del menú lateral.
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
                    placeholder="Buscá un producto o escaneá el código de barras 📷"
                    className="flex-1 bg-transparent text-base py-2.5 px-2 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 min-w-0"
                  />
                  <button type="button" onClick={() => setScannerOpen(true)} title="Escanear código de barras"
                    className="p-2.5 text-gray-400 hover:text-[#1E3A5F] dark:hover:text-blue-400 transition-colors shrink-0 mr-0.5">
                    <Camera className="w-5 h-5" />
                  </button>
                  <button type="submit" disabled={loading || !query.trim()} className="bg-[#1E3A5F] hover:bg-[#162d4a] text-white px-5 py-2.5 rounded-xl font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 text-sm">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>
              </form>
            </div>
          </div>

        {hasSearched && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xl font-black tracking-tight text-[#1E3A5F] dark:text-white">Resultados</h3>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={() => setIsCartOpen(true)} className="relative flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white shadow-sm transition-colors">
                  <ShoppingCart className="w-4 h-4" />
                  Carrito
                  {cartTotalItems > 0 && <span className="bg-[#1E3A5F] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{cartTotalItems}</span>}
                </button>
                <p className="text-gray-400 dark:text-slate-500 text-sm">{products.length} resultado{products.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div>
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

                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-[10px] uppercase font-bold text-indigo-400">{p.bestMarket}</p>
                          </div>
                          <p className="text-2xl font-bold text-white tracking-tight">{formatPrice(p.minPrice)}</p>
                          {p.markets[p.bestMarket]?.discountText !== '-' && !p.markets[p.bestMarket]?.multiUnitPromo && (
                            <p className="text-[10px] text-emerald-400 font-bold mt-1 bg-emerald-400/10 inline-block px-1.5 py-0.5 rounded">
                              {p.markets[p.bestMarket]?.discountText}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">En {p.availableIn} farmacias</p>
                      </div>

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
                          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
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
          </div>
        )}
        </main>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
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
                              {m.name && m.name !== selectedProduct.name && (
                                <p className="text-[10px] text-slate-400 mt-0.5">🔁 {m.name}</p>
                              )}
                              {m.discountText !== '-' && !m.multiUnitPromo && (
                                <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{m.discountText}</p>
                              )}
                              {(m as any).excludedFromBankPromos && (
                                <p className="text-[10px] font-bold text-amber-400 mt-0.5">⚠️ No acumulable con otras promos bancarias</p>
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
                              title="Agregar en todas las farmacias"
                            >
                              <Plus className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        </div>

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

      {isCartOpen && cart.length > 0 && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative m-4 mt-16 bg-[#111111] rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
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

            <div className="flex-1 overflow-auto">
              <MobileCart
                cart={cart}
                allMarkets={allMarkets}
                cartTotals={cartTotalsWithBank}
                lowestTotalMarket={lowestTotalMarket}
                storeVerdicts={storeVerdicts}
                winnerMarket={winnerMarket}
                bankPromos={bankPromos}
                updateMarketQuantity={updateMarketQuantity}
                resetMarketQuantity={resetMarketQuantity}
                getEffectivePrice={getEffectivePrice}
                updateQuantity={updateQuantity}
                removeFromCart={removeFromCart}
              />

              <table className="hidden md:table w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-white/20 bg-[#0A0A0A]">
                    <td className="p-3 sticky left-0 bg-[#0A0A0A]">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-wide">TOTAL</p>
                    </td>
                    <td />
                    {allMarkets.map(market => {
                      const verdict = storeVerdicts[market]
                      const lista = cart.reduce((sum, row) => { const m = row.markets[market]; return m ? sum + m.price * row.quantity : sum }, 0)
                      const conDesc = verdict?.finalTotal ?? 0
                      const ahorrado = lista - conDesc
                      const isBest = market === winnerMarket
                      const bp = bankPromos[market]
                      return (
                        <td key={market} className={`p-3 text-center ${isBest ? 'bg-emerald-500/10' : ''}`}>
                          <p className={`text-base font-black ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(conDesc)}</p>
                          {lista > conDesc && <p className="text-[9px] text-slate-500 line-through">{formatPrice(lista)}</p>}
                          {ahorrado > 0 && <p className="text-[9px] text-emerald-600 font-bold">-{formatPrice(ahorrado)}</p>}
                          {bp && verdict?.bankDiscount && (
                            <p className="text-[9px] font-bold text-sky-400 mt-0.5">
                              🏦 {bp.label} {bp.discountType === 'CUOTAS_SIN_INTERES' ? `${bp.discountValue} CSI` : `${bp.discountValue}%`}
                              {verdict.bankDiscount.appliedStrategy === 'best_of_two' && ' (no acumulable)'}
                            </p>
                          )}
                          {verdict?.bankDiscount?.confidence === 'unconfirmed' && (
                            <p className="text-[9px] font-bold text-amber-400 mt-0.5">⚠️ No confirmado</p>
                          )}
                          {verdict && !verdict.isCompleteBasket && verdict.itemsTotal > 0 && (
                            <p className="text-[9px] font-bold text-amber-400 mt-0.5">
                              ⚠️ Canasta incompleta ({verdict.itemsCovered}/{verdict.itemsTotal})
                            </p>
                          )}
                          {isBest && <p className="text-[9px] text-emerald-500 font-bold uppercase mt-0.5">Más barato ★</p>}
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-slate-400 font-medium text-xs uppercase tracking-wide sticky left-0 bg-[#111111] min-w-[200px]">Producto</th>
                    <th className="text-center p-4 text-slate-400 font-medium text-xs uppercase tracking-wide min-w-[60px]">Cant.</th>
                    {allMarkets.map(market => (
                      <th key={market} className={`text-center p-4 text-xs font-bold uppercase tracking-wide min-w-[140px] ${market === winnerMarket ? 'text-emerald-400' : 'text-slate-400'}`}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                          {market}
                          {market === winnerMarket && <span className="text-[9px] bg-emerald-500 text-white px-1 py-0.5 rounded font-black">★</span>}
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
                            {m.name && m.name !== row.name && (
                              <p className="text-[9px] text-slate-400 mt-0.5">🔁 {m.name}</p>
                            )}
                            {m.promoLabel && (
                              <p className={`text-[9px] font-bold mt-0.5 ${promoActiva ? 'text-orange-400' : 'text-amber-500/60'}`}>
                                🔥 {m.promoLabel}{!promoActiva && faltanParaPromo > 0 ? ` (+${faltanParaPromo})` : ''}
                              </p>
                            )}
                            {m.excludedFromBankPromos && (
                              <p className="text-[9px] font-bold mt-0.5 text-amber-400">⚠️ No acumulable con otras promos bancarias</p>
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

      {similarSearch && (
        <SimilarProductModal
          ean={similarSearch.ean}
          market={similarSearch.market}
          catId={similarSearch.catId}
          excludeEan={similarSearch.excludeEan}
          cartRow={cart.find(r => r.ean === similarSearch.ean)!}
          onSelect={(market, item) => {
            replaceMarket(similarSearch.ean, market, {
              name: item.name,
              price: item.price,
              effectivePrice: item.price,
              url: item.url || '',
            })
            setSimilarSearch(null)
          }}
          onClose={() => setSimilarSearch(null)}
        />
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, ShoppingCart, Loader2, Plus, Minus, Trash2, X, ExternalLink, ChevronRight, Filter, Camera, Info, Copy, Check, AlertTriangle, Zap } from 'lucide-react'
import dynamic from 'next/dynamic'
import { CATEGORIES } from '../categories'
import { PreciosSidebarNav, PreciosTabsNav } from '../PreciosSectionNav'
import {
  formatPrice,
  ALL_SUPERMARKETS_FARMA,
  SUPERMARKET_DOT,
  getBestPromo,
  SimilarProductModal,
  MobileCart,
  PromoTermsModal,
  getRowQuantity,
  buildDirectCartUrl,
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
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [similarSearch, setSimilarSearch] = useState<{ ean: string; market: string; catId: string; excludeEan: string } | null>(null)
  const [bankPromos, setBankPromos] = useState<Record<string, BankPromoInfo | null>>({})
  const [promoDetailModal, setPromoDetailModal] = useState<{
    name: string
    imageUrl: string
    market: string
    listPrice: number
    effectivePrice: number
    qty: number
    promoLabel: string
    promoQty?: number
    excludedFromBank?: boolean
  } | null>(null)
  const [buyAssistantMarket, setBuyAssistantMarket] = useState<string | null>(null)
  const [termsModalMarket, setTermsModalMarket] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [copiedList, setCopiedList] = useState(false)

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
        id: m.id,
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

  // Independiza (o ajusta) la cantidad de UNA farmacia dentro de la fila, sin tocar la
  // cantidad global ni la de las demás farmacias de esa misma fila.
  const updateMarketQuantity = (ean: string, market: string, delta: number) => {
    setCart(prev => prev.map(r => {
      if (r.ean !== ean) return r
      const current = r.marketQuantities?.[market] ?? r.quantity
      const next = Math.max(0, current + delta)
      return { ...r, marketQuantities: { ...r.marketQuantities, [market]: next } }
    }))
  }

  // Vuelve a atar una farmacia a la cantidad global de la fila (saca su override).
  const resetMarketQuantity = (ean: string, market: string) => {
    setCart(prev => prev.map(r => {
      if (r.ean !== ean || !r.marketQuantities) return r
      const { [market]: _removed, ...rest } = r.marketQuantities
      return { ...r, marketQuantities: rest }
    }))
  }

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
      if (!m) return sum
      const qty = getRowQuantity(row, market)
      return sum + getEffectivePrice(m, qty) * qty
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
      return m ? sum + m.price * getRowQuantity(row, market) : sum
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
      gondolaSavings: Math.max(0, listTotal - gondolaTotal),
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

      {/* Selector de Sección */}
      <PreciosSidebarNav currentSection="farmacias" />

      {/* Widget Changuito Activo en Sidebar */}
      {cart.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-3 bg-gradient-to-br from-emerald-900/80 to-slate-900 hover:from-emerald-800/80 hover:to-slate-800 text-white rounded-2xl shadow-md transition-all text-left border border-emerald-500/30 group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">Carrito Activo</span>
              </div>
              <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                {cartTotalItems}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-300 text-[11px]">Mejor total:</span>
              <span className="font-black text-emerald-300 text-sm">
                {lowestTotalMarket && cartTotalsWithBank[lowestTotalMarket] > 0
                  ? formatPrice(cartTotalsWithBank[lowestTotalMarket])
                  : `${cart.length} prod.`}
              </span>
            </div>
            <div className="mt-2 text-[10px] font-bold text-center py-1 bg-white/10 group-hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center gap-1">
              <span>Abrir comparador</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}

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
            {/* Píldoras de Sección (Supermercados | Farmacias | Electrónica) */}
            <PreciosTabsNav currentSection="farmacias" />

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
                getEffectivePrice={getEffectivePrice}
                updateQuantity={updateQuantity}
                updateMarketQuantity={updateMarketQuantity}
                resetMarketQuantity={resetMarketQuantity}
                removeFromCart={removeFromCart}
                onOpenBuyAssistant={setBuyAssistantMarket}
                onOpenPromoDetail={setPromoDetailModal}
              />

              {/* Podio de Farmacias (Tarjetas Limpias) */}
              <div className="hidden md:block p-4 bg-[#0A0A0A] border-b border-white/10 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {allMarkets.map(market => {
                    const verdict = storeVerdicts[market]
                    const lista = listTotals[market] || 0
                    const conDesc = verdict?.finalTotal ?? 0
                    const isWinner = market === winnerMarket
                    const winnerV = storeVerdicts[winnerMarket]
                    const diff = winnerV ? conDesc - winnerV.finalTotal : 0

                    return (
                      <div
                        key={market}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between transition-all relative ${
                          isWinner
                            ? 'bg-gradient-to-b from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-500/60 shadow-lg ring-1 ring-emerald-500/30'
                            : 'bg-[#161616] border-white/10'
                        }`}
                      >
                        {isWinner && (
                          <div className="absolute -top-2.5 left-3 bg-emerald-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            🥇 Más barato
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 mt-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                              <span className="font-bold text-xs text-white">{market}</span>
                            </div>
                            {verdict && !verdict.isCompleteBasket && (
                              <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                Incompleto ({verdict.itemsCovered}/{verdict.itemsTotal})
                              </span>
                            )}
                          </div>

                          <div className="mb-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className={`text-xl font-black ${isWinner ? 'text-emerald-400' : 'text-white'}`}>
                                {formatPrice(conDesc)}
                              </span>
                              {!isWinner && diff > 0 && (
                                <span className="text-[10px] font-bold text-rose-400">
                                  (+{formatPrice(diff)})
                                </span>
                              )}
                            </div>
                            {lista > conDesc && lista <= conDesc * 3 && (
                              <p className="text-[10px] text-slate-500 line-through">
                                Lista: {formatPrice(lista)}
                              </p>
                            )}
                          </div>

                          {/* Desglose matemático */}
                          <div className="text-[10px] text-slate-400 space-y-1 pt-2 border-t border-white/5">
                            <div className="flex justify-between">
                              <span>Góndola:</span>
                              <span className="text-slate-200">{formatPrice(verdict?.gondolaTotal ?? 0)}</span>
                            </div>
                            {lista > (verdict?.gondolaTotal ?? 0) && (
                              <div className="flex justify-between text-emerald-400">
                                <span>Ofertas farmacia:</span>
                                <span>-{formatPrice(lista - (verdict?.gondolaTotal ?? 0))}</span>
                              </div>
                            )}
                            {verdict?.bankDiscount && (
                              <div className="flex justify-between text-amber-400 font-bold">
                                <span className="truncate pr-1">
                                  {verdict.bankDiscount.label} {verdict.bankDiscount.capped ? '(Tope máx)' : ''}:
                                </span>
                                <span>-{formatPrice(verdict.bankDiscount.amount)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="mt-3 pt-2 border-t border-white/5 flex flex-col gap-1.5">
                          {(() => {
                            const directUrl = buildDirectCartUrl(market, cart)
                            return (
                              <>
                                {directUrl && (
                                  <a
                                    href={`/api/r?url=${encodeURIComponent(directUrl)}&src=precios`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md cursor-pointer"
                                    title={`Cargar automáticamente los productos de tu carrito en ${market}`}
                                  >
                                    <Zap className="w-3.5 h-3.5 fill-current" />
                                    <span>Cargar en {market}</span>
                                    <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                                  </a>
                                )}
                                <button
                                  onClick={() => setBuyAssistantMarket(market)}
                                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                    !directUrl && isWinner
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md'
                                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                                  }`}
                                >
                                  <span>{directUrl ? 'Ver checklist' : `Ir a comprar en ${market}`}</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Aviso de estimación prudente y disclaimer legal */}
                <div className="mt-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-sm shrink-0">ℹ️</span>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      <strong className="text-slate-300">Estimación prudente de ahorro:</strong> Calculamos aplicando exclusiones legales conocidas para evitar sorpresas en caja. El total final dependerá de las condiciones aplicadas por cada comercio.
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-500 shrink-0 italic">
                    Verificá siempre los términos vigentes con la farmacia antes de pagar.
                  </p>
                </div>
              </div>

              {/* DESKTOP: tabla horizontal limpia */}
              <div className="hidden md:block flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#0E0E0E]">
                      <th className="text-left p-4 text-slate-400 font-bold text-xs uppercase tracking-wide sticky left-0 bg-[#0E0E0E] min-w-[220px]">Producto</th>
                      <th className="text-center p-4 text-slate-400 font-bold text-xs uppercase tracking-wide min-w-[110px]">
                        <div className="flex flex-col items-center">
                          <span>Cant. Base</span>
                          <span className="text-[9px] font-normal text-slate-500 normal-case">(para todas)</span>
                        </div>
                      </th>
                      {allMarkets.map(market => (
                        <th key={market} className={`text-center p-4 text-xs font-bold uppercase tracking-wide min-w-[150px] ${market === winnerMarket ? 'text-emerald-400' : 'text-slate-300'}`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${SUPERMARKET_DOT[market] || SUPERMARKET_DOT.default}`} />
                            {market}
                          </div>
                        </th>
                      ))}
                      <th className="p-4 min-w-[50px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(row => (
                      <tr key={row.ean} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-4 sticky left-0 bg-[#111111]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl p-1 shrink-0">
                              <img src={row.imageUrl} alt={row.name} className="w-full h-full object-contain mix-blend-multiply" />
                            </div>
                            <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-tight">{row.name}</p>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5 bg-black/40 rounded-xl p-1 border border-white/10 mx-auto">
                            <button onClick={() => updateQuantity(row.ean, -1)} className="p-1 hover:bg-white/10 rounded text-slate-400" title="Restar 1 en base">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-black w-4 text-center text-white">{row.quantity}</span>
                            <button onClick={() => updateQuantity(row.ean, 1)} className="p-1 hover:bg-white/10 rounded text-slate-400" title="Sumar 1 en base">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="block text-[9px] text-slate-500 mt-1">General</span>
                        </td>
                        {allMarkets.map(market => {
                          const m = row.markets[market]
                          const isBest = market === lowestTotalMarket
                          if (!m) return (
                            <td key={market} className="p-4 text-center">
                              <button
                                onClick={() => setSimilarSearch({ ean: row.ean, market, catId: row.vtexCategoryId || '', excludeEan: row.ean })}
                                className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors border border-white/10 hover:border-indigo-500/40 rounded-lg px-2.5 py-1"
                              >
                                + similar
                              </button>
                            </td>
                          )
                          const marketQty = getRowQuantity(row, market)
                          const isOverridden = row.marketQuantities?.[market] !== undefined
                          const promoActiva = m.promoQty ? marketQty >= m.promoQty : false
                          const faltanParaPromo = m.promoQty && !promoActiva ? m.promoQty - marketQty : 0
                          const precioUnit = getEffectivePrice(m, marketQty)
                          const totalLine = precioUnit * marketQty

                          return (
                            <td key={market} className={`p-4 text-center ${isBest ? 'bg-emerald-500/5' : ''}`}>
                              {m.price > precioUnit && m.price <= precioUnit * 3 && (
                                <p className="text-[10px] text-slate-500 line-through">{formatPrice(m.price)}</p>
                              )}
                              <p className={`text-sm font-bold ${isBest ? 'text-emerald-400' : 'text-white'}`}>{formatPrice(totalLine)}</p>
                              <p className="text-[10px] text-slate-400">({formatPrice(precioUnit)} c/u)</p>

                              {/* Promo de Góndola con indicación de faltantes y clickeable */}
                              {m.promoLabel && (
                                <div className="mt-1">
                                  <button
                                    onClick={() => setPromoDetailModal({
                                      name: row.name,
                                      imageUrl: row.imageUrl,
                                      market,
                                      listPrice: m.price,
                                      effectivePrice: precioUnit,
                                      qty: marketQty,
                                      promoLabel: m.promoLabel,
                                      promoQty: m.promoQty,
                                      excludedFromBank: m.excludedFromBankPromos
                                    })}
                                    className={`inline-flex items-center gap-1 border text-[9px] font-black px-1.5 py-0.5 rounded transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                                      promoActiva
                                        ? 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30 text-orange-400 ring-1 ring-orange-500/20'
                                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400'
                                    }`}
                                    title="Hacé clic para ver el desglose de esta promo"
                                  >
                                    <span>🔥 {m.promoLabel}{!promoActiva && faltanParaPromo > 0 ? ` (+${faltanParaPromo})` : ''}</span>
                                    <Info className="w-2.5 h-2.5 opacity-70" />
                                  </button>
                                </div>
                              )}

                              {/* Control Individual de Cantidad por Farmacia */}
                              <div className="mt-2.5 flex items-center justify-center">
                                <div
                                  className={`inline-flex items-center rounded-lg p-0.5 border gap-1 transition-all ${
                                    isOverridden
                                      ? 'bg-blue-950/60 border-blue-500/50 text-blue-300 ring-1 ring-blue-500/20'
                                      : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
                                  }`}
                                >
                                  <button
                                    onClick={() => updateMarketQuantity(row.ean, market, -1)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                                    title={`Restar 1 en ${market}`}
                                  >
                                    <Minus className="w-2.5 h-2.5" />
                                  </button>
                                  <span className="text-[11px] font-black w-4 text-center text-white">
                                    {marketQty}
                                  </span>
                                  <button
                                    onClick={() => updateMarketQuantity(row.ean, market, 1)}
                                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 hover:text-white transition-colors"
                                    title={`Sumar 1 en ${market}`}
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                              {isOverridden && (
                                <button
                                  onClick={() => resetMarketQuantity(row.ean, market)}
                                  className="mt-1 text-[9px] text-blue-400 hover:underline block mx-auto"
                                  title="Volver a sincronizar con la cantidad base general"
                                >
                                  reset
                                </button>
                              )}

                              {m.excludedFromBankPromos && (
                                <div className="mt-1" title="Producto o categoría excluida de promociones bancarias según legales">
                                  <span className="inline-block text-[9px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
                                    🚫 Sin reintegro
                                  </span>
                                </div>
                              )}

                              <div className="mt-2 flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setSimilarSearch({ ean: row.ean, market, catId: row.vtexCategoryId || '', excludeEan: row.ean })}
                                  className="text-[9px] text-slate-500 hover:text-indigo-400 transition-colors"
                                >
                                  ↔ reemplazar
                                </button>
                                {m.url && (
                                  <a
                                    href={`/api/r?url=${encodeURIComponent(m.url)}&src=precios`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-600 hover:text-slate-300 transition-colors"
                                    title={`Ver en ${market}`}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        <td className="p-4 text-center">
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

      {/* ── MODAL DETALLE DE PROMO ── */}
      {promoDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPromoDetailModal(null)}
          />
          <div className="relative bg-[#141414] border border-white/10 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                  <h3 className="font-bold text-sm text-white">Desglose de Promoción</h3>
                  <p className="text-[11px] text-orange-400 font-semibold">{promoDetailModal.promoLabel} en {promoDetailModal.market}</p>
                </div>
              </div>
              <button
                onClick={() => setPromoDetailModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
                <div className="w-12 h-12 bg-white rounded-xl p-1 shrink-0">
                  <img
                    src={promoDetailModal.imageUrl}
                    alt={promoDetailModal.name}
                    className="w-full h-full object-contain mix-blend-multiply"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white line-clamp-2">{promoDetailModal.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Llevando <strong>{promoDetailModal.qty} unidad{promoDetailModal.qty > 1 ? 'es' : ''}</strong>
                  </p>
                </div>
              </div>

              {/* Detalle Matemático */}
              <div className="bg-black/30 rounded-2xl p-3.5 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Precio de lista unitario:</span>
                  <span className="font-semibold text-white">{formatPrice(promoDetailModal.listPrice)}</span>
                </div>
                {promoDetailModal.listPrice > promoDetailModal.effectivePrice && (
                  <div className="flex justify-between items-center text-emerald-400 font-bold">
                    <span>Bonificación de farmacia:</span>
                    <span>-{formatPrice((promoDetailModal.listPrice - promoDetailModal.effectivePrice) * promoDetailModal.qty)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                  <div>
                    <span className="font-black text-white text-sm">Total final:</span>
                    <p className="text-[10px] text-slate-400">
                      Te queda a <strong className="text-emerald-400 font-black">{formatPrice(promoDetailModal.effectivePrice)}</strong> cada una
                    </p>
                  </div>
                  <span className="font-black text-lg text-emerald-400">
                    {formatPrice(promoDetailModal.effectivePrice * promoDetailModal.qty)}
                  </span>
                </div>
              </div>

              {/* Impacto con Beneficio Bancario */}
              {promoDetailModal.excludedFromBank ? (
                <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-xs text-amber-200">
                  ⚠️ Este producto tiene marca excluida del reintegro bancario según bases legales, por lo que pagarás el total indicado.
                </div>
              ) : bankPromos[promoDetailModal.market] ? (
                <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-200">
                  <div className="flex items-center gap-1.5 mb-1 font-bold text-white">
                    <span>🏦 {bankPromos[promoDetailModal.market]?.label}:</span>
                  </div>
                  <p className="text-[11px] text-blue-100">
                    {bankPromos[promoDetailModal.market]?.stacking === 'ALWAYS'
                      ? '¡Acumula! Sobre el precio con oferta, recibís el reintegro posterior de tu banco/billetera.'
                      : 'Beneficio disponible en caja según las condiciones de la entidad.'}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setPromoDetailModal(null)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ASISTENTE DE COMPRA EN FARMACIA ── */}
      {buyAssistantMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setBuyAssistantMarket(null)}
          />
          <div className="relative bg-[#141414] border border-white/10 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl z-10 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${SUPERMARKET_DOT[buyAssistantMarket] || SUPERMARKET_DOT.default}`} />
                  <h3 className="font-black text-lg text-white">
                    Comprar en {buyAssistantMarket}
                  </h3>
                  {buyAssistantMarket === winnerMarket && (
                    <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                      🥇 Más barato
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Total estimado:{' '}
                  <strong className="text-emerald-400 text-sm font-black">
                    {formatPrice(storeVerdicts[buyAssistantMarket]?.finalTotal ?? 0)}
                  </strong>
                </p>
              </div>
              <button
                onClick={() => setBuyAssistantMarket(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Aviso de verificación previa y responsabilidad */}
            <div className="py-2.5 px-3.5 my-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/25 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2.5 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>
                  <strong>Verificá las condiciones antes de pagar:</strong> Comprobá en {buyAssistantMarket} que tu medio de pago cumpla con los días vigentes, topes y exclusiones de categorías. PromoAR es una guía orientativa y no se responsabiliza por cambios o exclusiones fijadas por la farmacia.
                </p>
                {bankPromos[buyAssistantMarket] && (
                  <button
                    onClick={() => setTermsModalMarket(buyAssistantMarket)}
                    className="text-blue-400 hover:text-blue-300 font-bold underline mt-1 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver bases legales y exclusiones de {bankPromos[buyAssistantMarket]?.label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div className="py-3 flex flex-col gap-2 shrink-0 border-b border-white/10">
              {(() => {
                const directUrl = buildDirectCartUrl(buyAssistantMarket, cart)
                const storeUrl = {
                  Farmacity: 'https://www.farmacity.com',
                  Farmaplus: 'https://www.farmaplus.com.ar',
                  OpenFarma: 'https://www.openfarma.com.ar',
                }[buyAssistantMarket] || 'https://www.google.com'

                return (
                  <div className="flex flex-col sm:flex-row gap-2">
                    {directUrl ? (
                      <a
                        href={`/api/r?url=${encodeURIComponent(directUrl)}&src=precios`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer"
                        title={`Inyecta los productos y cantidades directo en el carrito web de ${buyAssistantMarket}`}
                      >
                        <Zap className="w-4 h-4 fill-current" />
                        <span>⚡ Cargar carrito directo en {buyAssistantMarket}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                      </a>
                    ) : (
                      <a
                        href={storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                      >
                        <span>Abrir tienda oficial de {buyAssistantMarket}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      onClick={() => {
                        const itemsInStore = cart.filter(r => r.markets[buyAssistantMarket])
                        const lines = [
                          `🛒 Mi lista en ${buyAssistantMarket} (PromoAR)`,
                          `Total estimado: ${formatPrice(storeVerdicts[buyAssistantMarket]?.finalTotal ?? 0)}`,
                          '',
                          ...itemsInStore.map(row => {
                            const m = row.markets[buyAssistantMarket]
                            const q = getRowQuantity(row, buyAssistantMarket)
                            const eff = getEffectivePrice(m, q)
                            const promo = m.promoLabel ? ` (🔥 ${m.promoLabel})` : ''
                            return `• ${q}x ${m.name || row.name}${promo} — ${formatPrice(eff * q)}`
                          })
                        ].join('\n')
                        navigator.clipboard.writeText(lines)
                        setCopiedList(true)
                        setTimeout(() => setCopiedList(false), 2500)
                      }}
                      className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-white/10 shrink-0"
                      title="Copiar lista de productos al portapapeles"
                    >
                      {copiedList ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                          <span>Copiar lista</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              })()}
            </div>

            {/* Checklist interactivo */}
            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                Productos a cargar ({cart.filter(r => r.markets[buyAssistantMarket]).length})
              </p>
              {cart
                .filter(row => row.markets[buyAssistantMarket])
                .map(row => {
                  const m = row.markets[buyAssistantMarket]
                  const q = getRowQuantity(row, buyAssistantMarket)
                  const eff = getEffectivePrice(m, q)
                  const itemKey = `${buyAssistantMarket}-${row.ean}`
                  const isChecked = !!checkedItems[itemKey]

                  return (
                    <div
                      key={row.ean}
                      onClick={() => setCheckedItems(prev => ({ ...prev, [itemKey]: !prev[itemKey] }))}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-white/[0.02] border-white/5 opacity-50'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                              : 'border-white/30 hover:border-white/60'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="w-9 h-9 bg-white rounded-lg p-1 shrink-0">
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            className="w-full h-full object-contain mix-blend-multiply"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold leading-tight line-clamp-1 ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                            {m.name || row.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="font-bold text-emerald-400">{q} un.</span>
                            <span>•</span>
                            <span>{formatPrice(eff * q)}</span>
                            {m.promoLabel && (
                              <span className="text-[10px] text-orange-400 font-bold">
                                🔥 {m.promoLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {m.url && (
                        <a
                          href={`/api/r?url=${encodeURIComponent(m.url)}&src=precios`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors shrink-0"
                          title={`Ver producto en ${buyAssistantMarket}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* Footer Modal */}
            <div className="pt-3 border-t border-white/10 shrink-0 text-center">
              <p className="text-[11px] text-slate-500">
                Podés ir marcando cada ítem a medida que lo cargás en la web de {buyAssistantMarket}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante persistente de changuito activo */}
      {cart.length > 0 && !isCartOpen && (
        <aside aria-label="Carrito activo" className="fixed bottom-20 lg:bottom-6 right-4 lg:right-8 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-3 bg-emerald-700 hover:bg-emerald-600 text-white pl-4 pr-5 py-3 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all border border-white/20 group ring-4 ring-black/10 cursor-pointer"
            title="Abrir changuito de compras"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-white" />
              <span className="absolute -top-2 -right-2 bg-white text-emerald-950 text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
                {cartTotalItems}
              </span>
            </div>
            <div className="text-left flex flex-col">
              <span className="text-xs font-bold leading-none">Mi Carrito ({cartTotalItems})</span>
              {lowestTotalMarket && cartTotalsWithBank[lowestTotalMarket] > 0 && (
                <span className="text-[11px] text-emerald-200 font-black leading-tight mt-0.5">
                  Desde {formatPrice(cartTotalsWithBank[lowestTotalMarket])}
                </span>
              )}
            </div>
            <span className="text-xs bg-white/20 group-hover:bg-white/30 px-2.5 py-1 rounded-xl font-bold transition-colors ml-1 flex items-center gap-1">
              <span>Ver</span>
              <span>→</span>
            </span>
          </button>
        </aside>
      )}

      {/* Modal de Términos y Bases Legales de la Promoción */}
      {termsModalMarket && bankPromos[termsModalMarket] && (
        <PromoTermsModal
          market={termsModalMarket}
          bankPromo={bankPromos[termsModalMarket]!}
          bankDiscount={storeVerdicts[termsModalMarket]?.bankDiscount}
          cart={cart}
          onClose={() => setTermsModalMarket(null)}
        />
      )}

      {/* Footer oficial PromoAR */}
      <footer className="bg-[#1E3A5F] border-t border-white/10 text-white py-12 px-4 mt-16">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={32} height={32} className="h-8 w-auto object-contain" />
              <p className="font-black text-lg">PromoAR</p>
            </div>
            <p className="text-xs text-blue-200 leading-relaxed">
              El agregador de beneficios y comparador de ahorro inteligente más completo de Argentina.
            </p>
            <div className="flex items-center gap-2.5 mt-4">
              <a
                href="https://www.instagram.com/promoar.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="Instagram"
              >
                📷
              </a>
              <a
                href="https://x.com/promoarok"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="X (Twitter)"
              >
                𝕏
              </a>
              <a
                href="https://wa.me/541173691613"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm transition-colors"
                title="WhatsApp"
              >
                💬
              </a>
            </div>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Simuladores</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li>
                <Link href="/ahorro-interactivo" className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span>⚡ Hub de Ahorro</span>
                  <span className="text-[9px] bg-[#D94F2B] text-white font-black px-1.5 py-0.2 rounded-full">Nuevo</span>
                </Link>
              </li>
              <li><Link href="/precios/super" className="hover:text-white transition-colors">🛒 Supermercados</Link></li>
              <li><Link href="/precios/farmacias" className="hover:text-white transition-colors font-bold">💊 Farmacias</Link></li>
              <li><Link href="/precios/tech" className="hover:text-white transition-colors">📺 Electrónica</Link></li>
              <li><Link href="/ahorro-interactivo/combustible" className="hover:text-white transition-colors">⛽ Combustibles</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Plataforma</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li><Link href="/promos/explorar" className="hover:text-white transition-colors">Catálogo de Promos</Link></li>
              <li><Link href="/finanzas" className="hover:text-white transition-colors">Tasas y FCI</Link></li>
              <li><Link href="/perfil" className="hover:text-white transition-colors">Mi Perfil Financiero</Link></li>
              <li><Link href="/comunidad" className="hover:text-white transition-colors">Comunidad PromoAR</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-xs uppercase tracking-widest text-blue-300 mb-3">Institucional</p>
            <ul className="space-y-2 text-xs text-blue-200">
              <li><Link href="/quienes-somos" className="hover:text-white transition-colors">Quiénes somos</Link></li>
              <li><Link href="/contacto" className="hover:text-white transition-colors">Contacto</Link></li>
              <li><Link href="/privacidad" className="hover:text-white transition-colors">Privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-white transition-colors">Términos y condiciones</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 mt-8 pt-6 border-t border-white/10 text-center text-xs text-blue-300/80">
          © {new Date().getFullYear()} PromoAR. Todos los derechos reservados.
        </div>
      </footer>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#0A1428]/95 backdrop-blur-xl border-t border-gray-200 dark:border-slate-800 z-30 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)] flex justify-around items-center px-3 py-2 text-[10px] font-bold text-gray-500 dark:text-slate-400">
        <Link href="/promos/explorar" className="flex flex-col items-center gap-0.5 hover:text-gray-900 dark:hover:text-white">
          <span className="text-base">🔥</span>
          <span>Promos</span>
        </Link>
        <Link href="/ahorro-interactivo" className="flex flex-col items-center gap-0.5 text-[#D94F2B] font-black">
          <span className="text-base">🛒</span>
          <span>Ahorro</span>
        </Link>
        <Link href="/finanzas" className="flex flex-col items-center gap-0.5 hover:text-gray-900 dark:hover:text-white">
          <span className="text-base">📈</span>
          <span>Tasas</span>
        </Link>
        <Link href="/comunidad" className="flex flex-col items-center gap-0.5 hover:text-gray-900 dark:hover:text-white">
          <span className="text-base">👥</span>
          <span>Comunidad</span>
        </Link>
        <Link href="/perfil" className="flex flex-col items-center gap-0.5 hover:text-gray-900 dark:hover:text-white">
          <span className="text-base">👤</span>
          <span>Perfil</span>
        </Link>
      </nav>
    </div>
  )
}

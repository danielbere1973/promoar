'use client'

import React, { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Search, Loader2, X, ExternalLink, ChevronRight, Filter } from 'lucide-react'
import { CATEGORIES } from '../categories'
import {
  formatPrice,
  extractCategory,
  STORE_LOGOS,
  SUPERMARKET_DOT,
  type GroupedProduct,
} from '../shared'

const SECTION = 'electrónica' as const

export default function PreciosTechPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<GroupedProduct[]>([])

  const [electroFilters, setElectroFilters] = useState<{
    brands: string[]
    stores: string[]
    categories: string[]
    priceMin: number
    priceMax: number
  }>({ brands: [], stores: [], categories: [], priceMin: 0, priceMax: Infinity })
  const [showElectroFilters, setShowElectroFilters] = useState(true)

  const [hasSearched, setHasSearched] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null)
  const [mlLoading, setMlLoading] = useState(false)
  const mlQueryRef = useRef<string>('')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)

  const fetchMLClientSide = useCallback(async (q: string) => {
    mlQueryRef.current = q
    setMlLoading(true)
    try {
      // Obtener token desde nuestro backend (el refresh funciona desde Vercel)
      const res = await fetch(`/api/ml-search?q=${encodeURIComponent(q)}`)
      if (!res.ok || mlQueryRef.current !== q) return
      const data = await res.json()
      const items: GroupedProduct[] = (data.results || [])
        .filter((item: any) => item.price > 0)
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
      const url = isCategory
        ? `/api/precios/search?cat=${categoryId}&section=${SECTION}`
        : `/api/precios/search?q=${encodeURIComponent(effectiveQ)}&section=${SECTION}`

      const data = await fetch(url).then(r => r.json())
      if (data.results) {
        setProducts(data.results)
        setElectroFilters({ brands: [], stores: [], categories: [], priceMin: 0, priceMax: Infinity })
        // ML se busca desde el browser (las IPs de Vercel están bloqueadas por ML)
        if (effectiveQ.trim()) {
          fetchMLClientSide(effectiveQ.trim())
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const electroCats = CATEGORIES.filter(c => c.section === 'electrónica')

  const getVisibleElectroProducts = (): GroupedProduct[] => products.filter(p => {
    const market = Object.values(p.markets)[0] as any
    const store = market?.supermarket || p.bestMarket
    const cat = extractCategory(market?.vtexCategory)
    if (electroFilters.brands.length && !electroFilters.brands.includes(p.brand)) return false
    if (electroFilters.stores.length && !electroFilters.stores.includes(store)) return false
    if (electroFilters.categories.length && (!cat || !electroFilters.categories.includes(cat))) return false
    if (p.minPrice < electroFilters.priceMin || p.minPrice > electroFilters.priceMax) return false
    return true
  })

  const sidebarInner = (
    <>
      <Link href="/promos" className="hidden lg:flex items-center justify-center pb-4 border-b border-gray-200/60 dark:border-slate-700/60 mb-4">
        <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={80} height={80} className="w-20 h-20 object-contain" />
      </Link>

      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 mb-2 font-bold px-1">Categorías</p>
        {electroCats.map(cat => {
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
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-200/60 dark:border-slate-700/60 lg:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/promos" className="flex items-center gap-2.5">
            <Image src="/promoar_logo_transparent.png" alt="PromoAR" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="font-black text-[#1E3A5F] dark:text-white tracking-tight text-lg leading-none">PromoAR</span>
          </Link>
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
                  Buscá un producto de electrónica o elegí una categoría del menú lateral.
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
                    placeholder="Buscá un producto de electrónica"
                    className="flex-1 bg-transparent text-base py-2.5 px-2 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 min-w-0"
                  />
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
                {mlLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando en MercadoLibre...
                  </span>
                )}
                <p className="text-gray-400 dark:text-slate-500 text-sm">{(() => {
                  const filtered = getVisibleElectroProducts()
                  return `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`
                })()}</p>
              </div>
            </div>

            <div className="flex gap-6">
              {/* Panel de filtros */}
              {showElectroFilters && (() => {
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
                {getVisibleElectroProducts().map(p => (
                  <div key={p.ean} className="bg-[#1A1A1A] border border-white/10 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col">
                    <div className="relative h-32 bg-white p-3 flex items-center justify-center">
                      {STORE_LOGOS[p.bestMarket] && (
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

                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {STORE_LOGOS[p.bestMarket] && (
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
                        </div>
                        <p className="text-xs text-slate-400">En {p.availableIn} tienda{p.availableIn !== 1 ? 's' : ''}</p>
                      </div>

                      <div className="mt-auto flex gap-2">
                        <button
                          onClick={() => setSelectedProduct(p)}
                          className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium text-white transition-colors"
                        >
                          Ver precios
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Modal de producto */}
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
              {Object.entries(selectedProduct.markets)
                .sort(([, a], [, b]) => a.finalPrice - b.finalPrice)
                .map(([marketName, m]) => {
                  const isWinner = marketName === selectedProduct.bestMarket
                  return (
                    <div key={marketName} className={`rounded-2xl overflow-hidden border transition-all ${isWinner ? 'border-emerald-500/50 bg-emerald-500/5' : 'bg-[#1A1A1A] border-white/5'}`}>
                      {isWinner && (
                        <div className="bg-emerald-500/20 px-4 py-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">★ Mejor precio</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          {STORE_LOGOS[marketName] ? (
                            <img src={STORE_LOGOS[marketName]} alt={marketName} className="w-5 h-5 object-contain rounded" />
                          ) : (
                            <span className={`w-2.5 h-2.5 rounded-full ${SUPERMARKET_DOT[marketName] || SUPERMARKET_DOT.default}`} />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{marketName}</p>
                            {m.discountText !== '-' && (
                              <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{m.discountText}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {m.price > m.finalPrice && <p className="text-[10px] text-slate-500 line-through">{formatPrice(m.price)}</p>}
                          <p className="text-base font-bold text-white">{formatPrice(m.finalPrice)}</p>
                        </div>
                      </div>

                      {m.url && (
                        <a href={`/api/r?url=${encodeURIComponent(m.url)}&src=precios`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-4 pb-3 text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                          <ExternalLink className="w-3 h-3" /> Ver en {marketName}
                        </a>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

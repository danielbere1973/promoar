'use client'
import { useEffect, useRef, useState } from 'react'
import { X, Search, ShoppingBag, ChevronRight, Tag } from 'lucide-react'

type Promo = {
  id: string
  title: string
  slug: string
  category: { name: string; icon: string; color: string }
}

type CommerceResult = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  matchedCategories: string[]
  promoCount: number
  promos: Promo[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  forMe: boolean
  onSelectCommerce: (name: string) => void
}

export default function ProductSearch({ isOpen, onClose, forMe, onSelectCommerce }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CommerceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
    else { setQuery(''); setResults([]); setSearched(false) }
  }, [isOpen])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearched(false); setLoading(false); return }

    setLoading(true)
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/products?q=${encodeURIComponent(q)}&for_me=${forMe}`)
        const data = await res.json()
        setResults(data.commerces ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
        setSearched(true)
      }
    }, 400)

    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query, forMe])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-800 rounded-t-[32px] lg:rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-[#1E3A5F] dark:text-indigo-400" />
            <h2 className="text-lg font-black text-gray-900 dark:text-white">¿Qué estás buscando?</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-50 dark:bg-slate-700 rounded-full text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Buscador */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ej: carteras, zapatillas, perfumes..."
              className="w-full pl-11 pr-4 py-3 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold mt-2 px-1">
            Te mostramos los comercios que venden eso{forMe ? ' y tienen promos para tu perfil' : ' y sus promos activas'}.
          </p>
        </div>

        {/* Resultados */}
        <div className="overflow-y-auto flex-1 px-4 pb-5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">No encontramos comercios para "{query}"</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Probá con otra palabra, por ejemplo una categoría o tipo de producto.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              {results.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSelectCommerce(c.name); onClose() }}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all text-left w-full"
                >
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt={c.name} className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-100 dark:border-slate-600 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-600 border border-gray-100 dark:border-slate-600 flex items-center justify-center shrink-0">
                      <ShoppingBag size={16} className="text-gray-300 dark:text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white truncate">{c.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Tag size={10} className="text-gray-400 dark:text-slate-500 shrink-0" />
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold truncate">
                        {c.matchedCategories.slice(0, 2).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.promoCount > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-[#1E3A5F] text-white text-[10px] font-black uppercase tracking-wide">
                        {c.promoCount} {c.promoCount === 1 ? 'promo' : 'promos'}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 dark:text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && !searched && (
            <div className="text-center py-10 px-6">
              <ShoppingBag size={28} className="mx-auto text-gray-200 dark:text-slate-600 mb-2" />
              <p className="text-xs text-gray-400 dark:text-slate-500 font-semibold">
                Buscá un producto o categoría y te mostramos qué comercios lo venden y qué promos tenés disponibles ahí.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

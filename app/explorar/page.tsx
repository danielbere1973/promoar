'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, TrendingUp, ChevronRight } from 'lucide-react'
import BottomNav from '../components/BottomNav'

type Category = {
  id: string
  name: string
  slug: string
  icon: string
  color: string
  promoCount: number
  totalCount: number
}

export default function Explorar() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleCategoryClick(slug: string) {
    router.push(`/?categoria=${slug}`)
  }

  const promosActivas = categories.reduce((sum, c) => sum + c.promoCount, 0)
  const categoriasActivas = categories.filter(c => c.promoCount > 0).length

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-100/60 dark:border-slate-800/60 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 p-2 rounded-xl">
               <LayoutGrid size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Explorar</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Categorías y promociones</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-28 max-w-lg mx-auto">

        {/* Banner resumen */}
        {!loading && categories.length > 0 && (
          <div className="mb-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp size={16} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">Hoy:</span>
              <span className="text-lg font-black text-indigo-700 dark:text-indigo-300 shrink-0">{promosActivas}</span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium shrink-0">promos activas</span>
            </div>
            <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-bold shrink-0">en {categoriasActivas} cats.</span>
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-1">Todas las Categorías</h2>

        {/* Skeleton loading */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 animate-pulse shadow-sm h-[130px] flex flex-col justify-between">
                <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700 rounded-2xl" />
                <div>
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-50 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Categories grid */}
        {!loading && categories.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => handleCategoryClick(cat.name)}
                className="flex items-center gap-2.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-left hover:border-gray-200 dark:hover:border-slate-600 hover:shadow-sm transition-all"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ backgroundColor: cat.color + '18' }}
                >
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white text-xs leading-tight truncate">{cat.name}</p>
                  <p className="text-[10px] font-semibold mt-0.5" style={{ color: cat.color }}>
                    {cat.promoCount > 0 ? `${cat.promoCount} hoy` : 'Sin promos'}
                  </p>
                </div>
                <ChevronRight size={14} className="text-gray-300 dark:text-slate-500 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && categories.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-900 dark:text-white font-medium">No hay categorías disponibles</p>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Crea nuevas desde el administrador.</p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
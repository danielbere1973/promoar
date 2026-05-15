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
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100/60 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
               <LayoutGrid size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Explorar</h1>
              <p className="text-sm text-gray-500 mt-0.5">Categorías y promociones</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 pb-28 max-w-lg mx-auto">

        {/* Banner resumen */}
        {!loading && categories.length > 0 && (
          <div className="mb-6 bg-gradient-to-br from-indigo-50/80 to-purple-50/50 border border-indigo-100/60 rounded-[24px] p-5 shadow-sm relative overflow-hidden flex justify-between items-center">
            <div className="absolute right-0 top-0 opacity-10 text-indigo-600 -mt-4 -mr-2">
              <TrendingUp size={100} />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-semibold text-indigo-900 flex items-center gap-1.5"><TrendingUp size={16} /> Resumen de hoy</p>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-black tracking-tighter text-indigo-700">{promosActivas}</span>
                <span className="text-sm text-indigo-800/70 font-medium">promos activas</span>
              </div>
            </div>
            <div className="relative z-10 text-right">
              <p className="text-xs font-medium text-indigo-800/60 mb-1">En <span className="font-bold text-indigo-700">{categoriasActivas}</span> categorías</p>
            </div>
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-900 mb-4 px-1">Todas las Categorías</h2>

        {/* Skeleton loading */}
        {loading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 animate-pulse shadow-sm h-[130px] flex flex-col justify-between">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl" />
                <div>
                  <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-50 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Categories grid */}
        {!loading && categories.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => handleCategoryClick(cat.name)}
                className="group bg-white border border-gray-100 rounded-3xl p-4 text-left shadow-sm shadow-black/[0.01] hover:shadow-md hover:border-gray-200 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-full min-h-[140px]"
              >
                {/* Glow sutil */}
                <div 
                  className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none group-hover:scale-150 transition-transform duration-700" 
                  style={{ backgroundColor: cat.color }}
                />

                <div
                  className="w-12 h-12 rounded-[18px] flex items-center justify-center text-2xl relative z-10 transform group-hover:scale-105 group-hover:-rotate-3 transition-transform duration-300"
                  style={{ backgroundColor: cat.color + '18', color: cat.color }}
                >
                  {cat.icon}
                </div>

                <div className="mt-4 relative z-10 w-full">
                  <p className="font-bold text-gray-900 leading-tight mb-1 line-clamp-1">{cat.name}</p>

                  <div className="flex items-center justify-between w-full">
                    {cat.promoCount > 0 ? (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-md mt-1 block w-fit"
                        style={{ backgroundColor: cat.color + '12', color: cat.color }}
                      >
                        {cat.promoCount} hoy
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400 mt-1 block">Sin promos</span>
                    )}

                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors mt-1 shrink-0" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && categories.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-gray-900 font-medium">No hay categorías disponibles</p>
            <p className="text-gray-500 text-sm mt-1">Crea nuevas desde el administrador.</p>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
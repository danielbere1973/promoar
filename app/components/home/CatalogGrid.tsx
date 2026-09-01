'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'

type Category = {
  id: string
  name: string
  slug: string
  icon: string
  totalCount: number
}

// CPO Dictamen "Cierre de pendientes Guest/Home v2" (31/8/2026, Punto 3):
// puerta de entrada visual a las 19 categorías con conteo real de promos
// activas, debajo de los rubros destacados en la vidriera guest_showcase —
// comunica la magnitud del catálogo sin obligar a pasar por /promos/explorar.
export default function CatalogGrid() {
  const [categories, setCategories] = useState<Category[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const cats: Category[] = (data.categories ?? [])
          .filter((c: any) => c.slug !== 'sin-categoria' && c.slug !== 'otros')
          .sort((a: any, b: any) => b.totalCount - a.totalCount)
        setCategories(cats)
      })
      .catch(() => setCategories([]))
    return () => { cancelled = true }
  }, [])

  if (!categories || categories.length === 0) return null

  return (
    <div className="px-4 md:px-6 pt-5 pb-2">
      <h2 className="text-[14px] font-black text-[#0D1B2E] dark:text-white mb-3">
        Explorá todo nuestro catálogo por rubro
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {categories.map(cat => (
          <Link
            key={cat.id}
            href={`/promos/explorar?cats=${cat.slug}`}
            className="flex items-center gap-2.5 bg-white dark:bg-[#122544] border border-[#E4E8EF] dark:border-slate-700 rounded-2xl px-3.5 py-3 hover:border-[#1D3D6E] dark:hover:border-[#8AADD4] transition-colors"
          >
            <span className="text-[20px] shrink-0" aria-hidden="true">{cat.icon}</span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#0D1B2E] dark:text-white leading-tight truncate">{cat.name}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
                {cat.totalCount.toLocaleString('es-AR')} promos
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

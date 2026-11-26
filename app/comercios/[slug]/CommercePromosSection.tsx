'use client'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import EntityPromoGrid from '@/app/components/EntityPromoGrid'

// EXPERIMENTO cdn-cache-static-detail (26/11/2026): antes, /comercios/[slug]
// leía `searchParams.cats`/`searchParams.entities` en el server component y
// volvía a pegarle a la DB (sin cache) para traer el subconjunto filtrado —
// eso forzaba dynamic rendering en TODA la página (bloquea Full Route Cache)
// y además escondía del HTML inicial las promos que no matcheaban el filtro
// (peor para SEO: un crawler que visita la URL con esos params nunca ve el
// listado completo). Fix: el server siempre entrega TODAS las promos activas
// (dataset cacheado, sin filtro), agrupadas por categoría, y este componente
// cliente aplica el filtro de cats/entities leyendo la URL en el browser —
// misma URL pública (?cats=.../?entities=...), mismo comportamiento visible
// para el usuario, pero la página server ya no depende de searchParams.
type CategoryGroup = {
  name: string
  slug: string
  icon: string
  color: string
  anchor: string
  promos: any[]
}

export default function CommercePromosSection({ categories }: { categories: CategoryGroup[] }) {
  const searchParams = useSearchParams()

  const catSlugs = useMemo(
    () => (searchParams.get('cats') || '').split(',').filter(Boolean),
    [searchParams]
  )
  const entitySlugs = useMemo(
    () => (searchParams.get('entities') || '').split(',').filter(Boolean),
    [searchParams]
  )
  const hasFilters = catSlugs.length > 0 || entitySlugs.length > 0

  const filteredCategories = useMemo(() => {
    if (!hasFilters) return categories

    return categories
      .filter(cat => catSlugs.length === 0 || catSlugs.includes(cat.slug))
      .map(cat => ({
        ...cat,
        promos: cat.promos.filter(promo => {
          if (entitySlugs.length === 0) return true
          return promo.requirements?.some((r: any) =>
            (r.bank?.slug && entitySlugs.includes(r.bank.slug)) ||
            (r.wallet?.slug && entitySlugs.includes(r.wallet.slug))
          )
        }),
      }))
      .filter(cat => cat.promos.length > 0)
  }, [categories, catSlugs, entitySlugs, hasFilters])

  const totalPromos = filteredCategories.reduce((sum, cat) => sum + cat.promos.length, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest -mb-4">
        {totalPromos} {totalPromos === 1 ? 'promo activa' : 'promos activas'}
      </p>

      {totalPromos === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
          <p className="text-gray-400 text-sm">No hay promos activas en este momento.</p>
        </div>
      )}

      {filteredCategories.map(cat => (
        <section key={cat.name} id={cat.anchor}>
          <div className="flex items-center gap-2 mb-3">
            <span>{cat.icon}</span>
            <h2 className="text-sm font-black text-gray-700">{cat.name}</h2>
            <span className="text-xs text-gray-400">({cat.promos.length})</span>
          </div>
          <EntityPromoGrid promos={cat.promos as any} />
        </section>
      ))}
    </div>
  )
}

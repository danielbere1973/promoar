import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { PROMOS_PUBLIC_TAG } from '@/lib/cache/promosCache'
import { PRIORITY_CATEGORY_SLUGS } from '@/app/promos/categoria/[categoria]/page'

// Tira de enlaces internos reales (<a href>) hacia las páginas pilar de
// categoría (/promos/categoria/[categoria]) — sin esto, Googlebot nunca
// descubre esas páginas por link interno, solo por sitemap (más lento y
// menos señal de relevancia). Server component liviano, sin JS de cliente,
// para no interferir con el filtrado client-side de /promos/explorar ni
// con la Home v2 (ninguna de las dos linkea hoy a estas páginas).
const getCachedPriorityCategories = unstable_cache(
  async () => prisma.category.findMany({
    where: { slug: { in: PRIORITY_CATEGORY_SLUGS } },
    select: { name: true, slug: true, icon: true },
  }),
  ['category-pillar-links-priority'],
  { tags: [PROMOS_PUBLIC_TAG], revalidate: 600 },
)

export default async function CategoryPillarLinks() {
  const categories = await getCachedPriorityCategories()
  const ordered = PRIORITY_CATEGORY_SLUGS
    .map(slug => categories.find(c => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => !!c)

  if (ordered.length === 0) return null

  return (
    <nav aria-label="Promos por rubro" className="bg-[#F7F8FA] dark:bg-[#0A1428] px-4 md:px-6 py-3">
      <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 max-w-3xl mx-auto">
        Promos por rubro
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 max-w-3xl mx-auto snap-x snap-mandatory">
        {ordered.map(c => (
          <a
            key={c.slug}
            href={`/promos/categoria/${c.slug}`}
            className="shrink-0 snap-start flex items-center gap-1.5 bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 rounded-full px-3.5 py-2 text-[12px] font-bold text-[#0D1B2E] dark:text-white hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
          >
            <span aria-hidden="true">{c.icon}</span>
            {c.name}
          </a>
        ))}
      </div>
    </nav>
  )
}

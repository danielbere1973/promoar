import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import BottomNav from '@/app/components/BottomNav'
import { PROMOS_PUBLIC_TAG } from '@/lib/cache/promosCache'
import CategoryPromosGrid from './CategoryPromosGrid'
import CategoryPageHeader from './CategoryPageHeader'
import CategoryFilterBar from './CategoryFilterBar'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

export const revalidate = false

// 7 rubros priorizados en la Fase 1 del plan SEO (18/11/2026) — supermercados,
// combustible, farmacias, gastronomía, indumentaria, petshops, electrónica
// (slug real en DB: "tecnologia", la categoría se llama "Tecnología").
// El resto de las categorías existe en DB pero no se promueve en sitemap todavía
// (Fase 3 del plan evalúa expandir a las 19 restantes).
export const PRIORITY_CATEGORY_SLUGS = [
  'supermercados',
  'combustible',
  'farmacias',
  'gastronomia',
  'indumentaria',
  'petshops',
  'tecnologia',
]

const getCachedCategoryBySlug = unstable_cache(
  async (slug: string) => prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, icon: true, color: true },
  }),
  ['category-pillar-by-slug'],
  { tags: [PROMOS_PUBLIC_TAG], revalidate: 600 },
)

// Página pilar de categoría — universo acotado a lo necesario para SSR +
// grilla inicial (sin filtros de banco/perfil: esto es la vidriera pública,
// no /promos/explorar). Cache propia (no reusa getPublicPromosPage, que está
// deliberadamente cerrada a la rama "sin filtros" para no arriesgar su
// comportamiento) — mismo patrón de unstable_cache + tag público que el resto
// de RFC-002/003, pageSize moderado para no repetir el incidente de carga
// anónima de 38MB.
const CATEGORY_PAGE_SIZE = 60

const getCachedCategoryPromos = unstable_cache(
  async (categoryId: string) => {
    const today = new Date()
    const startOfToday = new Date(today); startOfToday.setHours(0, 0, 0, 0)

    const [promos, totalCount] = await Promise.all([
      prisma.promo.findMany({
        where: {
          status: 'ACTIVE',
          categoryId,
          validFrom: { lte: today },
          OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
        },
        select: {
          id: true, slug: true, title: true, validDays: true,
          salesChannel: true, validFrom: true, validUntil: true,
          categoryId: true, commerceId: true, isFeatured: true,
          category: { select: { name: true, slug: true, icon: true, color: true } },
          commerce: { select: { id: true, name: true, slug: true, logoUrl: true, activePromoCount: true } },
          requirements: {
            include: {
              bank: { select: { id: true, name: true, slug: true, logoUrl: true } },
              wallet: { select: { id: true, name: true, slug: true, logoUrl: true } },
              cardNetwork: { select: { id: true, name: true, slug: true } },
            },
          },
        },
        orderBy: [
          { isCSIOnly: 'asc' },
          { maxDiscountPct: { sort: 'desc', nulls: 'last' } },
          { id: 'asc' },
        ],
        take: CATEGORY_PAGE_SIZE,
      }),
      prisma.promo.count({
        where: {
          status: 'ACTIVE',
          categoryId,
          validFrom: { lte: today },
          OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
        },
      }),
    ])

    return [promos, totalCount] as const
  },
  ['category-pillar-promos'],
  { tags: [PROMOS_PUBLIC_TAG], revalidate: 600 },
)

// Top comercios por cantidad de promos activas en la categoría — alimenta el
// párrafo SEO y la sección "Comercios con más promos" (misma lógica de
// autoridad temática que /comercios/[slug] usa en sentido inverso).
const getCachedTopCommercesInCategory = unstable_cache(
  async (categoryId: string) => prisma.commerce.findMany({
    where: { defaultCategoryId: categoryId, activePromoCount: { gt: 0 } },
    select: { name: true, slug: true, logoUrl: true, activePromoCount: true },
    orderBy: { activePromoCount: 'desc' },
    take: 8,
  }),
  ['category-pillar-top-commerces'],
  { tags: [PROMOS_PUBLIC_TAG], revalidate: 600 },
)

function buildSeoDescription(categoryName: string, totalCount: number, topCommerceNames: string[]): string {
  const parts: string[] = []
  parts.push(`Todas las promociones bancarias activas en ${categoryName.toLowerCase()} en un solo lugar.`)
  if (totalCount > 0) parts.push(`Hoy hay ${totalCount} promo${totalCount === 1 ? '' : 's'} vigente${totalCount === 1 ? '' : 's'} de bancos, billeteras y tarjetas.`)
  if (topCommerceNames.length > 0) parts.push(`Incluye descuentos en ${topCommerceNames.slice(0, 4).join(', ')} y más.`)
  parts.push('Filtrá por banco, billetera o tarjeta para encontrar el mejor descuento según tu perfil.')
  return parts.join(' ')
}

export async function generateMetadata({ params }: { params: { categoria: string } }): Promise<Metadata> {
  const category = await getCachedCategoryBySlug(params.categoria)
  if (!category) return { title: 'Promociones bancarias en Argentina | PromoAR' }

  const [, totalCount] = await getCachedCategoryPromos(category.id)
  const topCommerces = await getCachedTopCommercesInCategory(category.id)
  const topNames = topCommerces.map(c => c.name)

  const title = `Promos y descuentos en ${category.name}`
  const description = buildSeoDescription(category.name, totalCount, topNames)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_AR',
      url: `${BASE_URL}/promos/categoria/${params.categoria}`,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE_URL}/promos/categoria/${params.categoria}` },
  }
}

export async function generateStaticParams() {
  return PRIORITY_CATEGORY_SLUGS.map(categoria => ({ categoria }))
}

export default async function CategoryPillarPage({ params }: { params: { categoria: string } }) {
  const category = await getCachedCategoryBySlug(params.categoria)
  if (!category) notFound()

  const [[rawPromos, totalCount], topCommerces] = await Promise.all([
    getCachedCategoryPromos(category.id),
    getCachedTopCommercesInCategory(category.id),
  ])

  const promos = JSON.parse(JSON.stringify(rawPromos))
  const seoDescription = buildSeoDescription(category.name, totalCount, topCommerces.map(c => c.name))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Promos y descuentos en ${category.name}`,
    description: seoDescription,
    url: `${BASE_URL}/promos/categoria/${params.categoria}`,
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0A1428] pb-24 lg:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CategoryPageHeader categoryName={category.name} />

      <div className="max-w-5xl mx-auto px-4 lg:px-10 pt-4 lg:pt-8 space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: category.color + '1F' }}
          >
            {category.icon}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0D1B2E] dark:text-white leading-tight">
              Promos en {category.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalCount} promoción{totalCount === 1 ? '' : 'es'} activa{totalCount === 1 ? '' : 's'} hoy
            </p>
          </div>
        </div>

        {/* Párrafo SEO visible */}
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-justify">
          {seoDescription}
        </p>

        {/* Filtros rápidos: bancos, billeteras, tarjetas, días — enlazan a
            /promos/explorar con el filtro pre-aplicado (ver CategoryFilterBar.tsx) */}
        <CategoryFilterBar promos={promos} categorySlug={params.categoria} />

        {/* Comercios destacados de la categoría */}
        {topCommerces.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
            {topCommerces.map(c => (
              <a
                key={c.slug}
                href={`/comercios/${c.slug}`}
                className="shrink-0 w-[108px] snap-start bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 rounded-2xl px-3 py-3 text-center hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
              >
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt={c.name} className="w-9 h-9 mx-auto rounded-xl object-contain border border-[#E4E8EF] dark:border-slate-800 bg-white p-1 mb-2" />
                ) : (
                  <div className="w-9 h-9 mx-auto rounded-xl bg-[#EEF2F8] dark:bg-[#1E3055] flex items-center justify-center text-xs font-black text-[#1D3D6E] dark:text-[#8AADD4] mb-2">
                    {c.name[0]}
                  </div>
                )}
                <p className="text-[11px] font-extrabold text-[#0D1B2E] dark:text-white leading-tight truncate">{c.name}</p>
              </a>
            ))}
          </div>
        )}

        <CategoryPromosGrid promos={promos} categorySlug={params.categoria} totalCount={totalCount} />
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  )
}

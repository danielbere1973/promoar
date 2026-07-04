import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { schemaItemList } from '@/lib/schema'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'
const PAGE_SIZE = 200

function validDaysLabel(mask: number | null): string {
  if (!mask || mask === 127) return 'Todos los días'
  if (mask === 62) return 'Lun–Vie'
  if (mask === 65) return 'Fin de semana'
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) ? names[i] : null).filter(Boolean).join(', ')
}

function discountBadge(req: { discountType: string; discountValue: number | null }): string {
  const v = req.discountValue ?? 0
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${v} CSI`
  return `${v}%`
}

type EntityInfo = { id: string; name: string; slug: string; logoUrl: string | null; type: 'bank' | 'wallet' }

async function getEntity(slug: string): Promise<EntityInfo | null> {
  const bank = await prisma.bank.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, logoUrl: true } })
  if (bank) return { ...bank, type: 'bank' }
  const wallet = await prisma.wallet.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, logoUrl: true } })
  if (wallet) return { ...wallet, type: 'wallet' }
  return null
}

async function getPromos(entity: EntityInfo, page: number) {
  const where = entity.type === 'bank'
    ? { bankId: entity.id }
    : { walletId: entity.id }

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)

  const [promos, total] = await Promise.all([
    prisma.promo.findMany({
      where: {
        status: 'ACTIVE',
        requirements: { some: where },
        OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
      },
      include: {
        commerce: { select: { id: true, name: true, slug: true, logoUrl: true } },
        category: { select: { name: true, icon: true, color: true, slug: true } },
        requirements: {
          where,
          orderBy: { discountValue: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isCSIOnly: 'asc' }, { maxDiscountPct: 'desc' }, { commerce: { activePromoCount: 'desc' } }, { id: 'asc' }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.promo.count({
      where: {
        status: 'ACTIVE',
        requirements: { some: where },
        OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
      },
    }),
  ])

  return { promos, total, totalPages: Math.ceil(total / PAGE_SIZE) }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const entity = await getEntity(params.slug)
  if (!entity) return { title: 'Banco no encontrado — PromoAR' }

  const title = `Promos ${entity.name} hoy — Descuentos y reintegros | PromoAR`
  const description = `Todos los descuentos, reintegros y cuotas sin interés de ${entity.name} actualizados hoy. Filtrá por categoría y encontrá la mejor promo para vos.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/bancos/${entity.slug}`,
      images: entity.logoUrl ? [{ url: entity.logoUrl, alt: entity.name }] : undefined,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE_URL}/bancos/${entity.slug}` },
  }
}

export async function generateStaticParams() {
  const [banks, wallets] = await Promise.all([
    prisma.bank.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.wallet.findMany({ where: { active: true }, select: { slug: true } }),
  ])
  return [...banks, ...wallets].map(e => ({ slug: e.slug }))
}

export default async function BancoPage({ params, searchParams }: { params: { slug: string }, searchParams: { page?: string } }) {
  const entity = await getEntity(params.slug)
  if (!entity) notFound()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const { promos, total, totalPages } = await getPromos(entity, page)

  // Agrupar por categoría
  const byCategory = new Map<string, { name: string; icon: string; color: string; promos: typeof promos }>()
  for (const promo of promos) {
    const key = promo.category.name
    if (!byCategory.has(key)) {
      byCategory.set(key, { name: promo.category.name, icon: promo.category.icon ?? '🏷️', color: promo.category.color, promos: [] })
    }
    byCategory.get(key)!.promos.push(promo)
  }
  const categories = Array.from(byCategory.values()).sort((a, b) => b.promos.length - a.promos.length)

  const bestDiscount = promos.reduce((max, p) => {
    const v = p.requirements[0]?.discountValue ?? 0
    return v > max ? v : max
  }, 0)

  const entityLabel = entity.type === 'wallet' ? 'Billetera' : 'Banco'
  const baseUrl = `/bancos/${entity.slug}`

  const jsonLd = schemaItemList({
    name: `Promos ${entity.name} hoy`,
    description: `Descuentos, reintegros y cuotas sin interés con ${entity.name} en Argentina`,
    url: `${BASE_URL}/bancos/${entity.slug}`,
    items: promos.filter(p => p.slug && p.requirements[0]).slice(0, 50).map(p => ({
      name: `${discountBadge(p.requirements[0] as any)} en ${p.commerce.name}`,
      url: `${BASE_URL}/promos/${p.slug}`,
    })),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Header ── */}
      <div className="bg-[#1E3A5F] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-10 pb-8">
          <Link href="/promos" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>

          <div className="flex items-center gap-4">
            {entity.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entity.logoUrl} alt={entity.name}
                className="w-16 h-16 rounded-2xl object-contain bg-white p-2 shadow-lg shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black shrink-0">
                {entity.name[0]}
              </div>
            )}
            <div>
              <p className="text-blue-300 text-xs font-bold uppercase tracking-widest">{entityLabel}</p>
              <h1 className="text-2xl font-black leading-tight mt-0.5">{entity.name}</h1>
              <p className="text-blue-200 text-sm mt-1">Promos activas hoy</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black">{total}</p>
              <p className="text-blue-200 text-[11px] font-bold mt-0.5">Promos activas</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black text-[#D94F2B]">{bestDiscount > 0 ? `${bestDiscount}%` : '—'}</p>
              <p className="text-blue-200 text-[11px] font-bold mt-0.5">Descuento máximo</p>
            </div>
            <div className="bg-white/10 rounded-2xl px-4 py-3 text-center">
              <p className="text-2xl font-black">{categories.length}</p>
              <p className="text-blue-200 text-[11px] font-bold mt-0.5">Categorías</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filtro rápido por categoría ── */}
      {categories.length > 1 && (
        <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-3">
            {categories.map(cat => (
              <a key={cat.name} href={`#cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors shrink-0"
                style={{ borderColor: cat.color + '40', color: cat.color, backgroundColor: cat.color + '10' }}>
                {cat.icon} {cat.name}
                <span className="bg-white rounded-md px-1 text-[10px]" style={{ color: cat.color }}>{cat.promos.length}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Promos por categoría ── */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {promos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-10 text-center">
            <p className="text-gray-400 text-sm">No hay promos activas en este momento.</p>
          </div>
        )}

        {categories.map(cat => (
          <section key={cat.name} id={`cat-${cat.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{cat.icon}</span>
              <h2 className="text-base font-black text-gray-900">{cat.name}</h2>
              <span className="text-xs font-bold text-gray-400 ml-1">{cat.promos.length}</span>
            </div>
            <div className="space-y-2">
              {cat.promos.map(promo => {
                const req = promo.requirements[0]
                return (
                  <Link key={promo.id} href={`/promos/${promo.slug}`}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 hover:border-[#1E3A5F] hover:shadow-md transition-all px-4 py-3">
                    {promo.commerce.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={promo.commerce.logoUrl} alt={promo.commerce.name}
                        className="w-10 h-10 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                        {promo.commerce.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900 truncate">{promo.commerce.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{validDaysLabel(promo.validDays)}</p>
                    </div>
                    {req && (
                      <div className="bg-[#D94F2B] text-white text-xs font-black px-2.5 py-1 rounded-xl shrink-0">
                        {discountBadge(req as any)}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="max-w-3xl mx-auto px-4 pb-6 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Página {page} de {totalPages} · {total} promos en total
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`${baseUrl}?page=${page - 1}`}
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white hover:border-[#1E3A5F] transition-colors">
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`${baseUrl}?page=${page + 1}`}
                className="px-4 py-2 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold hover:bg-[#162d54] transition-colors">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="max-w-3xl mx-auto px-4 pb-10">
        <Link href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]">
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Tenés tarjeta {entity.name}?</p>
            <p className="text-sm font-black">Ver mis promos personalizadas →</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
        </Link>
      </div>

    </div>
  )
}

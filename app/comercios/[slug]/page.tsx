import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { schemaItemList } from '@/lib/schema'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://promoar.com.ar'

const DAYS_LABELS: Record<number, string> = {
  127: 'Todos los días',
  62:  'Lun–Vie',
  65:  'Fin de semana',
}

function validDaysLabel(mask: number | null): string {
  if (!mask || mask === 127) return 'Todos los días'
  if (DAYS_LABELS[mask]) return DAYS_LABELS[mask]
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) ? names[i] : null).filter(Boolean).join(', ')
}

function discountLabel(req: { discountType: string; discountValue: number | null }): string {
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO':
    case 'PERCENTAGE_DESCUENTO': return `${v}% de descuento`
    case 'BONIFICACION':         return `${v}% bonificación`
    case 'CUOTAS_SIN_INTERES':   return `${v} cuotas sin interés`
    case 'FIXED_AMOUNT':         return `$${v.toLocaleString('es-AR')} de descuento`
    default: return `${v}%`
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const commerce = await prisma.commerce.findUnique({
    where: { slug: params.slug },
    include: { defaultCategory: true },
  })
  if (!commerce) return { title: 'Comercio no encontrado — PromoAR' }

  const title = `Promos y descuentos en ${commerce.name} | PromoAR`
  const description = `Encontrá todos los descuentos, cuotas sin interés y reintegros disponibles en ${commerce.name}. Actualizados todos los días.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${BASE_URL}/comercios/${commerce.slug}`,
      images: commerce.logoUrl ? [{ url: commerce.logoUrl, alt: commerce.name }] : undefined,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `${BASE_URL}/comercios/${commerce.slug}` },
  }
}

export async function generateStaticParams() {
  const commerces = await prisma.commerce.findMany({
    where: { active: true, instagramUrl: { not: null } },
    select: { slug: true },
  })
  return commerces.map(c => ({ slug: c.slug }))
}

export default async function CommercePage({ params }: { params: { slug: string } }) {
  const commerce = await prisma.commerce.findUnique({
    where: { slug: params.slug },
    include: {
      defaultCategory: true,
      _count: { select: { branches: true } },
    },
  })

  if (!commerce || !commerce.active) notFound()

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const promos = await prisma.promo.findMany({
    where: {
      commerceId: commerce.id,
      status: 'ACTIVE',
      OR: [{ validUntil: null }, { validUntil: { gte: startOfToday } }],
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      requirements: {
        include: { bank: { select: { name: true, logoUrl: true } }, wallet: { select: { name: true, logoUrl: true } } },
        orderBy: { discountValue: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const bestPromo = promos[0]
  const bestReq = bestPromo?.requirements[0]

  const jsonLd = schemaItemList({
    name: `Promos y descuentos en ${commerce.name}`,
    description: `Descuentos, cuotas sin interés y reintegros disponibles en ${commerce.name}`,
    url: `${BASE_URL}/comercios/${commerce.slug}`,
    items: promos.filter(p => p.slug && p.requirements[0]).map(p => ({
      name: discountLabel(p.requirements[0] as any),
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
        <div className="max-w-2xl mx-auto px-4 pt-10 pb-8">
          <Link href="/promos" className="inline-flex items-center gap-1.5 text-blue-300 text-xs font-semibold mb-6 hover:text-white transition-colors">
            ← Volver a PromoAR
          </Link>

          <div className="flex items-center gap-4">
            {commerce.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={commerce.logoUrl} alt={commerce.name}
                className="w-16 h-16 rounded-2xl object-contain bg-white p-2 shadow-lg shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black shrink-0">
                {commerce.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black leading-tight">{commerce.name}</h1>
              {commerce.defaultCategory && (
                <p className="text-blue-200 text-sm mt-0.5">{commerce.defaultCategory.name}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {commerce.instagramUrl && (
                  <a href={commerce.instagramUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-pink-300 hover:text-pink-200 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </a>
                )}
                {commerce.website && (
                  <a href={commerce.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-300 hover:text-white transition-colors">
                    🌐 Sitio web
                  </a>
                )}
                {commerce._count.branches > 0 && (
                  <span className="text-xs text-blue-300">📍 {commerce._count.branches} sucursales</span>
                )}
              </div>
            </div>
          </div>

          {bestReq && (
            <div className="mt-6 bg-white/10 rounded-2xl px-4 py-3">
              <p className="text-xs text-blue-200 font-bold uppercase tracking-widest mb-1">Mejor promo activa</p>
              <p className="text-lg font-black">{discountLabel(bestReq as any)}</p>
              {(bestReq.bank || bestReq.wallet) && (
                <p className="text-blue-200 text-sm">con {bestReq.bank?.name || bestReq.wallet?.name}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Promos ── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
          {promos.length} {promos.length === 1 ? 'promo activa' : 'promos activas'}
        </p>

        {promos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm">No hay promos activas en este momento.</p>
          </div>
        )}

        {promos.map(promo => {
          const bestR = promo.requirements[0]
          const entities = [
            ...Array.from(new Map(promo.requirements.filter(r => r.bank).map(r => [r.bank!.name, r.bank!])).values()),
            ...Array.from(new Map(promo.requirements.filter(r => r.wallet).map(r => [r.wallet!.name, r.wallet!])).values()),
          ]

          return (
            <Link key={promo.id} href={`/promos/${promo.slug}`}
              className="block bg-white rounded-2xl border border-gray-100 hover:border-[#1E3A5F] hover:shadow-md transition-all px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-gray-900 leading-tight truncate">{promo.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {promo.category.icon} {promo.category.name} · {validDaysLabel(promo.validDays)}
                  </p>
                  {entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entities.slice(0, 3).map((e, i) => (
                        <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                          {e.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {bestR && (
                  <div className="bg-[#D94F2B] text-white text-sm font-black px-3 py-1.5 rounded-xl shrink-0">
                    {bestR.discountType === 'CUOTAS_SIN_INTERES'
                      ? `${bestR.discountValue} CSI`
                      : `${bestR.discountValue}%`}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── CTA ── */}
      <div className="max-w-2xl mx-auto px-4 pb-10">
        <Link href="/promos"
          className="flex items-center justify-between bg-gradient-to-r from-[#1E3A5F] to-[#2a4f82] text-white rounded-3xl px-5 py-4 shadow-lg hover:shadow-xl transition-all hover:scale-[1.01]">
          <div>
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-0.5">¿Querés ver tus promos?</p>
            <p className="text-sm font-black">Ver todas las promos de mis tarjetas →</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
        </Link>
      </div>

    </div>
  )
}

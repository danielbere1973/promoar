import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import BottomNav from '@/app/components/BottomNav'
import BackButton from '@/app/components/BackButton'
import DetailSidebar from './DetailSidebar'
import { PROMO_DETAIL_TAG } from '@/lib/cache/detailCache'

// Sugerencias para cuando la promo pedida ya no existe/venció: traemos las
// promos vigentes con mejor descuento (mismo criterio isCSIOnly/maxDiscountPct
// que el resto del sitio) en vez de solo links a categorías vacías.
const getCachedTopPromos = unstable_cache(
  async () => {
    const promos = await prisma.promo.findMany({
      where: { status: 'ACTIVE', isCSIOnly: false, maxDiscountPct: { gt: 0 } },
      select: {
        slug: true,
        title: true,
        commerce: { select: { name: true, logoUrl: true } },
        category: { select: { name: true, icon: true } },
        requirements: {
          where: { discountType: { in: ['PERCENTAGE_REINTEGRO', 'PERCENTAGE_DESCUENTO', 'BONIFICACION', 'FIXED_AMOUNT'] } },
          orderBy: { discountValue: 'desc' },
          take: 1,
          select: { discountValue: true, discountType: true },
        },
      },
      orderBy: [{ maxDiscountPct: 'desc' }],
      take: 6,
    })
    return promos.filter(p => p.requirements[0])
  },
  ['promo-not-found-top-promos'],
  { tags: [PROMO_DETAIL_TAG], revalidate: false },
)

function discountLabel(req: { discountValue: number; discountType: string }) {
  const v = req.discountValue
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return `${v}% reintegro`
    case 'PERCENTAGE_DESCUENTO': return `${v}% OFF`
    case 'CUOTAS_SIN_INTERES': return `${v} cuotas sin interés`
    case 'BONIFICACION': return `${v}% bonificación`
    case 'FIXED_AMOUNT': return `$${v} de descuento`
    default: return `${v}%`
  }
}

export default async function PromoNotFound() {
  const suggestions = await getCachedTopPromos()

  return (
    <div className="min-h-screen bg-gray-50 pb-24 lg:pb-0 lg:flex">
      <DetailSidebar />
      <div className="flex-1 min-w-0 lg:overflow-y-auto">
        <div className="lg:hidden">
          <BackButton label="Promociones" />
        </div>
        <div className="max-w-lg lg:max-w-xl mx-auto px-4 lg:px-10 pt-4 lg:pt-10 space-y-4">
          {/* ── HERO — misma impronta que la tarjeta de detalle real ── */}
          <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2a4f82] rounded-3xl overflow-hidden shadow-lg relative px-6 pt-6 pb-5 text-white">
            <div className="absolute top-0 right-0 z-10 bg-gray-700 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl">
              No disponible
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Esta promo ya no está</span>
            <p className="mt-2 mb-1 text-2xl font-black tracking-tight leading-snug">
              Venció o fue reemplazada por otra mejor
            </p>
            <p className="text-sm text-blue-100 leading-relaxed mt-2">
              Pero tenemos un montón de promos vigentes esperándote — mirá las mejores de hoy abajo.
            </p>
          </div>

          {/* ── CTA inmediato, debajo del hero ── */}
          <a
            href="/promos"
            className="flex items-center justify-between bg-gray-900 text-white rounded-3xl px-5 py-4 shadow-lg hover:bg-gray-800 transition-colors"
          >
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">¿Querés ver todo?</p>
              <p className="text-sm font-black">Ver todas las promos →</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#D94F2B] flex items-center justify-center shrink-0 ml-3 text-lg">🎯</div>
          </a>

          {/* ── SUGERENCIAS: promos vigentes con mejor descuento ── */}
          {suggestions.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[13px] font-black text-gray-900 px-1">Promos que sí están activas ahora</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map(p => (
                  <a
                    key={p.slug}
                    href={`/promos/${p.slug}`}
                    className="bg-white border border-gray-200 rounded-2xl px-3.5 py-3 hover:border-[#1E3A5F]/40 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      {p.commerce.logoUrl ? (
                        <img src={p.commerce.logoUrl} alt={p.commerce.name} className="w-6 h-6 rounded-md object-contain border border-gray-100 bg-white shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 shrink-0">
                          {p.commerce.name[0]}
                        </div>
                      )}
                      <p className="text-[11.5px] font-extrabold text-gray-900 truncate">{p.commerce.name}</p>
                    </div>
                    <p className="text-xl font-black text-emerald-600 leading-none mb-2">{discountLabel(p.requirements[0])}</p>
                    <span className="inline-block text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md truncate">
                      {p.category.icon} {p.category.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

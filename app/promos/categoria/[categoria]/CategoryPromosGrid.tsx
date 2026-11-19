// Grid server-rendered para la página pilar de categoría. A diferencia de
// PromoCard (app/components/PromoCard.tsx), pensado para la grilla interactiva
// client-side de /promos y /promos/explorar, esto son enlaces <a href> reales
// servidos en el HTML inicial — lo que Googlebot necesita para descubrir e
// indexar cada /promos/[slug] vía enlace interno desde el hub de categoría.
// Mismo lenguaje visual que PromoCard (tinte de categoría en el logo, pill de
// descuento, chip de entidad) para que la página se sienta parte de la app,
// no una landing SEO aparte (feedback de Pablo, 18/11/2026).

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  discountType?: string
  discountValue?: number
}

type Promo = {
  id: string
  slug: string | null
  title: string
  category: { color: string; icon?: string }
  commerce: { name: string; logoUrl?: string | null }
  requirements: Req[]
}

function discountDisplay(req: Req | undefined): { num: string; unit: string; label: string; isCsi: boolean } {
  if (!req) return { num: '', unit: '', label: '', isCsi: false }
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return { num: `${v}`, unit: '%', label: 'reintegro', isCsi: false }
    case 'PERCENTAGE_DESCUENTO': return { num: `${v}`, unit: '%', label: 'descuento', isCsi: false }
    case 'CUOTAS_SIN_INTERES': return { num: `${v}`, unit: '', label: `cuota${v !== 1 ? 's' : ''} s/int.`, isCsi: true }
    case 'BONIFICACION': return { num: `${v}`, unit: '%', label: 'bonif.', isCsi: false }
    case 'FIXED_AMOUNT': return { num: `$${v.toLocaleString('es-AR')}`, unit: '', label: 'descuento', isCsi: false }
    default: return { num: `${v}`, unit: '%', label: '', isCsi: false }
  }
}

export default function CategoryPromosGrid({ promos, categorySlug, totalCount }: { promos: Promo[]; categorySlug: string; totalCount: number }) {
  if (promos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-10">
        No hay promociones activas en esta categoría por el momento.
      </p>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {promos.map(promo => {
          const best = promo.requirements[0]
          const entityName = best?.bank?.name ?? best?.wallet?.name ?? ''
          const { num, unit, label, isCsi } = discountDisplay(best)
          return (
            <a
              key={promo.id}
              href={promo.slug ? `/promos/${promo.slug}` : '#'}
              className="group bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-800 rounded-2xl overflow-hidden hover:border-[#1D3D6E] dark:hover:border-[#3A6BC4] transition-colors"
              style={{ boxShadow: '0 2px 8px rgba(29,61,110,0.08), 0 0 0 1px rgba(29,61,110,0.05)' }}
            >
              <div
                className="flex items-center justify-center"
                style={{ height: 88, background: promo.category.color + '14' }}
              >
                {promo.commerce.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="max-h-[58px] max-w-[80%] object-contain" loading="lazy" />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                    style={{ background: promo.category.color + '25', color: promo.category.color }}
                  >
                    {promo.category.icon ?? promo.commerce.name[0]}
                  </div>
                )}
              </div>

              <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
                <p className="text-[12px] font-bold text-[#0D1B2E] dark:text-white leading-tight truncate">{promo.commerce.name}</p>

                {num && (
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-baseline gap-0.5 rounded-full px-2.5 py-0.5 ${
                      isCsi
                        ? 'bg-[#EEF4FF] dark:bg-[#1A2F55] text-[#2A5298] dark:text-[#8AADD4]'
                        : 'bg-[#1D3D6E] dark:bg-[#3A6BC4] text-white'
                    }`}>
                      <span className="text-[14px] font-black leading-none tabular-nums">{num}</span>
                      {unit && <span className="text-[10px] font-black ml-0.5" style={{ color: isCsi ? '#2A5298' : '#E8471C' }}>{unit}</span>}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-slate-500 truncate">{label}</span>
                  </div>
                )}

                {entityName && (
                  <span className="inline-block self-start text-[9px] font-semibold px-1.5 py-0.5 rounded-lg bg-[#EEF2F8] dark:bg-[#1E3055] text-[#1D3D6E] dark:text-[#8AADD4] border border-[#D0DBF0] dark:border-[#2A4070] truncate max-w-full">
                    {entityName}
                  </span>
                )}
              </div>
            </a>
          )
        })}
      </div>

      {totalCount > promos.length && (
        <div className="text-center pt-2">
          <a
            href={`/promos/explorar?cats=${categorySlug}`}
            className="inline-block text-sm font-bold text-[#1D3D6E] dark:text-[#8AADD4] hover:underline"
          >
            Ver las {totalCount} promociones con filtros →
          </a>
        </div>
      )}
    </>
  )
}

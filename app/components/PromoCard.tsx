'use client'

type Req = {
  bank?: { name: string } | null
  wallet?: { name: string } | null
  discountType?: string
  discountValue?: number
}

type Promo = {
  id: string
  title: string
  validDays: number
  category: { name: string; color: string; icon?: string }
  commerce: { id?: string; name: string; logoUrl?: string | null }
  requirements: Req[]
}

function bestPercentageReq(p: Promo): Req | null {
  const pctReqs = p.requirements.filter(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION' ||
    r.discountType === 'FIXED_AMOUNT'
  )
  if (!pctReqs.length) return null
  return pctReqs.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), pctReqs[0])
}

function maxDiscountReq(p: Promo): Req | null {
  if (!p.requirements.length) return null
  return p.requirements.reduce((max, r) => ((r.discountValue || 0) > (max?.discountValue || 0) ? r : max), p.requirements[0])
}

function discountLabel(p: Promo): string {
  const req = bestPercentageReq(p) ?? maxDiscountReq(p)
  if (!req) return ''
  const val = req.discountValue ?? 0
  if (req.discountType === 'PERCENTAGE_REINTEGRO' || req.discountType === 'PERCENTAGE_DESCUENTO') return `Hasta ${val}%`
  if (req.discountType === 'BONIFICACION') return `Hasta ${val}% BONIF.`
  if (req.discountType === 'FIXED_AMOUNT') return `Hasta $${val}`
  if (req.discountType === 'CUOTAS_SIN_INTERES') return `${val} CSI`
  return `Hasta ${val}`
}

function formatValidDays(mask: number) {
  if (!mask || mask === 127) return 'Todos los días'
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const active = []
  for (let i = 0; i < 7; i++) {
    if ((mask & (1 << i)) !== 0) active.push(days[i])
  }
  if (active.length === 2 && (mask & (1 << 6)) && (mask & (1 << 0))) return 'Fin de semana'
  if (active.length === 5 && !(mask & (1 << 0)) && !(mask & (1 << 6))) return 'Lunes a Viernes'
  return active.join(', ')
}

type Props = {
  promo: Promo
  nearbyCount?: number | null
  onClick: () => void
  fullWidth?: boolean
}

export default function PromoCard({ promo, nearbyCount, onClick, fullWidth }: Props) {
  const pctReq = bestPercentageReq(promo)
  const label = discountLabel(promo)
  const banks = Array.from(new Map(promo.requirements.filter(r => r.bank?.name).map(r => [r.bank!.name, r.bank!])).values())
  const wallets = Array.from(new Map(promo.requirements.filter(r => r.wallet?.name).map(r => [r.wallet!.name, r.wallet!])).values())
  const entities = [...banks, ...wallets].slice(0, 2)
  const days = formatValidDays(promo.validDays)

  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-slate-800 border-2 border-[#EAECF0] dark:border-slate-700 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:scale-[1.03] hover:border-[#1E3A5F] active:scale-[0.97] ${fullWidth ? 'w-full' : 'flex-shrink-0'}`}
      style={fullWidth ? undefined : { width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }}
    >
      <div className="h-0.5 bg-[#1E3A5F] dark:bg-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      {/* Imagen/Logo */}
      <div className="relative bg-[#F8F9FB] dark:bg-slate-900 border-b border-[#F0F2F5] dark:border-slate-700 flex items-center justify-center" style={{ height: 80 }}>
        {promo.commerce.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promo.commerce.logoUrl} alt={promo.commerce.name} className="max-h-12 max-w-[80%] object-contain p-2" />
        ) : (
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black" style={{ background: promo.category.color + '20', color: promo.category.color }}>
            {promo.category.icon ?? '🏷️'}
          </div>
        )}
        {(pctReq?.discountValue ?? 0) <= 100 && label && (
          <div className="absolute top-2 right-2 bg-[#D94F2B] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight">
            {pctReq ? `${pctReq.discountValue}%` : label.replace('Hasta ', '')}
          </div>
        )}
        {!!nearbyCount && (
          <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 text-white text-[9px] font-semibold px-2 py-0.5 text-center truncate">
            📍 {nearbyCount} {nearbyCount === 1 ? 'sucursal' : 'sucursales'}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-2.5 pt-2 pb-3 space-y-1.5">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate leading-tight">{promo.commerce.name}</p>
        <p className="text-[11px] text-gray-700 dark:text-slate-400 leading-tight truncate">{promo.title !== promo.commerce.name ? promo.title : label}</p>

        {entities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entities.map((e, i) => (
              <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-[#EEF2F8] dark:bg-slate-700 text-[#3A5A7A] dark:text-slate-300 border border-[#C8D5E8] dark:border-slate-600">
                {e.name.split(' ').slice(-1)[0]}
              </span>
            ))}
          </div>
        )}

        <p className="text-[10px] text-gray-500 dark:text-slate-400">{days === 'Todos los días' ? 'Todos los días' : days.replace('Lunes a viernes', 'Lun–Vie')}</p>
      </div>
    </div>
  )
}

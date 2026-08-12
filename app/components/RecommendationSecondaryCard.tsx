'use client'
import React from 'react'
import PaymentMethodBadge from './PaymentMethodBadge'

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
}

function bestDiscountReq(reqs: Req[]): Req | null {
  const pct = reqs.filter(r =>
    r.discountType === 'PERCENTAGE_REINTEGRO' ||
    r.discountType === 'PERCENTAGE_DESCUENTO' ||
    r.discountType === 'BONIFICACION'
  )
  if (pct.length) return pct.reduce((a, b) => (b.discountValue ?? 0) > (a.discountValue ?? 0) ? b : a)
  const fixed = reqs.filter(r => r.discountType === 'FIXED_AMOUNT')
  if (fixed.length) return fixed[0]
  return reqs[0] ?? null
}

function discountDisplay(req: Req | null): { num: string; unit: string } {
  if (!req) return { num: '', unit: '' }
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO':
    case 'PERCENTAGE_DESCUENTO':
    case 'BONIFICACION':       return { num: `${v}`, unit: '%' }
    case 'FIXED_AMOUNT':       return { num: `$${v.toLocaleString('es-AR')}`, unit: '' }
    case 'CUOTAS_SIN_INTERES': return { num: `${v}`, unit: 'CSI' }
    case 'NXM':                return { num: `${req.nxmN ?? 2}x${req.nxmM ?? 1}`, unit: '' }
    default:                   return { num: `${v}`, unit: '%' }
  }
}

type Props = {
  promo: any
  reasons: string[]
  onClick: () => void
}

// Tarjeta propia para la 2da/3ra recomendación de la Home (Home v2) — antes
// reutilizaba PromoCard (pensada para el catálogo, con más metadata visible
// de la que hace falta acá). Mismo lenguaje visual que RecommendationSpotlight,
// jerarquía reducida: comercio + descuento + medio de pago + 1 reason.
export default function RecommendationSecondaryCard({ promo, reasons, onClick }: Props) {
  const bestReq = bestDiscountReq(promo.requirements ?? [])
  const { num, unit } = discountDisplay(bestReq)

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 p-3 hover:border-[#1D3D6E]/40 dark:hover:border-[#3A6BC4]/50 transition-colors flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <div
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
          style={{ background: (promo.category?.color ?? '#1E3A5F') + '14' }}
        >
          {promo.commerce?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promo.commerce.logoUrl} alt="" className="max-h-6 max-w-[80%] object-contain" />
          ) : (
            <span className="text-base">{promo.category?.icon ?? '🏷️'}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#0D1B2E] dark:text-white truncate">{promo.commerce?.name}</p>
          {num && (
            <p className="text-[17px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">{num}{unit}</p>
          )}
        </div>
      </div>

      <PaymentMethodBadge req={bestReq} size="sm" />

      {reasons?.[0] && (
        <p className="text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 flex items-start gap-1">
          <span aria-hidden="true" className="text-[#1D3D6E] dark:text-[#8AADD4] shrink-0">✓</span>
          <span className="line-clamp-2">{reasons[0]}</span>
        </p>
      )}
    </button>
  )
}

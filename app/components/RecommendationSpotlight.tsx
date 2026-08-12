'use client'
import React from 'react'
import { trackRecommendationEvent } from '@/lib/recommendationEvents'
import PaymentMethodBadge from './PaymentMethodBadge'
import type { RecommendationResponse } from '@/lib/useRecommendations'

type Req = {
  bank?: { name: string; logoUrl?: string | null } | null
  wallet?: { name: string; logoUrl?: string | null } | null
  cardNetwork?: { name: string; slug: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
  capUnlimited?: boolean | null
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

function discountDisplay(req: Req | null): { num: string; unit: string; label: string } {
  if (!req) return { num: '', unit: '', label: '' }
  const v = req.discountValue ?? 0
  switch (req.discountType) {
    case 'PERCENTAGE_REINTEGRO': return { num: `${v}`, unit: '%', label: 'de reintegro' }
    case 'PERCENTAGE_DESCUENTO': return { num: `${v}`, unit: '%', label: 'de descuento' }
    case 'BONIFICACION':         return { num: `${v}`, unit: '%', label: 'de bonificación' }
    case 'FIXED_AMOUNT':         return { num: `$${v.toLocaleString('es-AR')}`, unit: '', label: 'de descuento' }
    case 'CUOTAS_SIN_INTERES':   return { num: `${v}`, unit: '', label: `cuota${v !== 1 ? 's' : ''} sin interés` }
    case 'NXM':                  return { num: `${req.nxmN ?? 2}x${req.nxmM ?? 1}`, unit: '', label: 'en la compra' }
    default:                     return { num: `${v}`, unit: '%', label: '' }
  }
}

function isExpiringSoon(validUntil: string | Date | null | undefined): boolean {
  if (!validUntil) return false
  const until = new Date(validUntil)
  const today = new Date()
  const diffDays = Math.ceil((until.getTime() - today.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= 2
}

type Props = {
  data: RecommendationResponse | null
  loading: boolean
  /** Top 3 genérico (no personalizado) para mostrar como teaser real cuando falta perfil. */
  teaserPromos?: any[]
  onOpenPromo: (promo: any) => void
  onGoToProfile: () => void
}

// Spotlight — único bloque del primer viewport de la Home cerrada (Home v2).
// Reemplaza a HomeHero: misma lógica de datos/estados, pero con el medio de
// pago como elemento protagonista (badge con logo), no solo texto en el reason.
export default function RecommendationSpotlight({ data, loading, teaserPromos, onOpenPromo, onGoToProfile }: Props) {
  if (loading && !data) {
    return (
      <div className="px-4 pt-3 pb-5">
        <div className="h-6 w-52 rounded-lg bg-gray-100 dark:bg-slate-800 animate-pulse mb-4" />
        <div className="rounded-3xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 p-5 h-[180px] animate-pulse" />
      </div>
    )
  }

  if (!data || data.status === 'incomplete_profile') {
    const teaser = teaserPromos?.slice(0, 3) ?? []
    return (
      <div className="px-4 pt-3 pb-5">
        <h1 className="text-[21px] font-black text-[#0D1B2E] dark:text-white leading-tight mb-1">
          Encontrá las promos que valen la pena
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mb-4 leading-snug">
          Cargá tus tarjetas y billeteras para que te mostremos solo lo que te sirve a vos.
        </p>

        {teaser.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {teaser.map(promo => {
              const req = bestDiscountReq(promo.requirements ?? [])
              const { num, unit } = discountDisplay(req)
              return (
                <div
                  key={promo.id}
                  className="relative rounded-2xl bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 p-3 flex flex-col items-center text-center overflow-hidden"
                >
                  <div className="absolute inset-0 backdrop-blur-[1.5px] bg-white/55 dark:bg-[#0F2040]/55 pointer-events-none" />
                  <div
                    className="relative w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden mb-1.5"
                    style={{ background: (promo.category?.color ?? '#1E3A5F') + '14' }}
                  >
                    {promo.commerce?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={promo.commerce.logoUrl} alt="" className="max-h-6 max-w-[80%] object-contain" />
                    ) : (
                      <span className="text-base">{promo.category?.icon ?? '🏷️'}</span>
                    )}
                  </div>
                  <span className="relative text-[15px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
                    {num}{unit}
                  </span>
                  <span className="relative text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-full mt-0.5">
                    {promo.commerce?.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={onGoToProfile}
          className="inline-flex items-center gap-2 text-[13px] font-black text-white bg-[#1D3D6E] dark:bg-[#3A6BC4] rounded-2xl px-5 py-3 hover:opacity-90 transition-opacity"
        >
          {teaser.length > 0 ? 'Ver si aplican a mi tarjeta →' : 'Configurar mi perfil →'}
        </button>
      </div>
    )
  }

  if (data.status === 'empty') {
    return (
      <div className="px-4 pt-3 pb-5">
        <h1 className="text-[19px] font-black text-[#0D1B2E] dark:text-white leading-tight">
          Sin oportunidades para tu perfil hoy
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Probá explorar el catálogo completo — puede haber algo para otro día de la semana.
        </p>
      </div>
    )
  }

  const recos = data.recommendations
  const top = recos[0]
  const count = recos.length

  const bestReq = bestDiscountReq(top.promo.requirements ?? [])
  const { num, unit, label } = discountDisplay(bestReq)
  const expiringSoon = isExpiringSoon(top.promo.validUntil)
  const isOnline = top.promo.salesChannel === 'ONLINE' || top.promo.salesChannel === 'BOTH'

  const handleClick = () => {
    trackRecommendationEvent('recommendation_clicked', {
      recommendation_position: 1,
      commerceId: top.promo.commerce?.id,
      promoId: top.promo.id,
      recommendation_reasons: top.reasons,
      recommendation_status: data.status,
      generatedAt: data.generatedAt,
      latency_ms: data.latencyMs,
    })
    onOpenPromo(top.promo)
  }

  return (
    <div className="px-4 pt-3 pb-5">
      <p className="text-[10px] font-black uppercase tracking-wider text-[#E8471C] mb-1.5">Hoy te conviene</p>
      <h1 className="text-[21px] font-black text-[#0D1B2E] dark:text-white leading-tight mb-4">
        {count === 1
          ? 'Una oportunidad que vale la pena'
          : <><span className="text-[#E8471C]">{count} oportunidades</span> que valen la pena</>}
      </h1>

      <button
        onClick={handleClick}
        className="w-full text-left rounded-3xl bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 p-4 hover:border-[#1D3D6E]/40 dark:hover:border-[#3A6BC4]/50 hover:shadow-[0_8px_24px_rgba(29,61,110,0.12)] transition-all group"
      >
        <div className="flex items-center gap-4">
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ background: (top.promo.category?.color ?? '#1E3A5F') + '14' }}
          >
            {top.promo.commerce?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={top.promo.commerce.logoUrl} alt={top.promo.commerce.name} className="max-h-10 max-w-[85%] object-contain" />
            ) : (
              <span className="text-2xl">{top.promo.category?.icon ?? '🏷️'}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#0D1B2E] dark:text-white truncate">{top.promo.commerce?.name}</p>
            {num && (
              <p className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[28px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">{num}{unit}</span>
                <span className="text-[12px] text-slate-400 dark:text-slate-500">{label}</span>
              </p>
            )}
          </div>

          <span className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-[#1D3D6E] dark:group-hover:text-[#8AADD4] transition-colors text-lg">→</span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <PaymentMethodBadge req={bestReq} />
          {top.reasons?.[0] && (
            <p className="text-[11px] font-semibold text-[#1D3D6E] dark:text-[#8AADD4] flex items-center gap-1 min-w-0">
              <span aria-hidden="true">✓</span>
              <span className="truncate">{top.reasons[0]}</span>
            </p>
          )}
        </div>
      </button>

      {(expiringSoon || isOnline) && (
        <div className="flex items-center gap-2 mt-3">
          {expiringSoon && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#E8471C] bg-[#FDEEE8] dark:bg-[#3A1F14] border border-[#F6D5C8] dark:border-[#5A3320] rounded-lg px-2 py-1">
              Vence pronto
            </span>
          )}
          {isOnline && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] rounded-lg px-2 py-1">
              Online ahora
            </span>
          )}
        </div>
      )}
    </div>
  )
}

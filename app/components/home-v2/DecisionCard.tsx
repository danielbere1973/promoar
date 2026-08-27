'use client'

import Link from 'next/link'
import type { DecisionCandidate } from '@/lib/homeDecisionContract'
import { benefitDisplay } from '@/lib/benefitDisplay'
import { reasonsToText } from '@/lib/reasonText'
import type { useTracking } from '@/lib/useTracking'

type Props = {
  candidate: DecisionCandidate
  variant: 'spotlight' | 'secondary'
  rubroId: string
  track: ReturnType<typeof useTracking>['track']
}

function promoHref(promo: unknown): string | null {
  const p = promo as { slug?: string | null; id?: string } | null
  if (!p) return null
  if (p.slug) return `/promos/${p.slug}`
  if (p.id) return `/promos/${p.id}`
  return null
}

export default function DecisionCard({ candidate, variant, rubroId, track }: Props) {
  const { facts } = candidate
  const { num, unit, label, isCsi } = benefitDisplay(facts.benefit)
  const reasons = candidate.reasonsText ?? reasonsToText(candidate.reasons)
  const topReason = reasons[0] ?? null
  const href = promoHref(candidate.promo)
  const promoId = (candidate.promo as { id?: string } | null)?.id

  function handleClick() {
    track({
      type: 'RECOMMENDATION_CLICK',
      rubroId,
      promoId,
      commerceName: facts.commerceName,
      variant,
    })
  }

  if (variant === 'spotlight') {
    return (
      <Link
        href={href ?? '/promos'}
        onClick={handleClick}
        className="block rounded-2xl bg-[#1E3A5F] dark:bg-[#142840] text-white p-5 shadow-lg relative overflow-hidden transition-transform active:scale-[0.98] hover:brightness-110"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">
              {facts.paymentMethod.bankOrWalletName}
            </p>
            <h3 className="text-lg font-black leading-tight truncate">{facts.commerceName}</h3>
          </div>
          <div className={`shrink-0 rounded-xl px-3 py-2 text-center ${isCsi ? 'bg-white/15' : 'bg-[#D94F2B]'}`}>
            <p className="text-2xl font-black leading-none">{num}{unit}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-90">{label}</p>
          </div>
        </div>

        {topReason && (
          <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-blue-100 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            {topReason}
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs text-blue-100">
          {facts.cap && !facts.cap.unlimited && facts.cap.amount != null && (
            <span className="bg-white/10 rounded-lg px-2 py-1">
              Tope ${facts.cap.amount.toLocaleString('es-AR')}{facts.cap.period ? `/${facts.cap.period}` : ''}
            </span>
          )}
          {facts.validity.validDaysLabel && (
            <span className="bg-white/10 rounded-lg px-2 py-1">{facts.validity.validDaysLabel}</span>
          )}
          {facts.validity.expiresSoon && (
            <span className="bg-[#D94F2B]/30 text-[#ffb199] rounded-lg px-2 py-1 font-bold">Vence pronto</span>
          )}
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href ?? '/promos'}
      onClick={handleClick}
      className="block rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 p-3.5 transition-transform active:scale-[0.98] hover:border-gray-200 dark:hover:border-slate-600"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-black text-gray-900 dark:text-white truncate min-w-0">{facts.commerceName}</p>
        <span className={`shrink-0 text-xs font-black px-2 py-0.5 rounded-lg ${isCsi ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200' : 'bg-[#D94F2B] text-white'}`}>
          {num}{unit}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{facts.paymentMethod.bankOrWalletName}</p>
      {topReason && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{topReason}</p>
      )}
    </Link>
  )
}

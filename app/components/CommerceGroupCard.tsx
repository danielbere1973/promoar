'use client'
import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import PromoCard from './PromoCard'

type Req = {
  bank?: { name: string; slug?: string } | null
  wallet?: { name: string; slug?: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
}

type Promo = {
  id: string
  title: string
  slug?: string | null
  validDays: number
  salesChannel?: string | null
  isSaved?: boolean
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

function discountValue(p: Promo): number {
  return (bestPercentageReq(p) ?? maxDiscountReq(p))?.discountValue ?? 0
}

function isValidToday(p: Promo, todayMask: number): boolean {
  return !p.validDays || p.validDays === 127 || (p.validDays & todayMask) !== 0
}

type Props<P extends Promo> = {
  commerce: { id?: string; name: string; logoUrl?: string | null }
  promos: P[]
  onPromoClick: (p: P) => void
  onToggleSave?: (id: string, e: React.MouseEvent) => void
  nearbyCount?: number | null
}

export default function CommerceGroupCard<P extends Promo>({ commerce, promos, onPromoClick, onToggleSave, nearbyCount }: Props<P>) {
  const [expanded, setExpanded] = useState(false)
  const [showOtherDays, setShowOtherDays] = useState(false)

  if (promos.length === 0) return null

  const todayMask = 1 << new Date().getDay()
  const sorted = [...promos].sort((a, b) => discountValue(b) - discountValue(a))
  const today = sorted.filter(p => isValidToday(p, todayMask))
  const others = sorted.filter(p => !isValidToday(p, todayMask))
  const featured = today[0] ?? sorted[0]
  const restToday = today.filter(p => p.id !== featured.id)

  if (!expanded) {
    return (
      <div className="flex-shrink-0 relative" style={{ width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }}>
        <PromoCard promo={featured} nearbyCount={nearbyCount} onClick={() => onPromoClick(featured)} onToggleSave={onToggleSave} fullWidth />
        {promos.length > 1 && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1.5 w-full text-[11px] font-bold text-[#1E3A5F] dark:text-white bg-[#EEF2F8] dark:bg-slate-700 border border-[#C8D5E8] dark:border-slate-600 rounded-xl py-1.5 flex items-center justify-center gap-1 hover:bg-[#1E3A5F] hover:text-white hover:border-[#1E3A5F] transition-colors"
          >
            +{promos.length - 1} promo{promos.length - 1 === 1 ? '' : 's'} <ChevronDown size={12} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 border-2 border-[#1E3A5F] dark:border-slate-600 rounded-2xl overflow-hidden w-full max-w-sm shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[#F0F2F5] dark:border-slate-700">
        {commerce.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={commerce.logoUrl} alt={commerce.name} className="w-9 h-9 rounded-lg object-contain bg-[#F8F9FB] dark:bg-slate-900 p-1" />
        ) : (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-black bg-[#EEF2F8] dark:bg-slate-700">🏷️</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-gray-900 dark:text-white truncate">{commerce.name}</p>
          <p className="text-[11px] text-gray-500 dark:text-slate-400">{promos.length} promos</p>
        </div>
        <button
          onClick={() => setExpanded(false)}
          className="w-7 h-7 rounded-full bg-[#F0F2F5] dark:bg-slate-700 flex items-center justify-center text-[#1E3A5F] dark:text-white shrink-0"
        >
          <ChevronUp size={14} />
        </button>
      </div>

      {/* Hoy */}
      {today.length > 0 && (
        <div className="px-3 pt-3">
          <p className="text-[11px] font-black text-[#1E3A5F] dark:text-white uppercase tracking-wide mb-2">Hoy</p>
          <div className="grid grid-cols-2 gap-2.5 pb-1">
            <PromoCard promo={featured} nearbyCount={nearbyCount} onClick={() => onPromoClick(featured)} onToggleSave={onToggleSave} fullWidth />
            {restToday.map(p => (
              <PromoCard key={p.id} promo={p} nearbyCount={nearbyCount} onClick={() => onPromoClick(p)} onToggleSave={onToggleSave} fullWidth />
            ))}
          </div>
        </div>
      )}

      {/* Otros días */}
      {others.length > 0 && (
        <div className="px-3 py-3">
          <button
            onClick={() => setShowOtherDays(s => !s)}
            className="text-[11px] font-bold text-[#D94F2B] flex items-center gap-1"
          >
            {showOtherDays ? 'Ocultar' : `Ver también ${others.length} promo${others.length === 1 ? '' : 's'} de otros días`}
            {showOtherDays ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showOtherDays && (
            <div className="grid grid-cols-2 gap-2.5 pt-2.5 pb-1">
              {others.map(p => (
                <PromoCard key={p.id} promo={p} nearbyCount={nearbyCount} onClick={() => onPromoClick(p)} onToggleSave={onToggleSave} fullWidth />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

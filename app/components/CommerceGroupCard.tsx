'use client'
import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import PromoCard from './PromoCard'

type Req = {
  bank?: { name: string; slug?: string } | null
  wallet?: { name: string; slug?: string } | null
  discountType?: string
  discountValue?: number
  nxmN?: number | null
  nxmM?: number | null
}

type OtherDayPromo = {
  id: string
  validDays: number
  bestDiscountValue: number
  bestDiscountType: string | null
  bankName: string | null
  walletName: string | null
}

type Promo = {
  id: string
  title: string
  slug?: string | null
  validDays: number
  salesChannel?: string | null
  coverageStatus?: 'NEARBY' | 'TERRITORIAL' | 'ONLINE' | 'UNKNOWN' | null
  coverageLabel?: string | null
  isSaved?: boolean
  category: { name: string; color: string; icon?: string }
  commerce: { id?: string; name: string; logoUrl?: string | null }
  requirements: Req[]
  otherDayPromos?: OtherDayPromo[]
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function firstDayLabel(validDays: number): string {
  for (let d = 0; d < 7; d++) {
    if (validDays & (1 << d)) return DAY_NAMES[d]
  }
  return 'otro día'
}

function discountLabel(op: OtherDayPromo): string {
  const kind = op.bestDiscountType === 'PERCENTAGE_REINTEGRO' ? 'de reintegro' : 'de descuento'
  return `${op.bestDiscountValue}% ${kind}`
}

// Alerta Inteligente de Oportunidad (dictamen CPO 24/8/2026): entre las promos de otros
// días adjuntadas por el backend, junta TODAS las que superen estrictamente a la destacada
// de hoy — no solo la mejor. El usuario decide cuál le conviene según su propia tarjeta,
// nunca se le oculta una alternativa para simplificar el mensaje.
function findBetterOtherDayPromos(featured: Promo): OtherDayPromo[] {
  const otherDays = featured.otherDayPromos
  if (!otherDays?.length) return []
  const todayBest = discountValue(featured)
  return otherDays
    .filter(op => op.bestDiscountValue > todayBest)
    .sort((a, b) => b.bestDiscountValue - a.bestDiscountValue)
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
  onToggleSaveCommerce?: (name: string, e: React.MouseEvent) => void
  isCommerceSaved?: boolean
  nearbyCount?: number | null
  priority?: boolean
  onRegisterUsage?: (req: any, promo: P, e: React.MouseEvent) => void
}

export default function CommerceGroupCard<P extends Promo>({ commerce, promos, onPromoClick, onToggleSave, onToggleSaveCommerce, isCommerceSaved, nearbyCount, priority, onRegisterUsage }: Props<P>) {
  const [expanded, setExpanded] = useState(false)
  const [showOtherDays, setShowOtherDays] = useState(false)
  const [showAlertDetail, setShowAlertDetail] = useState(false)

  if (promos.length === 0) return null

  const todayMask = 1 << new Date().getDay()
  const sorted = [...promos].sort((a, b) => discountValue(b) - discountValue(a))
  const today = sorted.filter(p => isValidToday(p, todayMask))
  const others = sorted.filter(p => !isValidToday(p, todayMask))
  const featured = today[0] ?? sorted[0]
  const restToday = today.filter(p => p.id !== featured.id)
  const betterOtherDays = findBetterOtherDayPromos(featured)
  const bestOtherDay = betterOtherDays[0] ?? null

  if (!expanded) {
    return (
      <div className="flex-shrink-0 relative" style={{ width: 'calc((100vw - 48px) / 2.1)', minWidth: 148, maxWidth: 175 }}>
        <PromoCard promo={featured} nearbyCount={nearbyCount} onClick={() => onPromoClick(featured)} onToggleSave={onToggleSave} onToggleSaveCommerce={onToggleSaveCommerce} isCommerceSaved={isCommerceSaved} fullWidth priority={priority} onRegisterUsage={onRegisterUsage} />
        {bestOtherDay && (
          <button
            onClick={() => setExpanded(true)}
            className="mt-1.5 w-full text-[11px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl py-1.5 px-2 flex items-center justify-center gap-1 shadow-sm shadow-amber-500/30 animate-pulse"
          >
            <Zap size={12} className="shrink-0 fill-white" />
            {betterOtherDays.length > 1
              ? `Hay ${betterOtherDays.length} días con mejores condiciones`
              : `${firstDayLabel(bestOtherDay.validDays)} tenés ${bestOtherDay.bestDiscountValue}%`}
          </button>
        )}
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

      {/* Alerta Inteligente de Oportunidad */}
      {bestOtherDay && (
        <div className="mx-3 mt-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-2.5 shadow-md shadow-amber-500/20">
          <div className="flex items-start gap-2">
            <Zap size={16} className="shrink-0 mt-0.5 fill-white text-white" />
            <p className="text-[12px] font-bold text-white leading-snug flex-1">
              ¡Atención! El {firstDayLabel(bestOtherDay.validDays)}, con{' '}
              {bestOtherDay.bankName ?? bestOtherDay.walletName ?? 'otro medio de pago'}, tenés un{' '}
              {discountLabel(bestOtherDay)} en este local.
            </p>
          </div>
          {betterOtherDays.length > 1 && (
            <>
              <button
                onClick={() => setShowAlertDetail(s => !s)}
                className="mt-1.5 ml-6 text-[11px] font-bold text-white/90 underline flex items-center gap-1"
              >
                {showAlertDetail ? 'Ocultar' : `Ver las otras ${betterOtherDays.length - 1} opciones`}
                {showAlertDetail ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showAlertDetail && (
                <ul className="mt-2 ml-6 space-y-1">
                  {betterOtherDays.slice(1).map(op => (
                    <li key={op.id} className="text-[11px] text-white/95 font-semibold">
                      • {firstDayLabel(op.validDays)}, con {op.bankName ?? op.walletName ?? 'otro medio de pago'}: {discountLabel(op)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Hoy */}
      {today.length > 0 && (
        <div className="px-3 pt-3">
          <p className="text-[11px] font-black text-[#1E3A5F] dark:text-white uppercase tracking-wide mb-2">Hoy</p>
          <div className="grid grid-cols-2 gap-2.5 pb-1">
            <PromoCard promo={featured} nearbyCount={nearbyCount} onClick={() => onPromoClick(featured)} onToggleSave={onToggleSave} fullWidth onRegisterUsage={onRegisterUsage} />
            {restToday.map(p => (
              <PromoCard key={p.id} promo={p} nearbyCount={nearbyCount} onClick={() => onPromoClick(p)} onToggleSave={onToggleSave} onToggleSaveCommerce={onToggleSaveCommerce} isCommerceSaved={isCommerceSaved} fullWidth onRegisterUsage={onRegisterUsage} />
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
                <PromoCard key={p.id} promo={p} nearbyCount={nearbyCount} onClick={() => onPromoClick(p)} onToggleSave={onToggleSave} onToggleSaveCommerce={onToggleSaveCommerce} isCommerceSaved={isCommerceSaved} fullWidth onRegisterUsage={onRegisterUsage} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

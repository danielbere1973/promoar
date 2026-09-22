'use client'
import React from 'react'
import LogoImg from '../LogoImg'
import type { DecisionCandidate, RubroDisplayInfo } from '@/lib/homeDecisionContract'
import { buildCandidateCopy, visualIdentity, candidatePromo } from '@/lib/homeCopy'

type Props = {
  rubro: RubroDisplayInfo
  principal: DecisionCandidate
  onOpenPromo: (promo: unknown) => void
  onOpenNearby: (commerceId: string, commerceName: string) => void
  isGuest?: boolean
}

// Desktop — lógica de Recommendation Card variante 7 (Design Lab, CPO
// Direction 12/8/2026): 3 columnas (logo | beneficio+condición | por qué).
// Ya no usa la fixture `data.ts` — todo sale de DecisionCandidate real vía
// la capa de copy (lib/homeCopy.ts). No lee `promo` para renderizar: solo lo
// reenvía como handle opaco al click.
export default function RubroPrincipalCard({ rubro, principal, onOpenPromo, onOpenNearby, isGuest }: Props) {
  const copy = buildCandidateCopy(principal)
  const identity = visualIdentity(principal)
  const commerceId = (principal.promo as any)?.commerceId ?? null

  return (
    <div className="w-full">
      <div className="text-[11px] font-bold text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {rubro.icon && <span aria-hidden="true">{rubro.icon}</span>}
        {rubro.label}
      </div>

      <button
        onClick={() => onOpenPromo(candidatePromo(principal))}
        className="w-full text-left grid grid-cols-[96px_1fr] lg:grid-cols-[140px_minmax(0,280px)_1fr] bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 rounded-2xl overflow-hidden hover:border-[#1D3D6E]/40 dark:hover:border-[#3A6BC4]/50 hover:shadow-[0_8px_24px_rgba(29,61,110,0.12)] transition-all group"
      >
        <div className="flex items-center justify-center p-4 row-span-2 lg:row-span-1 border-r border-[#F0F2F5] dark:border-slate-700">
          <LogoImg
            src={identity.logoUrl ?? ''}
            fallbackInitial={identity.fallbackInitial}
            fallbackColor={identity.fallbackColor}
            alt={principal.facts.commerceName}
            size={72}
          />
        </div>

        <div className="p-4 flex flex-col justify-center gap-1.5 lg:border-r border-[#F0F2F5] dark:border-slate-700 min-w-0">
          <p className="text-[13px] font-bold text-[#0D1B2E] dark:text-white truncate">{principal.facts.commerceName}</p>
          {isGuest ? (
            <p className="text-[19px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-snug">
              {copy.guestHeadline}
            </p>
          ) : (
            <p className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
                {copy.benefit.headline}{copy.benefit.unit}
              </span>
              <span className="text-[12px] text-slate-400 dark:text-slate-500">{copy.benefit.qualifier}</span>
            </p>
          )}
          {copy.cap && (
            <span className="inline-flex w-fit items-center text-[11px] font-extrabold text-[#0F6B3C] dark:text-[#4ADE80] bg-[#E7F6EC] dark:bg-[#123322] rounded-full px-2.5 py-0.5">
              {copy.cap}
            </span>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isGuest && <p className="text-[11px] font-semibold text-[#5A6B85] dark:text-slate-400 truncate">{copy.paymentMethod}</p>}
            {copy.nearby && commerceId && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); onOpenNearby(commerceId, principal.facts.commerceName) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenNearby(commerceId, principal.facts.commerceName) } }}
                className="inline-flex items-center text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 bg-[#F0F2F5] dark:bg-slate-800 rounded-full px-2 py-0.5 shrink-0 hover:bg-[#E4E8EF] dark:hover:bg-slate-700 transition-colors"
              >
                {copy.nearby}
              </span>
            )}
            {copy.nearby && !commerceId && (
              <span className="inline-flex items-center text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 bg-[#F0F2F5] dark:bg-slate-800 rounded-full px-2 py-0.5 shrink-0">
                {copy.nearby}
              </span>
            )}
          </div>
          {copy.validity && <p className="text-[11px] text-slate-400 dark:text-slate-500">{copy.validity}</p>}
        </div>

        <div className="px-4 pb-4 pt-3 lg:p-4 col-span-2 lg:col-span-1 border-t lg:border-t-0 border-[#F0F2F5] dark:border-slate-700 flex flex-col gap-1.5 min-w-0">
          <p className="text-[11px] font-black text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide">Por qué te la mostramos</p>
          <ul className="flex flex-col gap-1">
            {copy.reasonsText.map((text, i) => (
              <li key={i} className="text-[11px] text-[#5A6B85] dark:text-slate-400 flex items-start gap-1.5">
                <span aria-hidden="true" className="text-[#1D3D6E] dark:text-[#8AADD4] shrink-0">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </button>

      {copy.futureUpsell && (
        <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-[#FEF6E7] dark:bg-[#2A2110] border border-[#F3D488] dark:border-[#5A480F] px-3 py-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8A317] dark:bg-[#F5C860] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E8A317] dark:bg-[#F5C860]" />
          </span>
          <p className="text-[11px] font-semibold text-[#8A5A0A] dark:text-[#F5C860] leading-snug">{copy.futureUpsell}</p>
        </div>
      )}
    </div>
  )
}

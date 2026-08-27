'use client'
import React from 'react'
import LogoImg from '../LogoImg'
import type { DecisionCandidate } from '@/lib/homeDecisionContract'
import { buildCandidateCopy, visualIdentity, candidatePromo } from '@/lib/homeCopy'

type Props = {
  alternativa: DecisionCandidate
  onOpenPromo: (promo: unknown) => void
  onOpenNearby: (commerceId: string, commerceName: string) => void
}

// Alternativas del mismo rubro — lógica compacta variante 8 (Design Lab,
// CPO Direction 12/8/2026): fila horizontal logo | comercio+beneficio |
// medio+vigencia | reason dominante. Compacta a propósito: no repite todo lo
// que ya muestra la principal.
export default function RubroAlternativaCard({ alternativa, onOpenPromo, onOpenNearby }: Props) {
  const copy = buildCandidateCopy(alternativa)
  const identity = visualIdentity(alternativa)
  const commerceId = (alternativa.promo as any)?.commerceId ?? null

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={() => onOpenPromo(candidatePromo(alternativa))}
        className="w-full text-left flex items-center gap-3 bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 rounded-xl px-3 py-2.5 hover:border-[#1D3D6E]/40 dark:hover:border-[#3A6BC4]/50 transition-colors"
      >
        <LogoImg
          src={identity.logoUrl ?? ''}
          fallbackInitial={identity.fallbackInitial}
          fallbackColor={identity.fallbackColor}
          alt={alternativa.facts.commerceName}
          size={40}
        />

        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          <p className="text-[11px] font-bold text-[#0D1B2E] dark:text-white truncate">{alternativa.facts.commerceName}</p>
          <p className="flex items-baseline gap-1">
            <span className="text-[15px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
              {copy.benefit.headline}{copy.benefit.unit}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{copy.benefit.qualifier}</span>
          </p>
          <p className="text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 truncate">{copy.paymentMethod}</p>
        </div>
      </button>

      {copy.nearby && commerceId && (
        <span
          role="button"
          tabIndex={0}
          onClick={e => { e.stopPropagation(); onOpenNearby(commerceId, alternativa.facts.commerceName) }}
          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenNearby(commerceId, alternativa.facts.commerceName) } }}
          className="self-start inline-flex items-center text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 bg-[#F0F2F5] dark:bg-slate-800 rounded-full px-2 py-0.5 mx-0.5 hover:bg-[#E4E8EF] dark:hover:bg-slate-700 transition-colors"
        >
          {copy.nearby}
        </span>
      )}

      {copy.futureUpsell && (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#FEF6E7] dark:bg-[#2A2110] border border-[#F3D488] dark:border-[#5A480F] px-2.5 py-1.5">
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E8A317] dark:bg-[#F5C860] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#E8A317] dark:bg-[#F5C860]" />
          </span>
          <p className="text-[10px] font-semibold text-[#8A5A0A] dark:text-[#F5C860] leading-snug truncate">{copy.futureUpsell}</p>
        </div>
      )}
    </div>
  )
}

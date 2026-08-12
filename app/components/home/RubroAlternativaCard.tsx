'use client'
import React from 'react'
import LogoImg from '../LogoImg'
import type { DecisionCandidate } from '@/lib/homeDecisionContract'
import { buildCandidateCopy, visualIdentity, candidatePromo } from '@/lib/homeCopy'

type Props = {
  alternativa: DecisionCandidate
  onOpenPromo: (promo: unknown) => void
}

// Alternativas del mismo rubro — lógica compacta variante 8 (Design Lab,
// CPO Direction 12/8/2026): fila horizontal logo | comercio+beneficio |
// medio+vigencia | reason dominante. Compacta a propósito: no repite todo lo
// que ya muestra la principal.
export default function RubroAlternativaCard({ alternativa, onOpenPromo }: Props) {
  const copy = buildCandidateCopy(alternativa)
  const identity = visualIdentity(alternativa)

  return (
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

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-[#0D1B2E] dark:text-white truncate">{alternativa.facts.commerceName}</p>
        <p className="flex items-baseline gap-1">
          <span className="text-[15px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
            {copy.benefit.headline}{copy.benefit.unit}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{copy.benefit.qualifier}</span>
        </p>
      </div>

      <div className="shrink-0 text-right max-w-[120px]">
        <p className="text-[10px] font-semibold text-[#5A6B85] dark:text-slate-400 truncate">{copy.paymentMethod}</p>
        {copy.dominantReasonText && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{copy.dominantReasonText}</p>
        )}
      </div>
    </button>
  )
}

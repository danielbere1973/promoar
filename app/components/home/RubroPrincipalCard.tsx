'use client'
import React from 'react'
import LogoImg from '../LogoImg'
import type { DecisionCandidate, RubroDisplayInfo } from '@/lib/homeDecisionContract'
import { buildCandidateCopy, visualIdentity, candidatePromo } from '@/lib/homeCopy'

type Props = {
  rubro: RubroDisplayInfo
  principal: DecisionCandidate
  onOpenPromo: (promo: unknown) => void
}

// Desktop — lógica de Recommendation Card variante 7 (Design Lab, CPO
// Direction 12/8/2026): 3 columnas (logo | beneficio+condición | por qué).
// Ya no usa la fixture `data.ts` — todo sale de DecisionCandidate real vía
// la capa de copy (lib/homeCopy.ts). No lee `promo` para renderizar: solo lo
// reenvía como handle opaco al click.
export default function RubroPrincipalCard({ rubro, principal, onOpenPromo }: Props) {
  const copy = buildCandidateCopy(principal)
  const identity = visualIdentity(principal)

  return (
    <div className="w-full">
      <div className="text-[11px] font-bold text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide mb-2 flex items-center gap-1.5">
        {rubro.icon && <span aria-hidden="true">{rubro.icon}</span>}
        {rubro.label}
      </div>

      <button
        onClick={() => onOpenPromo(candidatePromo(principal))}
        className="w-full text-left grid grid-cols-[140px_1fr_1fr] bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 rounded-2xl overflow-hidden hover:border-[#1D3D6E]/40 dark:hover:border-[#3A6BC4]/50 hover:shadow-[0_8px_24px_rgba(29,61,110,0.12)] transition-all group"
      >
        <div className="flex items-center justify-center p-4 border-r border-[#F0F2F5] dark:border-slate-700">
          <LogoImg
            src={identity.logoUrl ?? ''}
            fallbackInitial={identity.fallbackInitial}
            fallbackColor={identity.fallbackColor}
            alt={principal.facts.commerceName}
            size={72}
          />
        </div>

        <div className="p-4 flex flex-col justify-center gap-1.5 border-r border-[#F0F2F5] dark:border-slate-700 min-w-0">
          <p className="text-[13px] font-bold text-[#0D1B2E] dark:text-white truncate">{principal.facts.commerceName}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
              {copy.benefit.headline}{copy.benefit.unit}
            </span>
            <span className="text-[12px] text-slate-400 dark:text-slate-500">{copy.benefit.qualifier}</span>
          </p>
          {copy.cap && <p className="text-[11px] text-slate-400 dark:text-slate-500">{copy.cap}</p>}
          <p className="text-[11px] font-semibold text-[#5A6B85] dark:text-slate-400 truncate">{copy.paymentMethod}</p>
          {copy.validity && <p className="text-[11px] text-slate-400 dark:text-slate-500">{copy.validity}</p>}
        </div>

        <div className="p-4 flex flex-col gap-1.5 min-w-0">
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
    </div>
  )
}

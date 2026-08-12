'use client'
import React from 'react'
import LogoImg from '../LogoImg'
import type { DecisionCandidate, RubroDisplayInfo } from '@/lib/homeDecisionContract'
import { buildCandidateCopy, visualIdentity, candidatePromo } from '@/lib/homeCopy'

type Props = {
  rubro: RubroDisplayInfo
  principal: DecisionCandidate
  alternativas: DecisionCandidate[]
  onOpenPromo: (promo: unknown) => void
}

// Mobile — jerarquía narrativa derivada de variante 1 (Design Lab, CPO
// Direction 12/8/2026): título narrativo primero, después el número grande,
// después el resto de los Facts. Alternativas del rubro debajo, en filas
// simples (no chips comprimidos — mobile tiene más alto que ancho).
export default function RubroNarrativeCard({ rubro, principal, alternativas, onOpenPromo }: Props) {
  const copy = buildCandidateCopy(principal)
  const identity = visualIdentity(principal)

  return (
    <div className="w-full">
      <div className="text-[11px] font-bold text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide mb-2 flex items-center gap-1.5 px-4">
        {rubro.icon && <span aria-hidden="true">{rubro.icon}</span>}
        {rubro.label}
      </div>

      <div className="mx-4 rounded-3xl bg-white dark:bg-[#0F2040] border border-[#E4E8EF] dark:border-slate-700 overflow-hidden">
        <button onClick={() => onOpenPromo(candidatePromo(principal))} className="w-full text-left p-4">
          <h2 className="text-[15px] font-black text-[#0D1B2E] dark:text-white leading-snug mb-3">
            {copy.narrativeTitle}
          </h2>

          <div className="flex items-center gap-3 mb-3">
            <LogoImg
              src={identity.logoUrl ?? ''}
              fallbackInitial={identity.fallbackInitial}
              fallbackColor={identity.fallbackColor}
              alt={principal.facts.commerceName}
              size={48}
            />
            <p className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-black text-[#1D3D6E] dark:text-[#8AADD4] leading-none tabular-nums">
                {copy.benefit.headline}{copy.benefit.unit}
              </span>
              <span className="text-[12px] text-slate-400 dark:text-slate-500">{copy.benefit.qualifier}</span>
            </p>
          </div>

          {copy.cap && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">{copy.cap}</p>}

          <span className="inline-flex items-center text-[11px] font-extrabold text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] rounded-full px-3 py-1 mb-2">
            {copy.paymentMethod}
          </span>

          {copy.validity && <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">{copy.validity}</p>}

          {copy.reasonsText.length > 0 && (
            <div className="mt-2 pt-3 border-t border-[#F0F2F5] dark:border-slate-700">
              <p className="text-[10px] font-black text-[#1D3D6E] dark:text-[#8AADD4] uppercase tracking-wide mb-1.5">
                Por qué te la mostramos
              </p>
              <ul className="flex flex-col gap-1">
                {copy.reasonsText.map((text, i) => (
                  <li key={i} className="text-[11px] text-[#5A6B85] dark:text-slate-400 flex items-start gap-1.5">
                    <span aria-hidden="true" className="text-[#1D3D6E] dark:text-[#8AADD4] shrink-0">•</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </button>
      </div>

      {alternativas.length > 0 && (
        <div className="mx-4 mt-2 flex flex-col gap-1.5">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">También vimos</p>
          {alternativas.map(alt => {
            const altCopy = buildCandidateCopy(alt)
            const altIdentity = visualIdentity(alt)
            return (
              <button
                key={alt.facts.commerceName}
                onClick={() => onOpenPromo(candidatePromo(alt))}
                className="flex items-center gap-3 bg-[#F7F8FA] dark:bg-slate-800/60 border border-[#E4E8EF] dark:border-slate-700 rounded-2xl px-3 py-2.5 text-left"
              >
                <LogoImg
                  src={altIdentity.logoUrl ?? ''}
                  fallbackInitial={altIdentity.fallbackInitial}
                  fallbackColor={altIdentity.fallbackColor}
                  alt={alt.facts.commerceName}
                  size={36}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-[#0D1B2E] dark:text-white truncate">{alt.facts.commerceName}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{altCopy.paymentMethod}</p>
                </div>
                <span className="shrink-0 text-[15px] font-black text-[#1D3D6E] dark:text-[#8AADD4] tabular-nums">
                  {altCopy.benefit.headline}{altCopy.benefit.unit}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

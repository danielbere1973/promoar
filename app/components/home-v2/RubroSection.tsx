'use client'

import { useState } from 'react'
import type { RubroSlot, RubroSlotEmptyReason } from '@/lib/homeDecisionContract'
import DecisionCard from './DecisionCard'
import type { useTracking } from '@/lib/useTracking'

const EMPTY_COPY: Record<RubroSlotEmptyReason, string> = {
  sin_candidatos: 'Sin oportunidad destacada en este rubro hoy.',
  bajo_confianza: 'Todavía no encontramos una promo lo bastante confiable en este rubro.',
  perfil_incompleto: 'Completá tu perfil para ver oportunidades en este rubro.',
}

type Track = ReturnType<typeof useTracking>['track']

export default function RubroSection({ slot, track }: { slot: RubroSlot; track: Track }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="mb-6" data-rubro={slot.rubro.id}>
      <div className="flex items-center gap-2 mb-3">
        {slot.rubro.icon && <span className="text-lg leading-none">{slot.rubro.icon}</span>}
        <h2 className="text-sm font-black text-gray-800 dark:text-gray-200 uppercase tracking-wide">
          {slot.rubro.label}
        </h2>
      </div>

      {slot.status === 'empty' ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 p-5 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{EMPTY_COPY[slot.reason]}</p>
        </div>
      ) : (
        <div>
          <DecisionCard candidate={slot.principal} variant="spotlight" rubroId={slot.rubro.id} track={track} />

          {slot.alternativas.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  const next = !expanded
                  setExpanded(next)
                  if (next) {
                    for (const c of slot.alternativas) {
                      track({
                        type: 'RECOMMENDATION_IMPRESSION',
                        rubroId: slot.rubro.id,
                        promoId: (c.promo as { id?: string } | null)?.id,
                        commerceName: c.facts.commerceName,
                        variant: 'secondary',
                      })
                    }
                  }
                }}
                className="text-xs font-bold text-[#1E3A5F] dark:text-blue-300 hover:underline py-2"
              >
                {expanded ? 'Ver menos' : `Ver ${slot.alternativas.length} más en ${slot.rubro.label.toLowerCase()} →`}
              </button>

              {expanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {slot.alternativas.map((c, i) => (
                    <DecisionCard key={i} candidate={c} variant="secondary" rubroId={slot.rubro.id} track={track} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

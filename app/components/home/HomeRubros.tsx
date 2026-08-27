'use client'
import React from 'react'
import type { HomeDecisionPayload } from '@/lib/homeDecisionContract'
import RubroPrincipalCard from './RubroPrincipalCard'
import RubroAlternativaCard from './RubroAlternativaCard'
import RubroNarrativeCard from './RubroNarrativeCard'
import RubroEmptySlot from './RubroEmptySlot'

type Props = {
  data: HomeDecisionPayload | null
  loading: boolean
  onOpenPromo: (promo: unknown) => void
  onOpenNearby: (commerceId: string, commerceName: string) => void
}

// Home organizada por rubros prioritarios (CPO Direction "Integración Home +
// Decision Engine v2", 12/8/2026) — no por Top-3 global. Consume
// HomeDecisionPayload real (RFC-008); nunca reinterpreta `promo` ni reglas
// financieras, todo lo que se renderiza sale de Facts/Reasons vía la capa de
// copy (lib/homeCopy.ts). Desktop usa V7 (principal) + V8 (alternativas);
// mobile usa V1 (narrativa), con ambos layouts montados y alternados por
// breakpoint Tailwind (md:) para no duplicar el fetch ni el estado.
export default function HomeRubros({ data, loading, onOpenPromo, onOpenNearby }: Props) {
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4 px-4 md:px-0">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-[160px] rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data) return null

  if (data.status === 'incomplete_profile') return null // OnboardingBanner ya cubre este caso

  if (data.status === 'all_empty' || data.status === 'no_location') {
    if (data.rubros.length === 0) return null
  }

  if (data.rubros.length === 0) {
    return (
      <p className="text-[13px] text-slate-400 dark:text-slate-500 px-4 md:px-0 py-6 text-center">
        No encontramos promos para esa tarjeta hoy. Probá con otra o mirá "Todas".
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {data.rubros.map(slot => {
        if (slot.status === 'empty') {
          return <RubroEmptySlot key={slot.rubro.id} rubro={slot.rubro} reason={slot.reason} />
        }

        return (
          <div key={slot.rubro.id} className="flex flex-col gap-2.5">
            {/* Desktop: V7 principal + V8 alternativas en fila */}
            <div className="hidden md:flex md:flex-col md:gap-2.5 px-0">
              <RubroPrincipalCard rubro={slot.rubro} principal={slot.principal} onOpenPromo={onOpenPromo} onOpenNearby={onOpenNearby} />
              {slot.alternativas.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  {slot.alternativas.map(alt => (
                    <RubroAlternativaCard key={alt.facts.commerceName} alternativa={alt} onOpenPromo={onOpenPromo} onOpenNearby={onOpenNearby} />
                  ))}
                </div>
              )}
            </div>

            {/* Mobile: V1 narrativa, con alternativas integradas en el mismo card */}
            <div className="md:hidden">
              <RubroNarrativeCard
                rubro={slot.rubro}
                principal={slot.principal}
                alternativas={slot.alternativas}
                onOpenPromo={onOpenPromo}
                onOpenNearby={onOpenNearby}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

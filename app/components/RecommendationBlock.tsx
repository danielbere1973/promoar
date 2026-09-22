'use client'
import React, { useEffect, useRef } from 'react'
import PromoCard from './PromoCard'
import { trackRecommendationEvent } from '@/lib/recommendationEvents'
import { useRecommendations, type Reco } from '@/lib/useRecommendations'

type Props = {
  province?: string | null
  onOpenPromo: (promo: any) => void
  onGoToProfile: () => void
  onShareLocation: () => void
  /** Si true, no renderiza la primera recomendación (ya la muestra el Hero arriba). */
  skipFirst?: boolean
}

// Bloque nunca se oculta (ajuste CPO Review #1 punto 3) — siempre ocupa el
// mismo lugar en la Home, con uno de 4 estados posibles.
// Top 3 con jerarquía visual: 1ra dominante (fila completa), 2da y 3ra como
// oportunidades secundarias en grilla (CPO Direction "Nueva Home", 5/8/2026).
export default function RecommendationBlock({ province, onOpenPromo, onGoToProfile, onShareLocation, skipFirst }: Props) {
  const { data, loading, shownRef } = useRecommendations(province)

  useEffect(() => {
    if (!data || shownRef.current) return
    shownRef.current = true
    if (data.status === 'empty') {
      trackRecommendationEvent('recommendation_empty', {
        recommendation_status: data.status,
        generatedAt: data.generatedAt,
        latency_ms: data.latencyMs,
      })
    } else if (data.status === 'ok' || data.status === 'no_location') {
      trackRecommendationEvent('recommendation_block_shown', {
        recommendation_status: data.status,
        generatedAt: data.generatedAt,
        latency_ms: data.latencyMs,
      })
    }
  }, [data, shownRef])

  const handleClick = (reco: Reco, position: number) => {
    if (!data) return
    trackRecommendationEvent('recommendation_clicked', {
      recommendation_position: position,
      commerceId: reco.promo.commerce?.id,
      promoId: reco.promo.id,
      recommendation_reasons: reco.reasons,
      recommendation_status: data.status,
      generatedAt: data.generatedAt,
      latency_ms: data.latencyMs,
    })
    onOpenPromo(reco.promo)
  }

  const handleCta = (cta: string) => {
    if (!data) return
    trackRecommendationEvent('recommendation_cta_clicked', {
      recommendation_status: data.status,
      generatedAt: data.generatedAt,
      latency_ms: data.latencyMs,
      cta,
    })
  }

  if (loading && !data) {
    return (
      <div className="mb-5 px-4">
        <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white mb-3">Otras oportunidades para vos</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map(i => (
            <div key={i} className="h-[150px] rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  if (data.status === 'incomplete_profile') {
    return (
      <div className="mb-5 mx-4 rounded-2xl bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] px-4 py-4">
        <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white mb-1">Para vos hoy</p>
        <p className="text-[12px] text-[#5A6B85] dark:text-slate-400 mb-3">
          Configurá tus tarjetas para ver las promos elegidas para tu perfil.
        </p>
        <button
          onClick={() => { handleCta('configurar_tarjetas'); onGoToProfile() }}
          className="text-[12px] font-extrabold rounded-lg px-3 py-2 bg-[#1D3D6E] dark:bg-[#3A6BC4] text-white hover:opacity-90 transition-opacity"
        >
          Configurá tus tarjetas
        </button>
      </div>
    )
  }

  if (data.status === 'empty') {
    return (
      <div className="mb-5 mx-4 rounded-2xl bg-[#F7F8FA] dark:bg-slate-800/60 border border-[#E4E8EF] dark:border-slate-700 px-4 py-4">
        <p className="text-[15px] font-black text-[#1E3A5F] dark:text-white mb-1">Para vos hoy</p>
        <p className="text-[12px] text-[#8B96A5] dark:text-slate-400">
          Todavía no encontramos promos que apliquen hoy a tu perfil. Mirá el listado completo más abajo.
        </p>
      </div>
    )
  }

  const secondary = skipFirst ? data.recommendations.slice(1) : data.recommendations
  const offset = skipFirst ? 1 : 0

  if (!secondary.length) {
    return data.status === 'no_location' ? (
      <div className="mx-4 mb-5 flex items-center justify-between gap-2 rounded-xl bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] px-3 py-2">
        <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">
          Compartí tu ubicación para sumar promos cerca tuyo.
        </p>
        <button
          onClick={() => { handleCta('compartir_ubicacion'); onShareLocation() }}
          className="shrink-0 text-[11px] font-extrabold text-[#1D3D6E] dark:text-[#8AADD4] whitespace-nowrap"
        >
          Compartí tu ubicación →
        </button>
      </div>
    ) : null
  }

  return (
    <div className="mb-5">
      <div className="px-4 mb-3">
        <p className="text-[13px] font-black text-[#1E3A5F] dark:text-white">
          {skipFirst ? 'Otras oportunidades para vos' : 'Para vos hoy'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-4">
        {secondary.map((reco, i) => (
          <PromoCard
            key={reco.promo.id}
            promo={reco.promo}
            reasons={reco.reasons}
            onClick={() => handleClick(reco, i + offset + 1)}
          />
        ))}
      </div>

      {data.status === 'no_location' && (
        <div className="mx-4 mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] px-3 py-2">
          <p className="text-[11px] text-[#5A6B85] dark:text-slate-400">
            Compartí tu ubicación para sumar promos cerca tuyo.
          </p>
          <button
            onClick={() => { handleCta('compartir_ubicacion'); onShareLocation() }}
            className="shrink-0 text-[11px] font-extrabold text-[#1D3D6E] dark:text-[#8AADD4] whitespace-nowrap"
          >
            Compartí tu ubicación →
          </button>
        </div>
      )}
    </div>
  )
}

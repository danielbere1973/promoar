'use client'
import React from 'react'
import type { RecommendationResponse } from '@/lib/useRecommendations'

type NearbyBranches = { count: number; minDistKm: number } | null

type Props = {
  data: RecommendationResponse | null
  nearby?: NearbyBranches
  onShareLocation: () => void
}

function isExpiringSoon(validUntil: string | Date | null | undefined): boolean {
  if (!validUntil) return false
  const until = new Date(validUntil)
  const today = new Date()
  const diffDays = Math.ceil((until.getTime() - today.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= 2
}

// Señales funcionales derivadas de datos reales ya presentes en `data`/`nearby`
// (Home v2, CPO Direction) — nunca texto promocional inventado. Cada chip solo
// se muestra si hay una señal genuina que respalde; sin señales, no renderiza nada.
export default function SignalStrip({ data, nearby, onShareLocation }: Props) {
  if (!data || data.status === 'incomplete_profile') return null

  const recos = data.status === 'ok' || data.status === 'no_location' ? data.recommendations : []
  const expiringCount = recos.filter(r => isExpiringSoon(r.promo.validUntil)).length
  const onlineCount = recos.filter(r => r.promo.salesChannel === 'ONLINE' || r.promo.salesChannel === 'BOTH').length

  const chips: { key: string; label: string }[] = []
  if (expiringCount > 0) {
    chips.push({ key: 'expiring', label: expiringCount === 1 ? '1 vence pronto' : `${expiringCount} vencen pronto` })
  }
  if (onlineCount > 0) {
    chips.push({ key: 'online', label: onlineCount === 1 ? '1 disponible online' : `${onlineCount} disponibles online` })
  }
  if (nearby && nearby.count > 0) {
    chips.push({ key: 'nearby', label: `${nearby.count} cerca tuyo` })
  }

  const showLocationCta = data.status === 'no_location'

  if (!chips.length && !showLocationCta) return null

  return (
    <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
      {chips.map(chip => (
        <span
          key={chip.key}
          className="text-[11px] font-bold text-[#5A6B85] dark:text-slate-400 bg-[#F7F8FA] dark:bg-slate-800/60 border border-[#E4E8EF] dark:border-slate-700 rounded-full px-3 py-1.5"
        >
          {chip.label}
        </span>
      ))}
      {showLocationCta && (
        <button
          onClick={onShareLocation}
          className="text-[11px] font-extrabold text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] rounded-full px-3 py-1.5"
        >
          Compartí tu ubicación →
        </button>
      )}
    </div>
  )
}

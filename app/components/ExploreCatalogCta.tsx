'use client'
import React from 'react'
import Link from 'next/link'
import { trackRecommendationEvent } from '@/lib/recommendationEvents'

type Props = {
  status: string
  generatedAt: string
  latencyMs: number
}

// Frontera explícita entre Home ("¿qué me conviene hoy?") y catálogo
// ("quiero buscar yo") — Home v2, CPO Direction. Único punto de salida de la
// Home cerrada hacia /promos/explorar.
export default function ExploreCatalogCta({ status, generatedAt, latencyMs }: Props) {
  const handleClick = () => {
    trackRecommendationEvent('recommendation_cta_clicked', {
      recommendation_status: status,
      generatedAt,
      latency_ms: latencyMs,
      cta: 'explorar_catalogo',
    })
  }

  return (
    <div className="px-4 pt-2 pb-6">
      <div className="h-px bg-[#F0F2F5] dark:bg-slate-700 mb-5" />
      <Link
        href="/promos/explorar"
        onClick={handleClick}
        className="flex items-center justify-center gap-2 w-full text-[13px] font-black text-[#1D3D6E] dark:text-[#8AADD4] bg-[#EEF2F8] dark:bg-[#16294B] border border-[#D0DBF0] dark:border-[#26406F] rounded-2xl px-5 py-3.5 hover:opacity-90 transition-opacity"
      >
        Explorar todas las promociones
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

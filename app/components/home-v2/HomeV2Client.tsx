'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { HomeDecisionPayload } from '@/lib/homeDecisionContract'
import RubroSection from './RubroSection'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; payload: HomeDecisionPayload }

export default function HomeV2Client() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    function load(lat?: number, lng?: number) {
      const qs = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : ''
      fetch(`/api/promos/home-decision${qs}`)
        .then(r => {
          if (!r.ok) throw new Error(`status ${r.status}`)
          return r.json()
        })
        .then((payload: HomeDecisionPayload) => {
          if (!cancelled) setState({ kind: 'loaded', payload })
        })
        .catch(() => {
          if (!cancelled) setState({ kind: 'error' })
        })
    }

    // Mismo patrón de cache que PromosClient.tsx (localStorage.userLocation)
    // — evita re-pedir permiso de geolocalización en cada visita.
    const cached = localStorage.getItem('userLocation')
    if (cached) {
      try {
        const { lat, lng } = JSON.parse(cached)
        load(lat, lng)
      } catch {
        load()
      }
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          localStorage.setItem('userLocation', JSON.stringify({ lat, lng, ts: Date.now() }))
          load(lat, lng)
        },
        () => load(),
        { timeout: 8000 }
      )
    } else {
      load()
    }

    return () => { cancelled = true }
  }, [])

  if (state.kind === 'loading') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="mb-6 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
            <div className="h-32 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
          </div>
        ))}
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          No pudimos cargar tu Home ahora mismo.
        </p>
        <Link href="/promos" className="text-sm font-bold text-[#D94F2B] hover:underline">
          Ver todas las promos →
        </Link>
      </div>
    )
  }

  const { payload } = state

  if (payload.status === 'incomplete_profile') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🪪</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">
          Completá tu perfil para ver tu Home
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Necesitamos saber qué bancos y tarjetas tenés para armar tus recomendaciones.
        </p>
        <Link
          href="/perfil"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D94F2B] hover:bg-[#c44325] text-white rounded-2xl font-black text-sm transition-colors"
        >
          Completar perfil →
        </Link>
      </div>
    )
  }

  if (payload.status === 'no_location') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">📍</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">
          Activá tu ubicación para ver tu Home
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Usamos tu ubicación para priorizar promos cerca tuyo.
        </p>
        <Link href="/promos" className="text-sm font-bold text-[#D94F2B] hover:underline">
          Ver todas las promos sin ubicación →
        </Link>
      </div>
    )
  }

  if (payload.status === 'all_empty') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h1 className="text-xl font-black text-gray-900 dark:text-white mb-2">
          Todavía no encontramos oportunidades para vos
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Probá explorando todas las promos disponibles.
        </p>
        <Link
          href="/promos"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D94F2B] hover:bg-[#c44325] text-white rounded-2xl font-black text-sm transition-colors"
        >
          Ver todas las promos →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {payload.rubros.map(slot => (
        <RubroSection key={slot.rubro.id} slot={slot} />
      ))}
    </div>
  )
}

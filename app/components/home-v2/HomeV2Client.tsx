'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { HomeDecisionPayload } from '@/lib/homeDecisionContract'
import RubroSection from './RubroSection'
import BottomNav from '@/app/components/BottomNav'

function HomeV2Header() {
  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-gray-100 dark:border-slate-700">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/promos" className="flex items-center gap-2 shrink-0">
          <Image src="/promoar_gabi_transparente.png" alt="PromoAR" width={40} height={40} className="w-10 h-10 object-contain" />
          <span className="font-black text-[#1E3A5F] dark:text-white text-lg tracking-tight">Tu Home</span>
        </Link>
        <Link
          href="/promos"
          className="text-xs font-bold text-[#D94F2B] hover:underline shrink-0"
        >
          Ver todas las promos →
        </Link>
      </div>
    </header>
  )
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'loaded'; payload: HomeDecisionPayload }

export default function HomeV2Client() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const requestedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    function load(lat?: number, lng?: number) {
      // Guardia contra disparos múltiples del mismo endpoint pesado: React
      // StrictMode remonta el efecto en dev, y getCurrentPosition puede
      // invocar su callback más de una vez en algunos navegadores/contextos.
      // Sin este guard, cada disparo pega contra un endpoint de ~3-85s.
      if (requestedRef.current) return
      requestedRef.current = true
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
      <>
        <HomeV2Header />
        <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="mb-6 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-3" />
              <div className="h-32 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
            </div>
          ))}
        </div>
        <BottomNav />
      </>
    )
  }

  if (state.kind === 'error') {
    return (
      <>
        <HomeV2Header />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-24 lg:pb-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No pudimos cargar tu Home ahora mismo.
          </p>
          <Link href="/promos" className="text-sm font-bold text-[#D94F2B] hover:underline">
            Ver todas las promos →
          </Link>
        </div>
        <BottomNav />
      </>
    )
  }

  const { payload } = state

  if (payload.status === 'incomplete_profile') {
    return (
      <>
        <HomeV2Header />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-24 lg:pb-16 text-center">
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
        <BottomNav />
      </>
    )
  }

  if (payload.status === 'no_location') {
    return (
      <>
        <HomeV2Header />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-24 lg:pb-16 text-center">
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
        <BottomNav />
      </>
    )
  }

  if (payload.status === 'all_empty') {
    return (
      <>
        <HomeV2Header />
        <div className="max-w-2xl mx-auto px-4 py-16 pb-24 lg:pb-16 text-center">
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
        <BottomNav />
      </>
    )
  }

  return (
    <>
      <HomeV2Header />
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
        {payload.rubros.map(slot => (
          <RubroSection key={slot.rubro.id} slot={slot} />
        ))}
      </div>
      <BottomNav />
    </>
  )
}

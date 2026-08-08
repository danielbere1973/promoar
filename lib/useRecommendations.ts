'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

export type Reco = { promo: any; reasons: string[] }
export type RecommendationStatus = 'ok' | 'incomplete_profile' | 'no_location' | 'empty'
export type RecommendationResponse = {
  status: RecommendationStatus
  recommendations: Reco[]
  missingProfile: string[] | null
  generatedAt: string
  latencyMs: number
}

// Fetch único compartido por HomeHero y RecommendationBlock — evita duplicar
// la llamada a /api/promos/recommended cuando ambos bloques viven en la misma
// pantalla. No agrega lógica de negocio nueva, solo evita el fetch repetido.
export function useRecommendations(province?: string | null) {
  const { data: session, status } = useSession()
  const [data, setData] = useState<RecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const shownRef = useRef(false)

  useEffect(() => {
    if (status === 'loading') return

    let cancelled = false
    setLoading(true)

    const params = new URLSearchParams()
    if (province) params.set('province', province)

    let guestProfile: string | null = null
    if (status !== 'authenticated') {
      try {
        const stored = localStorage.getItem('guestProfile')
        if (stored) {
          const gp = JSON.parse(stored)
          if (gp?.cards?.length) guestProfile = btoa(JSON.stringify(gp))
        }
      } catch {}
    }
    if (guestProfile) params.set('guest_profile', guestProfile)

    try {
      const cachedLoc = localStorage.getItem('userLocation')
      if (cachedLoc) {
        const { lat, lng, ts } = JSON.parse(cachedLoc)
        if (Date.now() - ts < 3600000) {
          params.set('lat', String(lat))
          params.set('lng', String(lng))
        }
      }
    } catch {}

    fetch(`/api/promos/recommended?${params.toString()}`)
      .then(r => r.json())
      .then((json: RecommendationResponse) => {
        if (cancelled) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [status, province])

  return { data, loading, shownRef }
}

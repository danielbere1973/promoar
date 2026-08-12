'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { HomeDecisionPayload } from './homeDecisionContract'

// Fetch de /api/promos/home-decision — mismo patrón que useRecommendations
// (lib/useRecommendations.ts, v1), pero apuntando al endpoint por rubros
// (v2). No comparte estado con useRecommendations: son dos contratos
// distintos (RankedRecommendation[] plano vs HomeDecisionPayload por rubro).
export function useHomeDecision(province?: string | null) {
  const { status } = useSession()
  const [data, setData] = useState<HomeDecisionPayload | null>(null)
  const [loading, setLoading] = useState(true)

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

    fetch(`/api/promos/home-decision?${params.toString()}`)
      .then(r => r.json())
      .then((json: HomeDecisionPayload) => {
        if (cancelled) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [status, province])

  return { data, loading }
}

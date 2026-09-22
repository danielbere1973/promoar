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
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const cachedLoc = localStorage.getItem('userLocation')
      if (cachedLoc) {
        const { lat, lng, ts } = JSON.parse(cachedLoc)
        if (Date.now() - ts < 1800000) { // 30 minutos
          return { lat, lng }
        }
      }
    } catch {}
    return null
  })

  // Solicitar ubicación activa si no está en cache o expiró
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return
    if (coords) return // Ya tenemos coordenadas frescas

    navigator.geolocation.getCurrentPosition(
      pos => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        try {
          localStorage.setItem('userLocation', JSON.stringify({ ...newCoords, ts: Date.now() }))
        } catch {}
        setCoords(newCoords)
      },
      () => {
        // Usuario denegó o timeout, continúa con lo que hay
      },
      { timeout: 4000, maximumAge: 600000, enableHighAccuracy: false }
    )
  }, [coords])

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

    if (coords) {
      params.set('lat', String(coords.lat))
      params.set('lng', String(coords.lng))
    }

    fetch(`/api/promos/home-decision?${params.toString()}`)
      .then(r => r.json())
      .then((json: HomeDecisionPayload) => {
        if (cancelled) return
        setData(json)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [status, province, coords])

  return { data, loading }
}

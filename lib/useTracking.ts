'use client'
import { useCallback, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'

// Genera o recupera el sessionId del usuario (persiste en localStorage)
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('trackingSessionId')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('trackingSessionId', id)
  }
  return id
}

type TrackEvent =
  | { type: 'PROMO_VIEW';     promoId: string; promoTitle: string; commerceName: string; categorySlug: string; discount?: number }
  | { type: 'CATEGORY_CLICK'; categorySlug: string; categoryName: string; action: 'select' | 'deselect' }
  | { type: 'COMMERCE_SEARCH'; query: string }
  | { type: 'COMMERCE_CLICK'; commerceName: string; source: 'dashboard' | 'filter' }
  | { type: 'FILTER_APPLY';   filterType: string; value: string }
  | { type: 'FOR_ME_TOGGLE';  value: boolean }
  | { type: 'TIME_FILTER';    value: 'today' | 'week' }

export function useTracking() {
  const ph = usePostHog?.()
  const sessionId = useRef<string>('')

  if (!sessionId.current && typeof window !== 'undefined') {
    sessionId.current = getSessionId()
  }

  const track = useCallback((event: TrackEvent) => {
    const { type, ...payload } = event
    const sid = sessionId.current

    // 1. PostHog (si está configurado)
    try { ph?.capture(type, payload) } catch {}

    // 2. DB propia — fire and forget
    if (sid) {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, eventType: type, payload }),
      }).catch(() => {})
    }
  }, [ph])

  return { track }
}

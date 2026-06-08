'use client'
import { useCallback, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'

// crypto.randomUUID() requiere contexto seguro (HTTPS o localhost) — en mobile se accede
// por IP local (http://192.168.x.x:3000), donde no existe. Fallback con crypto.getRandomValues
// (disponible en cualquier contexto) o Math.random como último recurso.
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Genera o recupera el sessionId del usuario (persiste en localStorage)
function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('trackingSessionId')
  if (!id) {
    id = generateUUID()
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

'use client'

// Instrumentación del Recommendation Block v1 (condición de autorización del
// CPO, ver memoria project_recommendation_block_v1). Reusa la infraestructura
// existente UserEvent/POST /api/events — no crea modelos ni endpoints nuevos.

const SESSION_ID_KEY = 'promoar_session_id'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sessionId = localStorage.getItem(SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

export type RecommendationEventType =
  | 'recommendation_block_shown'
  | 'recommendation_clicked'
  | 'recommendation_dismissed'
  | 'recommendation_cta_clicked'
  | 'recommendation_empty'

export interface RecommendationEventPayload {
  recommendation_position?: number
  commerceId?: string
  promoId?: string
  recommendation_reasons?: string[]
  recommendation_status: string
  generatedAt: string
  latency_ms: number
  cta?: string
}

export function trackRecommendationEvent(eventType: RecommendationEventType, payload: RecommendationEventPayload) {
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, eventType, payload }),
    keepalive: true,
  }).catch(() => {})
}

// Capa de presentación — CPO Direction "Integración Home + Decision Engine v2"
// (12/8/2026): convierte Facts + Reasons en lenguaje natural. Vive fuera del
// motor (mismo principio que lib/reasonText.ts, RFC-008 §2.5/§2.9) y fuera de
// la UI — los componentes de Home nunca arman estas frases a mano ni tocan
// `promo` crudo para decidir qué decir.
//
// No hardcodea frases por comercio: todo texto se arma a partir de
// rubro + benefit.kind + Facts + reason dominante. Soporta las 5 familias de
// BenefitFact (pct_off, reintegro, cuotas_sin_interes, monto_fijo, nxm).

import type { BenefitFact, DecisionCandidate, Facts, Reason, RubroDisplayInfo } from './homeDecisionContract'
import { reasonToText } from './reasonText'

// ─── Beneficio: headline (número grande) + unidad + calificador ───────────
export interface BenefitDisplay {
  headline: string
  unit: string
  qualifier: string
}

export function benefitDisplay(benefit: BenefitFact): BenefitDisplay {
  switch (benefit.kind) {
    case 'reintegro':
      return { headline: `${benefit.pct}`, unit: '%', qualifier: 'de reintegro' }
    case 'pct_off':
      return { headline: `${benefit.pct}`, unit: '%', qualifier: 'de descuento' }
    case 'monto_fijo':
      return { headline: `$${benefit.monto.toLocaleString('es-AR')}`, unit: '', qualifier: 'de descuento' }
    case 'cuotas_sin_interes':
      return { headline: `${benefit.cuotas}`, unit: '', qualifier: `cuota${benefit.cuotas !== 1 ? 's' : ''} sin interés` }
    case 'nxm':
      return { headline: `${benefit.n}x${benefit.m}`, unit: '', qualifier: 'en la compra' }
  }
}

// ─── Verbo de acción por rubro — para el título narrativo ("hacer la compra
// semanal en Carrefour", "cargar nafta en Axion") ──────────────────────────
const RUBRO_ACTION: Record<string, string> = {
  supermercados: 'hacer la compra',
  combustible: 'cargar nafta',
  farmacias: 'comprar en la farmacia',
  gastronomia: 'salir a comer',
  indumentaria: 'comprar ropa',
}

function rubroAction(rubroId: string): string {
  return RUBRO_ACTION[rubroId] ?? 'aprovechar esta promo'
}

// ─── Título narrativo — una frase por candidata, no por comercio ──────────
// Ej: "Te conviene hacer la compra en Carrefour: 30% de reintegro."
export function narrativeTitle(facts: Facts): string {
  const { headline, unit, qualifier } = benefitDisplay(facts.benefit)
  const action = rubroAction(facts.rubroId)
  return `Te conviene ${action} en ${facts.commerceName}: ${headline}${unit} ${qualifier}.`
}

// ─── Reason dominante — la primera de la lista ya viene priorizada por el
// motor (buildReasons corta a 3, en orden de relevancia) ───────────────────
export function dominantReason(reasons: Reason[]): Reason | null {
  return reasons[0] ?? null
}

export function dominantReasonText(reasons: Reason[]): string | null {
  const dominant = dominantReason(reasons)
  return dominant ? reasonToText(dominant) : null
}

// ─── Tope, formateado para UI ──────────────────────────────────────────────
const CAP_PERIOD_LABEL: Record<string, string> = {
  DAILY: 'por día',
  WEEKLY: 'por semana',
  MONTHLY: 'por mes',
  YEARLY: 'por año',
}

export function capLabel(facts: Facts): string | null {
  if (!facts.cap) return null
  if (facts.cap.unlimited) return 'Sin tope'
  if (facts.cap.amount == null) return null
  const period = facts.cap.period ? CAP_PERIOD_LABEL[facts.cap.period] ?? null : null
  const amount = `Tope $${facts.cap.amount.toLocaleString('es-AR')}`
  return period ? `${amount} ${period}` : amount
}

// ─── Medio de pago, formateado para UI ─────────────────────────────────────
export function paymentMethodLabel(facts: Facts): string {
  const parts = [facts.paymentMethod.bankOrWalletName, facts.paymentMethod.network, facts.paymentMethod.segment]
  return parts.filter(Boolean).join(' ')
}

// ─── Vigencia, formateado para UI ──────────────────────────────────────────
export function validityLabel(facts: Facts): string | null {
  if (facts.validity.expiresSoon && facts.validity.expiresAt) {
    const d = new Date(facts.validity.expiresAt)
    return `Vence el ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`
  }
  return facts.validity.validDaysLabel ? `Válido ${facts.validity.validDaysLabel}` : null
}

// ─── Empty state — copy por motivo, sin hardcodear por rubro ──────────────
const EMPTY_REASON_LABEL: Record<string, string> = {
  sin_candidatos: 'Todavía no encontramos promos vigentes hoy en este rubro.',
  bajo_confianza: 'No hay una oportunidad lo bastante buena para destacar hoy en este rubro.',
  perfil_incompleto: 'Completá tu perfil para ver oportunidades en este rubro.',
}

export function emptySlotText(reason: string): string {
  return EMPTY_REASON_LABEL[reason] ?? 'No hay oportunidades para mostrar en este rubro hoy.'
}

// ─── Bundle completo por candidata — lo que consumen los componentes ──────
export interface CandidateCopy {
  narrativeTitle: string
  benefit: BenefitDisplay
  cap: string | null
  paymentMethod: string
  validity: string | null
  dominantReasonText: string | null
  reasonsText: string[]
}

export function buildCandidateCopy(candidate: DecisionCandidate): CandidateCopy {
  const { facts, reasons } = candidate
  return {
    narrativeTitle: narrativeTitle(facts),
    benefit: benefitDisplay(facts.benefit),
    cap: capLabel(facts),
    paymentMethod: paymentMethodLabel(facts),
    validity: validityLabel(facts),
    dominantReasonText: dominantReasonText(reasons),
    reasonsText: reasons.map(reasonToText),
  }
}

export function rubroLabel(rubro: RubroDisplayInfo): string {
  return rubro.label
}

// ─── Identidad visual (logo/color) — no es una regla financiera, es lo único
// que la UI necesita leer de `promo` crudo (logo del comercio, ícono de
// categoría). Se resuelve acá, no en los componentes, para que ningún
// componente de Home importe/interprete el shape de `promo` directamente. ──
export interface VisualIdentity {
  logoUrl: string | null
  fallbackInitial: string
  fallbackColor: string
}

const FALLBACK_PALETTE = ['#1D3D6E', '#0a3ca8', '#E8471C', '#2E7D32', '#6A1B9A', '#B8860B']

function colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

export function visualIdentity(candidate: DecisionCandidate): VisualIdentity {
  const promo = candidate.promo as { commerce?: { logoUrl?: string | null } } | null
  const name = candidate.facts.commerceName
  return {
    logoUrl: promo?.commerce?.logoUrl ?? null,
    fallbackInitial: name.charAt(0).toUpperCase() || '?',
    fallbackColor: colorFromName(name),
  }
}

export function candidatePromo(candidate: DecisionCandidate): unknown {
  return candidate.promo
}

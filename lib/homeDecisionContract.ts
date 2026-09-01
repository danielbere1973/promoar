// Contrato de salida del Decision Engine para la Home — RFC-008 (aprobado).
// Tipos puros de datos, sin lógica de presentación ni copy. Ver
// docs/05-rfc/rfc-008-decision-engine-output-contract.md para el diseño
// completo y el razonamiento detrás de cada decisión (§2).

export type RubroId = string

export interface RubroDisplayInfo {
  id: RubroId
  label: string
  icon?: string | null
  categoryIds: string[]
}

export type ConfidenceTier = 'alta' | 'media' | 'baja'

export interface Confidence {
  value: number
  tier: ConfidenceTier
  source: 'declarada' | 'inferida' | 'default'
}

export type ReasonCode =
  | 'mayor_ahorro'
  | 'cercania'
  | 'afinidad_declarada'
  | 'afinidad_inferida'
  | 'favorito'
  | 'disponible_online'
  | 'valido_hoy'
  | 'vence_pronto'
  | 'oportunidad_infrecuente'
  | 'maximiza_ahorro_mensual'
  | 'coincide_gasto_habitual'

export interface Reason {
  code: ReasonCode
  params?: Record<string, string | number>
}

export type RecurrenceTag =
  | 'recurrente'
  | 'periodica'
  | 'ocasional'
  | 'contexto_especifico'
  | 'unico_uso'

export type BenefitFact =
  | { kind: 'pct_off'; pct: number }
  | { kind: 'reintegro'; pct: number }
  | { kind: 'cuotas_sin_interes'; cuotas: number }
  | { kind: 'monto_fijo'; monto: number }
  | { kind: 'nxm'; n: number; m: number }

export interface CapFact {
  amount: number | null
  unlimited: boolean
  period?: string | null
}

export interface PaymentMethodFact {
  bankOrWalletName: string
  network?: string | null
  segment?: string | null
}

export interface ValidityFact {
  validDaysLabel: string | null
  expiresAt: string | null
  expiresSoon: boolean
}

export interface Facts {
  rubroId: RubroId
  commerceName: string
  benefit: BenefitFact
  cap: CapFact | null
  paymentMethod: PaymentMethodFact
  validity: ValidityFact
}

export interface DecisionCandidate {
  promo: unknown
  facts: Facts
  score: number
  confidence: Confidence
  reasons: Reason[]
  reasonsText?: string[]
  recurrence?: RecurrenceTag | null
}

export type RubroSlotEmptyReason =
  | 'sin_candidatos'
  | 'bajo_confianza'
  | 'perfil_incompleto'

export type RubroSlot =
  | { status: 'ok'; rubro: RubroDisplayInfo; principal: DecisionCandidate; alternativas: DecisionCandidate[] }
  | { status: 'empty'; rubro: RubroDisplayInfo; reason: RubroSlotEmptyReason }

export type HomeDecisionStatus =
  | 'ok'
  | 'all_empty'
  | 'incomplete_profile'
  | 'no_location'
  // CPO Dictamen "Estado guest/sin perfil en Home v2" (31/8/2026): un
  // visitante sin perfil financiero (guest puro o logueado sin tarjetas) ya
  // no ve 'incomplete_profile' con rubros:[] — ve una vidriera de destacadas
  // (mismo criterio que 'ok', pero sin personalizar). El cliente usa este
  // status para mostrar el badge "Vista general" en vez de "Recomendado para
  // vos", sin ocultar HomeRubros.
  | 'guest_showcase'

export interface HomeDecisionPayload {
  status: HomeDecisionStatus
  rubros: RubroSlot[]
  missingProfile: string[] | null
  generatedAt: string
  latencyMs: number
  snapshotStale?: boolean
  engineVersion: string
}

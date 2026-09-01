// Decision Engine v2 — motor de decisión puro (sin I/O) que produce
// HomeDecisionPayload (RFC-008). Implementación de DR-001 revisado
// (definicion-producto-home.md v3 §4 paso 2): incorpora scoreAfinidad con
// Dimensión A (necesidad, RFC-007 §5.1) en modo default puro — sin
// onboarding (RFC-006 explícitamente fuera de alcance de esta etapa).
//
// No reemplaza lib/decisionEngine.ts (Recommendation Block v1, congelado vía
// DR-001) — convive como sucesor para el flujo por rubros de la Home. v1
// sigue siendo la fuente de verdad para cualquier consumidor que ya dependa
// de RankedRecommendation[].
//
// Reglas financieras (bitmask de días, qué requirement matchea el perfil,
// cómo resolver capUnlimited) se resuelven acá, una sola vez — Facts sale
// con todo ya interpretado para que la Home nunca tenga que volver a tocar
// `promo` crudo (RFC-008 §5, deliverable #5 de la CPO Direction 11/8/2026).

import type {
  BenefitFact,
  CapFact,
  Confidence,
  ConfidenceTier,
  DecisionCandidate,
  Facts,
  HomeDecisionPayload,
  HomeDecisionStatus,
  PaymentMethodFact,
  Reason,
  RubroSlot,
  ValidityFact,
} from './homeDecisionContract'
import { RUBRO_CATALOG, HOME_RUBRO_COUNT, type RubroConfig } from './rubroCatalog'

export type NearbyMap = Record<string, { count: number; minDistKm: number }>

export interface DecisionContext {
  hasLocation: boolean
  nearbyByCommerceId: NearbyMap
  todayBit: number
  now?: Date
  // Guest permisivo (RFC guest 31/8/2026): habilita el fallback a
  // globalMaxDiscount en scoreAhorro cuando userBestDiscount es null. Ver
  // comentario en scoreAhorro. undefined/false = comportamiento de siempre.
  allowGlobalDiscountFallback?: boolean
}

export interface PersonaPreferences {
  // Categorías declaradas explícitamente por el usuario en onboarding
  // (RFC-006). No hay onboarding real todavía — queda listo para cuando
  // exista, sin que el resto del motor tenga que cambiar (RFC-007 §1-2).
  declaredCategorySlugs?: string[]
}

const ENGINE_VERSION = 'decision-engine-v2.0.0'
const MAX_ALTERNATIVAS = 2
const CONFIDENCE_THRESHOLD_OK = 0.35 // por debajo de esto, el rubro se muestra 'empty' (bajo_confianza)
const DIAS_PARA_VENCE_PRONTO = 3

// ─── Gates ──────────────────────────────────────────────────────────────────
function passesVigencia(promo: any, todayBit: number): boolean {
  return (promo.validDays & todayBit) !== 0
}

// ─── Factores heredados de v1 (RFC-007 §0-§4, sin cambios de lógica) ───────
// allowGlobalFallback (guest permisivo, RFC guest 31/8/2026): solo un guest
// sin tarjetas cargadas puede caer a globalMaxDiscount — mismo fallback que
// buildFacts ya usa para Facts. Para un usuario logueado con perfil real,
// userBestDiscount=null significa "no matchea ninguno de sus requirements", y
// scorear con globalMaxDiscount (el mejor descuento de CUALQUIER requirement,
// aunque sea de un banco que el usuario no tiene) inflaría el score de una
// promo que en realidad no puede usar. Sin este fallback en modo guest,
// scoreAhorro devolvía 0 para toda promo con requirement de banco/wallet
// específico — tumbaba rubros enteros (Combustible, Mascotas) por debajo de
// CONFIDENCE_THRESHOLD_OK pese a tener candidatas reales con buen descuento.
function scoreAhorro(promo: any, allowGlobalFallback: boolean): number {
  const best = promo.userBestDiscount ?? (allowGlobalFallback ? promo.globalMaxDiscount : null)
  if (!best) return 0
  if (best.discountType === 'CUOTAS_SIN_INTERES' || best.discountType === 'NXM') return 0.3
  const pct = best.discountValue ?? 0
  const capFactor = best.capUnlimited || best.cap == null ? 1 : Math.min(1, best.cap / 5000)
  return Math.min(1, pct / 40) * (0.5 + 0.5 * capFactor)
}

function scoreCercania(promo: any, ctx: DecisionContext): number {
  if (!ctx.hasLocation) return 0
  const commerceId = promo.commerceId
  if (!commerceId) return 0
  const nearby = ctx.nearbyByCommerceId[commerceId]
  if (!nearby) return 0
  return Math.max(0, Math.min(1, 1 - nearby.minDistKm / 5))
}

function scoreOnline(promo: any): number {
  return promo.salesChannel === 'ONLINE' || promo.salesChannel === 'BOTH' ? 1 : 0
}

function scoreFavoritos(promo: any): number {
  return promo.isSaved ? 1 : 0
}

// ─── scoreAfinidad — RFC-007 §1-§5. Precedencia Declarada > Inferida > Default.
// Sin onboarding real todavía: Declarada solo se activa si se inyecta
// explícitamente vía PersonaPreferences (test/futuro), Inferida no existe
// aún (RFC-007 §8, requiere volumen de eventos de comportamiento que hoy no
// se recolecta) — en producción esto corre en modo Default puro, que es
// exactamente lo que el spike (17 casos, 9 perfiles) validó como suficiente
// para el lanzamiento (definicion-producto-home.md v3 §3).
const NECESIDAD_ALTA = new Set(['supermercados', 'combustible', 'transporte', 'farmacias', 'petshops'])
const NECESIDAD_MEDIA = new Set(['salud-y-belleza', 'hogar', 'automotores'])

function defaultAfinidadPorCategoria(categorySlug: string | null | undefined): number {
  if (!categorySlug) return 0.25
  if (NECESIDAD_ALTA.has(categorySlug)) return 0.8
  if (NECESIDAD_MEDIA.has(categorySlug)) return 0.5
  return 0.25
}

function scoreAfinidad(promo: any, prefs: PersonaPreferences | undefined): { value: number; source: Confidence['source'] } {
  const slug = promo.category?.slug ?? null
  if (prefs?.declaredCategorySlugs?.length && slug && prefs.declaredCategorySlugs.includes(slug)) {
    return { value: 1, source: 'declarada' }
  }
  return { value: defaultAfinidadPorCategoria(slug), source: 'default' }
}

// ─── Pesos — RFC-007 §4, hipótesis de spike (ya validada, no calibración final)
const WEIGHTS = { ahorro: 0.35, afinidad: 0.30, cercania: 0.18, online: 0.11, favoritos: 0.06 }

interface ScoredFactors {
  ahorro: number
  afinidad: number
  cercania: number
  online: number
  favoritos: number
  afinidadSource: Confidence['source']
}

function scorePromo(promo: any, ctx: DecisionContext, prefs: PersonaPreferences | undefined) {
  const ahorro = scoreAhorro(promo, !!ctx.allowGlobalDiscountFallback)
  const { value: afinidad, source: afinidadSource } = scoreAfinidad(promo, prefs)
  const cercania = scoreCercania(promo, ctx)
  const online = scoreOnline(promo)
  const favoritos = scoreFavoritos(promo)
  const score =
    ahorro * WEIGHTS.ahorro +
    afinidad * WEIGHTS.afinidad +
    cercania * WEIGHTS.cercania +
    online * WEIGHTS.online +
    favoritos * WEIGHTS.favoritos
  const factors: ScoredFactors = { ahorro, afinidad, cercania, online, favoritos, afinidadSource }
  return { score, factors }
}

// ─── Confidence — RFC-008 §2.1. Distinto de score: decide si la oportunidad
// alcanza para mostrarse como destacada del rubro, no solo cómo rankea dentro
// del conjunto ya filtrado. Se deriva del mismo score ponderado: una promo con
// score alto ya combina ahorro real + relevancia + contexto, que es
// exactamente lo que "confianza para destacar sola" necesita representar. El
// corte exacto de tiers es hipótesis de spike, no calibración final (RFC-008 §4).
function confidenceTierFromValue(value: number): ConfidenceTier {
  if (value >= 0.6) return 'alta'
  if (value >= CONFIDENCE_THRESHOLD_OK) return 'media'
  return 'baja'
}

function buildConfidence(score: number, afinidadSource: Confidence['source']): Confidence {
  return {
    value: Math.max(0, Math.min(1, score)),
    tier: confidenceTierFromValue(score),
    source: afinidadSource,
  }
}

// ─── Facts — RFC-008 §2.9/§3. Reglas financieras resueltas acá, una sola vez.
function buildBenefitFact(best: any): BenefitFact {
  if (!best) return { kind: 'pct_off', pct: 0 }
  switch (best.discountType) {
    case 'CUOTAS_SIN_INTERES':
      return { kind: 'cuotas_sin_interes', cuotas: best.nxmN ?? best.discountValue ?? 0 }
    case 'NXM':
      return { kind: 'nxm', n: best.nxmN ?? 0, m: best.nxmM ?? 0 }
    case 'FIXED_AMOUNT':
      return { kind: 'monto_fijo', monto: best.discountValue ?? 0 }
    case 'PERCENTAGE_REINTEGRO':
      return { kind: 'reintegro', pct: best.discountValue ?? 0 }
    case 'PERCENTAGE_DESCUENTO':
    case 'BONIFICACION':
    default:
      return { kind: 'pct_off', pct: best.discountValue ?? 0 }
  }
}

function buildCapFact(best: any): CapFact | null {
  if (!best) return null
  return {
    amount: best.capUnlimited ? null : (best.cap ?? null),
    unlimited: !!best.capUnlimited,
    period: best.capPeriod ?? null,
  }
}

function buildPaymentMethodFact(best: any): PaymentMethodFact {
  if (!best) return { bankOrWalletName: 'Sin requisito específico' }
  const bankOrWalletName = best.bank?.name ?? best.wallet?.name ?? 'Sin requisito específico'
  return {
    bankOrWalletName,
    network: best.cardNetwork?.name ?? null,
    segment: best.cardSegmentRef?.name ?? best.segment ?? null,
  }
}

const DAY_NAMES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

function buildValidDaysLabel(mask: number | null): string | null {
  if (mask == null) return null
  if (mask === 127) return 'todos los días'
  if (mask === 62) return 'de lunes a viernes'
  if (mask === 65) return 'los fines de semana'
  if (mask === 97) return 'los viernes, sábados y domingos'
  if (mask === 96) return 'los viernes y sábados'
  if (mask === 126) return 'de lunes a sábado'
  if (mask === 63) return 'de domingo a viernes'
  const active = Array.from({ length: 7 }, (_, i) => (mask & (1 << i)) ? DAY_NAMES[i] : null).filter(Boolean) as string[]
  if (active.length === 0) return null
  if (active.length === 1) return `los ${active[0]}`
  return `los ${active.slice(0, -1).join(', ')} y ${active[active.length - 1]}`
}

function buildValidityFact(promo: any, now: Date): ValidityFact {
  const validDaysLabel = buildValidDaysLabel(promo.validDays ?? null)
  const expiresAt = promo.validUntil ? new Date(promo.validUntil).toISOString() : null
  let expiresSoon = false
  if (promo.validUntil) {
    const until = new Date(promo.validUntil)
    const diffDays = (until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    expiresSoon = diffDays >= 0 && diffDays <= DIAS_PARA_VENCE_PRONTO
  }
  return { validDaysLabel, expiresAt, expiresSoon }
}

function buildFacts(promo: any, rubroId: string, now: Date): Facts {
  const best = promo.userBestDiscount ?? promo.globalMaxDiscount ?? null
  return {
    rubroId,
    commerceName: promo.commerce?.name ?? 'Comercio',
    benefit: buildBenefitFact(best),
    cap: buildCapFact(best),
    paymentMethod: buildPaymentMethodFact(best),
    validity: buildValidityFact(promo, now),
  }
}

// ─── Reasons estructuradas — RFC-008 §2.5 ──────────────────────────────────
function buildReasons(promo: any, factors: ScoredFactors, ctx: DecisionContext, isTopSavingInRubro: boolean, facts: Facts): Reason[] {
  const reasons: Reason[] = []

  if (isTopSavingInRubro && factors.ahorro > 0) {
    reasons.push({ code: 'mayor_ahorro' })
  }

  if (factors.afinidad >= 0.8) {
    reasons.push({ code: factors.afinidadSource === 'declarada' ? 'afinidad_declarada' : 'coincide_gasto_habitual' })
  }

  const commerceId = promo.commerceId
  const nearby = commerceId ? ctx.nearbyByCommerceId[commerceId] : undefined
  if (nearby && factors.cercania > 0) {
    const km = nearby.minDistKm
    reasons.push({
      code: 'cercania',
      params: km < 1 ? { metros: Math.round(km * 1000) } : { km: Number(km.toFixed(1)) },
    })
  }

  if (facts.validity.expiresSoon) {
    reasons.push({ code: 'vence_pronto' })
  }

  const todayLabel = facts.validity.validDaysLabel
  if (todayLabel !== null && reasons.length < 3) {
    reasons.push({ code: 'valido_hoy' })
  }

  if (factors.online > 0 && reasons.length < 3) {
    reasons.push({ code: 'disponible_online' })
  }

  if (factors.favoritos > 0 && reasons.length < 3) {
    reasons.push({ code: 'favorito' })
  }

  return reasons.slice(0, 3) as Reason[]
}

// ─── Construcción de candidatas por rubro ──────────────────────────────────
// reasonsText NO se calcula acá — RFC-008 §2.5 es explícito: el mapeo
// código→texto acopla el motor al idioma/copy de la UI y debe vivir en la
// capa de presentación. Ver lib/reasonText.ts para el adaptador que arma
// ese campo de transición/compatibilidad a partir de Reason[] estructurado.
function toDecisionCandidate(
  promo: any,
  score: number,
  factors: ScoredFactors,
  ctx: DecisionContext,
  isTopSavingInRubro: boolean,
  rubroId: string,
  now: Date
): DecisionCandidate {
  const facts = buildFacts(promo, rubroId, now)
  const confidence = buildConfidence(score, factors.afinidadSource)
  const reasons = buildReasons(promo, factors, ctx, isTopSavingInRubro, facts)
  return { promo, facts, score, confidence, reasons, recurrence: null }
}

function buildRubroSlot(
  rubro: RubroConfig,
  promosInRubro: any[],
  ctx: DecisionContext,
  prefs: PersonaPreferences | undefined,
  now: Date
): RubroSlot {
  const candidates = promosInRubro.filter(p => passesVigencia(p, ctx.todayBit))
  if (candidates.length === 0) {
    return { status: 'empty', rubro, reason: 'sin_candidatos' }
  }

  const scoredList = candidates.map(promo => {
    const { score, factors } = scorePromo(promo, ctx, prefs)
    return { promo, score, factors }
  })

  scoredList.sort((a, b) => b.score - a.score)

  const best = scoredList[0]
  if (best.score < CONFIDENCE_THRESHOLD_OK) {
    return { status: 'empty', rubro, reason: 'bajo_confianza' }
  }

  const topSavingId = scoredList.reduce((max, cur) => (cur.factors.ahorro > max.factors.ahorro ? cur : max), scoredList[0]).promo.id

  const principal = toDecisionCandidate(best.promo, best.score, best.factors, ctx, best.promo.id === topSavingId, rubro.id, now)

  const alternativas = scoredList
    .slice(1, 1 + MAX_ALTERNATIVAS)
    .map(({ promo, score, factors }) => toDecisionCandidate(promo, score, factors, ctx, promo.id === topSavingId, rubro.id, now))

  return { status: 'ok', rubro, principal, alternativas }
}

// ─── Selección de los N mejores rubros — CPO Approval "Tus rubros" (16/8/2026).
// Reemplaza el fallback externo del Bloque A: ya no hay sustitución de rubros
// declarados sin oportunidad ni relleno hasta N con el catálogo completo. Se
// puntúa cada rubro DECLARADO/ACTIVO del universo (declaredUniverse, resuelto
// por rubroPreferences.resolveDeclaredUniverse), se descartan los 'empty', y
// se muestran hasta N ordenados por score de la candidata principal —
// desempate exacto (sin epsilon) por orden de RUBRO_CATALOG. Un usuario con
// menos de N declarados ve menos de N slots; nunca se completa con rubros no
// declarados.
function selectTopRubroSlots(
  declaredUniverse: RubroConfig[],
  promosByCategorySlug: Map<string, any[]>,
  ctx: DecisionContext,
  prefs: PersonaPreferences | undefined,
  now: Date,
  n: number = HOME_RUBRO_COUNT,
  // CPO Directiva "Vidriera guest permisiva, no restrictiva" (31/8/2026): para
  // guest, Supermercados/Farmacias/Mascotas/Combustible/Transporte se muestran
  // siempre que tengan datos (con prioridad fija, en ese orden) — el resto del
  // catálogo compite por score solo por el/los slots que sobren. undefined =
  // comportamiento de siempre (todo compite por score, caso usuario logueado).
  guestPriorityIds?: string[]
): RubroSlot[] {
  const built = declaredUniverse.map(rubro => {
    const promosInRubro = rubro.categorySlugs.flatMap(slug => promosByCategorySlug.get(slug) ?? [])
    return { rubro, slot: buildRubroSlot(rubro, promosInRubro, ctx, prefs, now) }
  })

  const ok = built.filter(
    (b): b is { rubro: RubroConfig; slot: Extract<RubroSlot, { status: 'ok' }> } => b.slot.status === 'ok'
  )

  const catalogIndex = new Map(RUBRO_CATALOG.map((r, i) => [r.id, i]))
  const byScore = (a: typeof ok[number], b: typeof ok[number]) => {
    if (b.slot.principal.score !== a.slot.principal.score) return b.slot.principal.score - a.slot.principal.score
    return (catalogIndex.get(a.rubro.id) ?? 0) - (catalogIndex.get(b.rubro.id) ?? 0)
  }

  if (guestPriorityIds && guestPriorityIds.length > 0) {
    const priorityIndex = new Map(guestPriorityIds.map((id, i) => [id, i]))
    const priority = ok
      .filter(b => priorityIndex.has(b.rubro.id))
      .sort((a, b) => (priorityIndex.get(a.rubro.id) ?? 0) - (priorityIndex.get(b.rubro.id) ?? 0))
    const rest = ok.filter(b => !priorityIndex.has(b.rubro.id)).sort(byScore)
    const remainingSlots = Math.max(0, n - priority.length)
    return [...priority, ...rest.slice(0, remainingSlots)].map(c => c.slot)
  }

  ok.sort(byScore)
  return ok.slice(0, n).map(c => c.slot)
}

// ─── Composición del payload completo ──────────────────────────────────────
export interface BuildHomeDecisionOptions {
  hasProfile: boolean
  missingProfile?: string[]
  // CPO Dictamen "Cierre de pendientes Guest/Home v2" (31/8/2026, Punto 3):
  // la vidriera guest_showcase muestra 6 rubros en vez de los HOME_RUBRO_COUNT
  // (5) por defecto, para transmitir abundancia a un visitante desconocido.
  // Solo se resuelve después de armar el payload (status se remapea recién en
  // buildPayloadForUser), así que quien arma el request para un visitante sin
  // perfil pasa el override acá en vez de depender del status resultante.
  rubroCount?: number
  // CPO Directiva "Vidriera guest permisiva, no restrictiva" (31/8/2026): ids
  // de RUBRO_CATALOG con prioridad fija para guest (Supermercados, Farmacias,
  // Mascotas, Combustible, Transporte, en ese orden) — el resto de los slots
  // (hasta rubroCount) compite por score. Ver GUEST_PRIORITY_RUBRO_IDS.
  guestPriorityIds?: string[]
}

export function buildHomeDecisionPayload(
  promos: any[],
  ctx: DecisionContext,
  prefs: PersonaPreferences | undefined,
  opts: BuildHomeDecisionOptions,
  declaredUniverse: RubroConfig[] = []
): HomeDecisionPayload {
  const startedAt = Date.now()

  if (!opts.hasProfile) {
    return {
      status: 'incomplete_profile',
      rubros: [],
      missingProfile: opts.missingProfile ?? [],
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      engineVersion: ENGINE_VERSION,
    }
  }

  const now = ctx.now ?? new Date()

  const promosByCategorySlug = new Map<string, any[]>()
  for (const promo of promos) {
    const slug = promo.category?.slug
    if (!slug) continue
    if (!promosByCategorySlug.has(slug)) promosByCategorySlug.set(slug, [])
    promosByCategorySlug.get(slug)!.push(promo)
  }

  const rubros: RubroSlot[] = selectTopRubroSlots(
    declaredUniverse,
    promosByCategorySlug,
    ctx,
    prefs,
    now,
    opts.rubroCount ?? HOME_RUBRO_COUNT,
    opts.guestPriorityIds
  )

  const allEmpty = rubros.length === 0 || rubros.every(r => r.status === 'empty')
  // no_location es informativo, no bloqueante (RFC-008 §3: "afecta factor
  // cercanía, no bloquea el resto") — solo se reporta cuando además no hay
  // ninguna oportunidad, que es el caso donde probablemente importa que la
  // Home explique por qué. Si hay rubros 'ok' sin ubicación, el usuario ya
  // está viendo resultados útiles y no hace falta este status.
  let status: HomeDecisionStatus = allEmpty ? 'all_empty' : 'ok'
  if (allEmpty && !ctx.hasLocation) status = 'no_location'

  return {
    status,
    rubros,
    missingProfile: null,
    generatedAt: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    engineVersion: ENGINE_VERSION,
  }
}

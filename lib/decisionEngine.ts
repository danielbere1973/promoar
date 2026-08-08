// Recommendation Block v1 — motor de decisión puro (sin I/O).
// Congelado vía DR-001 (6/8/2026). No agregar factores/gates nuevos sin
// pasar antes por una revisión de CPO — ver memoria project_recommendation_block_v1.

export type NearbyMap = Record<string, { count: number; minDistKm: number }>

export interface DecisionContext {
  hasLocation: boolean
  nearbyByCommerceId: NearbyMap
  todayBit: number
}

export interface RankedRecommendation {
  promo: any
  reasons: string[]
  score: number
}

const MAX_RECOMMENDATIONS = 3
const DIVERSITY_PENALTY = 0.1

// ─── Gates ────────────────────────────────────────────────────────────────
// Una promo solo es candidata si pasa los 3. `getPromosData` con `forMe=true`
// ya aplica el gate de compatibilidad financiera (matchesProfile) y el gate
// geográfico (ADR-001) — acá solo se re-verifica vigencia (día actual), que
// getPromosData no filtra por defecto en view='week'/sin view.
function passesVigencia(promo: any, todayBit: number): boolean {
  return (promo.validDays & todayBit) !== 0
}

// ─── Factores (0-1 cada uno) ────────────────────────────────────────────────
function scoreAhorro(promo: any): number {
  const best = promo.userBestDiscount
  if (!best) return 0
  if (best.discountType === 'CUOTAS_SIN_INTERES' || best.discountType === 'NXM') return 0.3
  const pct = best.discountValue ?? 0
  // Cap explícito bajo castiga el score — un 40% con tope de $500 vale menos
  // que un 20% sin tope para "ahorro efectivo".
  const capFactor = best.capUnlimited || best.cap == null ? 1 : Math.min(1, best.cap / 5000)
  return Math.min(1, pct / 40) * (0.5 + 0.5 * capFactor)
}

function scoreCercania(promo: any, ctx: DecisionContext): number {
  if (!ctx.hasLocation) return 0
  const commerceId = promo.commerceId
  if (!commerceId) return 0
  const nearby = ctx.nearbyByCommerceId[commerceId]
  if (!nearby) return 0
  // <=500m → 1, decae linealmente hasta 0 a los 5km
  return Math.max(0, Math.min(1, 1 - nearby.minDistKm / 5))
}

function scoreOnline(promo: any): number {
  return promo.salesChannel === 'ONLINE' || promo.salesChannel === 'BOTH' ? 1 : 0
}

function scoreFavoritos(promo: any): number {
  return promo.isSaved ? 1 : 0
}

const WEIGHTS = { ahorro: 0.5, cercania: 0.25, online: 0.15, favoritos: 0.1 }

function scorePromo(promo: any, ctx: DecisionContext) {
  const ahorro = scoreAhorro(promo)
  const cercania = scoreCercania(promo, ctx)
  const online = scoreOnline(promo)
  const favoritos = scoreFavoritos(promo)
  const score =
    ahorro * WEIGHTS.ahorro +
    cercania * WEIGHTS.cercania +
    online * WEIGHTS.online +
    favoritos * WEIGHTS.favoritos
  return { score, factors: { ahorro, cercania, online, favoritos } }
}

// ─── Razones causales ───────────────────────────────────────────────────────
// Plantillas fijas por factor activado — nunca describen la promo, explican
// por qué se eligió. Máx 2-3 por tarjeta (ver CPO Review #1 punto 4).
function buildReasons(promo: any, factors: { ahorro: number; cercania: number; online: number; favoritos: number }, ctx: DecisionContext, isTopSaving: boolean): string[] {
  const reasons: string[] = []

  if (isTopSaving && factors.ahorro > 0) {
    reasons.push('Es el mayor ahorro para tus tarjetas')
  }

  const commerceId = promo.commerceId
  const nearby = commerceId ? ctx.nearbyByCommerceId[commerceId] : undefined
  if (nearby && factors.cercania > 0) {
    const km = nearby.minDistKm
    const label = km < 1 ? `${Math.round(km * 1000)} metros` : `${km.toFixed(1)} km`
    reasons.push(`Está a ${label} de vos`)
  }

  if (promo.validUntil) {
    const until = new Date(promo.validUntil)
    const today = new Date()
    if (until.toDateString() === today.toDateString()) {
      reasons.push('Vence hoy')
    }
  }

  if (factors.online > 0 && reasons.length < 3) {
    reasons.push('Podés usarla ahora mismo, sin moverte')
  }

  if (factors.favoritos > 0 && reasons.length < 3) {
    reasons.push('La guardaste como favorita')
  }

  if (reasons.length === 0) {
    reasons.push('Compatible con tu banco principal')
  }

  return reasons.slice(0, 3)
}

// ─── Diversidad entre categorías ────────────────────────────────────────────
// Re-rank greedy: al elegir cada posición siguiente, penaliza (no descarta)
// candidatos cuya categoría ya fue elegida en una posición anterior. Regla
// suave — si la mejor opción restante es de una categoría repetida pero el
// resto son mucho peores, igual puede ganar.
function selectWithDiversity(scored: { promo: any; score: number; factors: any }[]): { promo: any; score: number; factors: any }[] {
  const remaining = [...scored].sort((a, b) => b.score - a.score)
  const picked: { promo: any; score: number; factors: any }[] = []
  const usedCategories = new Set<string>()

  while (picked.length < MAX_RECOMMENDATIONS && remaining.length > 0) {
    let bestIdx = 0
    let bestAdjusted = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const catId = remaining[i].promo.category?.slug ?? remaining[i].promo.categoryId
      const penalty = usedCategories.has(catId) ? DIVERSITY_PENALTY : 0
      const adjusted = remaining[i].score * (1 - penalty)
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted
        bestIdx = i
      }
    }
    const [chosen] = remaining.splice(bestIdx, 1)
    const catId = chosen.promo.category?.slug ?? chosen.promo.categoryId
    usedCategories.add(catId)
    picked.push(chosen)
  }

  return picked
}

/**
 * Rankea promos ya filtradas por gates de compatibilidad financiera y
 * cobertura geográfica (getPromosData con forMe=true) para el Recommendation
 * Block. Aplica el gate de vigencia restante, scorea por los 4 factores,
 * re-rankea por diversidad, y arma razones causales.
 */
export function rankForHome(promos: any[], context: DecisionContext): RankedRecommendation[] {
  const candidates = promos.filter(p => passesVigencia(p, context.todayBit))
  if (!candidates.length) return []

  const scored = candidates.map(promo => {
    const { score, factors } = scorePromo(promo, context)
    return { promo, score, factors }
  })

  const topSavingId = scored.reduce((max, cur) => (cur.factors.ahorro > max.factors.ahorro ? cur : max), scored[0])?.promo?.id

  const picked = selectWithDiversity(scored)

  return picked.map(({ promo, score, factors }) => ({
    promo,
    score,
    reasons: buildReasons(promo, factors, context, promo.id === topSavingId),
  }))
}

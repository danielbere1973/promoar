// Spike de validación — Recommendation Model v2 (scoreAfinidad)
//
// Copia standalone de la lógica de lib/decisionEngine.ts (v1, congelado vía
// DR-001) + un 5to factor scoreAfinidad, siguiendo RFC-007 v3 §4/§5. Vive
// fuera de decisionEngine.ts a propósito: no se toca el archivo congelado
// hasta tener evidencia (CPO Direction 10/8/2026 y previas).
//
// NO IMPORTAR EN CÓDIGO DE PRODUCCIÓN. Solo para scripts/spike-recommendation-v2/*.

export type NearbyMap = Record<string, { count: number; minDistKm: number }>

export interface DecisionContext {
  hasLocation: boolean
  nearbyByCommerceId: NearbyMap
  todayBit: number
}

export interface RankedRecommendationV2 {
  promo: any
  reasons: string[]
  score: number
  factors: { ahorro: number; afinidad: number; cercania: number; online: number; favoritos: number }
}

const MAX_RECOMMENDATIONS = 3
const DIVERSITY_PENALTY = 0.1

function passesVigencia(promo: any, todayBit: number): boolean {
  return (promo.validDays & todayBit) !== 0
}

// ─── Factores heredados de v1 (sin cambios de lógica) ──────────────────────
function scoreAhorro(promo: any): number {
  const best = promo.userBestDiscount
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

// ─── Factor nuevo: scoreAfinidad (RFC-007 §1-§5) ───────────────────────────
// Combina las 3 fuentes de preferencia: Declarada (floor) > Inferida (evidencia
// de uso) > Default (Dimensión A — necesidad de la categoría, NO inventario).
//
// El spike no tiene onboarding real todavía (RFC-006 no implementado en UI),
// así que "Declarada" e "Inferida" quedan en 0 para todos los perfiles de este
// spike salvo que se inyecten explícitamente por persona sintética — el spike
// se concentra en medir el efecto del Default por necesidad (§5.1), que es la
// única fuente con datos reales disponibles hoy.

// Dimensión A — RFC-007 §5.1. Alta=0.8, Media=0.5, Discrecional=0.25 (escala
// 0-1 igual que los demás factores; ver RFC-007 §3 rango de scoreAfinidad).
const NECESIDAD_ALTA = new Set(['supermercados', 'combustible', 'transporte', 'farmacias', 'petshops'])
const NECESIDAD_MEDIA = new Set(['salud-y-belleza', 'hogar', 'automotores'])
// Todo lo que no está en Alta/Media (indumentaria, gastronomia, tecnologia,
// viajes-y-turismo, entretenimiento, deportes, jugueterias, heladerias,
// librerias, shoppings, otras-categorias, otros, sin-categoria) es Discrecional.

function defaultAfinidadPorCategoria(categorySlug: string | null | undefined): number {
  if (!categorySlug) return 0.25
  if (NECESIDAD_ALTA.has(categorySlug)) return 0.8
  if (NECESIDAD_MEDIA.has(categorySlug)) return 0.5
  return 0.25
}

export interface PersonaPreferences {
  // Categorías declaradas explícitamente por el usuario en onboarding (RFC-006).
  // No existe onboarding real todavía — en el spike se inyecta a mano por
  // persona sintética para simular el caso "usuario que completó onboarding".
  declaredCategorySlugs?: string[]
}

function scoreAfinidad(promo: any, prefs: PersonaPreferences | undefined): number {
  const slug = promo.category?.slug ?? null
  if (prefs?.declaredCategorySlugs?.length && slug && prefs.declaredCategorySlugs.includes(slug)) {
    return 1 // Declarada = floor máximo, nunca opacada por default (RFC-006/007 §1)
  }
  return defaultAfinidadPorCategoria(slug)
}

// ─── Pesos — RFC-007 §4, hipótesis de spike, NO calibración definitiva ─────
const WEIGHTS_V2 = { ahorro: 0.35, afinidad: 0.30, cercania: 0.18, online: 0.11, favoritos: 0.06 }

function scorePromoV2(promo: any, ctx: DecisionContext, prefs: PersonaPreferences | undefined) {
  const ahorro = scoreAhorro(promo)
  const afinidad = scoreAfinidad(promo, prefs)
  const cercania = scoreCercania(promo, ctx)
  const online = scoreOnline(promo)
  const favoritos = scoreFavoritos(promo)
  const score =
    ahorro * WEIGHTS_V2.ahorro +
    afinidad * WEIGHTS_V2.afinidad +
    cercania * WEIGHTS_V2.cercania +
    online * WEIGHTS_V2.online +
    favoritos * WEIGHTS_V2.favoritos
  return { score, factors: { ahorro, afinidad, cercania, online, favoritos } }
}

function buildReasonsV2(
  promo: any,
  factors: { ahorro: number; afinidad: number; cercania: number; online: number; favoritos: number },
  ctx: DecisionContext,
  isTopSaving: boolean
): string[] {
  const reasons: string[] = []

  if (isTopSaving && factors.ahorro > 0) {
    reasons.push('Es el mayor ahorro para tus tarjetas')
  }

  if (factors.afinidad >= 0.8) {
    reasons.push('Es un gasto habitual para vos')
  }

  const commerceId = promo.commerceId
  const nearby = commerceId ? ctx.nearbyByCommerceId[commerceId] : undefined
  if (nearby && factors.cercania > 0) {
    const km = nearby.minDistKm
    const label = km < 1 ? `${Math.round(km * 1000)} metros` : `${km.toFixed(1)} km`
    reasons.push(`Está a ${label} tuyo`)
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

function selectWithDiversity(scored: { promo: any; score: number; factors: any }[]) {
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

export function scoreCandidatesV2(
  promos: any[],
  context: DecisionContext,
  prefs?: PersonaPreferences
) {
  const candidates = promos.filter(p => passesVigencia(p, context.todayBit))
  return candidates.map(promo => {
    const { score, factors } = scorePromoV2(promo, context, prefs)
    return { promo, score, factors }
  })
}

export function rankForHomeV2(
  promos: any[],
  context: DecisionContext,
  prefs?: PersonaPreferences
): RankedRecommendationV2[] {
  const scored = scoreCandidatesV2(promos, context, prefs)
  if (!scored.length) return []

  const topSavingId = scored.reduce((max, cur) => (cur.factors.ahorro > max.factors.ahorro ? cur : max), scored[0])?.promo?.id
  const picked = selectWithDiversity(scored)

  return picked.map(({ promo, score, factors }) => ({
    promo,
    score,
    factors,
    reasons: buildReasonsV2(promo, factors, context, promo.id === topSavingId),
  }))
}

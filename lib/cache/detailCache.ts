import { revalidateTag } from 'next/cache'

export const PROMO_DETAIL_TAG = 'promos-detail'
export const COMMERCE_DETAIL_TAG = 'comercios-detail'
export const BANK_DETAIL_TAG = 'bancos-detail'

// Umbral a partir del cual conviene invalidar todo el dominio de una sola vez
// en vez de 1 revalidateTag por entidad — runs masivos (ej. reseteo de
// categoría, migración) no deben terminar haciendo miles de llamadas.
export const DETAIL_INVALIDATION_BULK_THRESHOLD = 200

export function promoDetailIdTag(id: string) {
  return `promo:${id}`
}

export function commerceDetailIdTag(id: string) {
  return `comercio:${id}`
}

export function bankDetailIdTag(id: string) {
  return `banco:${id}`
}

export function invalidatePromoDetailCache() {
  try {
    revalidateTag(PROMO_DETAIL_TAG)
  } catch (error) {
    console.error('[promo-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

export function invalidateCommerceDetailCache() {
  try {
    revalidateTag(COMMERCE_DETAIL_TAG)
  } catch (error) {
    console.error('[commerce-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

export function invalidateBankDetailCache() {
  try {
    revalidateTag(BANK_DETAIL_TAG)
  } catch (error) {
    console.error('[bank-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

// Invalidación granular: invalida solo las promos/comercios cuyo slug está en
// `slugs`, vía el tag compuesto que cada unstable_cache de detalle también
// declara (ver app/promos/[slug]/page.tsx, app/comercios/[slug]/page.tsx).
// Ambas páginas tagean por slug, no por id (el id solo se conoce después de
// resolver el slug, no es parte del input) — por eso no hay una variante "ByIds".
// Si `slugs.length` supera el umbral, cae a la invalidación global del dominio
// — N revalidateTag individuales en un run masivo es más caro que 1 global.

// getCachedPromoBySlug (app/promos/[slug]/page.tsx) solo conoce el slug antes
// de resolver la promo (el id es parte del resultado, no del input), así que
// se tagea por slug en vez de por id — este helper invalida por esa misma clave.
export function invalidatePromoDetailBySlugs(slugs: string[]) {
  if (slugs.length === 0) return
  if (slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
    invalidatePromoDetailCache()
    return
  }
  try {
    for (const slug of slugs) revalidateTag(promoDetailIdTag(slug))
  } catch (error) {
    console.error('[promo-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
  }
}

// Mismo caso que invalidatePromoDetailBySlugs: getCachedCommerceBySlug
// (app/comercios/[slug]/page.tsx) tagea por slug, no por id (el id del
// comercio es parte del resultado, no del input) — invalidar por id ahí no
// tendría efecto, hay que invalidar por esta misma clave de slug.
export function invalidateCommerceDetailBySlugs(slugs: string[]) {
  if (slugs.length === 0) return
  if (slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
    invalidateCommerceDetailCache()
    return
  }
  try {
    for (const slug of slugs) revalidateTag(commerceDetailIdTag(slug))
  } catch (error) {
    console.error('[commerce-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
  }
}

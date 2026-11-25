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

// Tag por comercio para las funciones auxiliares de /promos/[slug] y
// /comercios/[slug] (sucursales, otras promos del comercio, comercios
// relacionados, lista de promos del comercio, entidades del comercio) — hoy
// solo llevan el tag de dominio (PROMO_DETAIL_TAG/COMMERCE_DETAIL_TAG) y
// ningún tag por comercio, así que invalidar por slug de promo/comercio nunca
// las alcanzaba: dependían solo del TTL de 12h. Ver CLAUDE.md.
export function commerceAuxTag(slug: string) {
  return `commerce-aux:${slug}`
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
//
// Incidente 25/11/2026: expire-promos corrió con 248 promos vencidas (>200),
// cayó a la invalidación global de PROMO_DETAIL_TAG, y vació el caché de TODAS
// las fichas de promo del sitio (no solo las 248 vencidas) — las fichas de
// comercio no se vieron afectadas porque esas mismas 248 promos mapeaban a
// solo 143 comercios distintos, bajo el umbral. Fix: los flujos automáticos
// (expire-promos, scrape) nunca deben caer al fallback global — revalidateTag
// es una operación en memoria (microsegundos/pocos ms por llamada), así que
// invalidar por slug en loop, aunque sean miles, es seguro y no se acerca a
// ningún timeout de función. El fallback global queda reservado para rutas
// manuales de admin (cleanup, auto-validate) vía `alwaysBySlug: true`.
// Ver CLAUDE.md, sección "Umbral de invalidación masiva (DETAIL_INVALIDATION_BULK_THRESHOLD)".

// getCachedPromoBySlug (app/promos/[slug]/page.tsx) solo conoce el slug antes
// de resolver la promo (el id es parte del resultado, no del input), así que
// se tagea por slug en vez de por id — este helper invalida por esa misma clave.
//
// `commerceSlugs` (opcional): el slug del comercio de cada promo tocada —
// invalida también el tag commerce-aux de esos comercios, para que las 5
// funciones auxiliares de la ficha de promo (sucursales, otras promos del
// comercio, comercios relacionados) se enteren cuando una promo de ese
// comercio cambia, no solo cuando cambia el comercio en sí.
export function invalidatePromoDetailBySlugs(slugs: string[], opts?: { alwaysBySlug?: boolean; commerceSlugs?: string[] }) {
  if (slugs.length > 0) {
    if (!opts?.alwaysBySlug && slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
      invalidatePromoDetailCache()
    } else {
      try {
        for (const slug of slugs) revalidateTag(promoDetailIdTag(slug))
      } catch (error) {
        console.error('[promo-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
      }
    }
  }

  const commerceSlugs = opts?.commerceSlugs ?? []
  if (commerceSlugs.length === 0) return
  try {
    for (const slug of commerceSlugs) revalidateTag(commerceAuxTag(slug))
  } catch (error) {
    console.error('[commerce-aux-cache] revalidateTag by commerce slug failed, relying on TTL fallback', error)
  }
}

// Mismo caso que invalidatePromoDetailBySlugs: getCachedCommerceBySlug
// (app/comercios/[slug]/page.tsx) tagea por slug, no por id (el id del
// comercio es parte del resultado, no del input) — invalidar por id ahí no
// tendría efecto, hay que invalidar por esta misma clave de slug.
//
// También invalida el tag commerce-aux de cada slug — las 5 funciones
// auxiliares (branches, other-promos, related-commerces, commerce-promos,
// entities) llevan ese tag además del tag de dominio.
export function invalidateCommerceDetailBySlugs(slugs: string[], opts?: { alwaysBySlug?: boolean }) {
  if (slugs.length === 0) return
  if (!opts?.alwaysBySlug && slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
    invalidateCommerceDetailCache()
    return
  }
  try {
    for (const slug of slugs) {
      revalidateTag(commerceDetailIdTag(slug))
      revalidateTag(commerceAuxTag(slug))
    }
  } catch (error) {
    console.error('[commerce-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
  }
}

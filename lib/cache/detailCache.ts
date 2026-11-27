import { revalidateTag } from 'next/cache'

// Vercel limita revalidateTag/revalidatePath a 50 llamadas/seg a nivel
// plataforma. Los loops de invalidación por slug podían disparar cientos de
// llamadas en el mismo tick sin ningún throttle — folder-safe hoy porque
// revalidateTag es en-memoria (microsegundos), pero igual expuesto al límite
// si un batch real supera 50/seg. BATCH_SIZE deliberadamente queda por debajo
// del límite (no en el borde) para dejar margen a otra invalidación concurrente
// en el mismo segundo (otro request, otro cron).
const REVALIDATE_BATCH_SIZE = 25
const REVALIDATE_BATCH_DELAY_MS = 1000

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// Ejecuta `fn` para cada item de `items` en tandas de REVALIDATE_BATCH_SIZE,
// esperando REVALIDATE_BATCH_DELAY_MS entre tandas (sin esperar tras la
// última). Todas las llamadas de revalidateTag pasan por acá para que ningún
// loop pueda superar el límite de 50/seg de Vercel.
//
// Cada item corre en su propio try/catch: si `fn(item)` tira (ej. un
// revalidateTag puntual falla), se loguea y se sigue con el resto del batch
// y los batches siguientes — un error aislado no debe abortar toda la corrida
// (ver pedido 27/11/2026, revisión pre-merge PR #87).
async function runThrottled<T>(items: T[], fn: (item: T) => void) {
  let failed = 0
  for (let i = 0; i < items.length; i += REVALIDATE_BATCH_SIZE) {
    const batch = items.slice(i, i + REVALIDATE_BATCH_SIZE)
    for (const item of batch) {
      try {
        fn(item)
      } catch (error) {
        failed++
        console.error('[runThrottled] item failed, continuing con el resto', error)
      }
    }
    if (i + REVALIDATE_BATCH_SIZE < items.length) {
      await sleep(REVALIDATE_BATCH_DELAY_MS)
    }
  }
  return { total: items.length, failed }
}

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

// `origin` es solo para logging (ver incidente 25/11/2026 — necesitábamos saber
// qué endpoint vació el caché global y no había forma de verlo en los logs de
// Vercel). No cambia el comportamiento de la invalidación.
export function invalidatePromoDetailCache(origin?: string) {
  try {
    console.log(`[detail-invalidate-global] promos-detail${origin ? ` <- ${origin}` : ''}`)
    revalidateTag(PROMO_DETAIL_TAG)
  } catch (error) {
    console.error('[promo-detail-cache] revalidateTag failed, relying on TTL fallback', error)
  }
}

export function invalidateCommerceDetailCache(origin?: string) {
  try {
    console.log(`[detail-invalidate-global] comercios-detail${origin ? ` <- ${origin}` : ''}`)
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
export async function invalidatePromoDetailBySlugs(slugs: string[], opts?: { alwaysBySlug?: boolean; commerceSlugs?: string[]; origin?: string }) {
  const startedAt = Date.now()
  let promoResult: { total: number; failed: number } | null = null
  let fellBackToGlobal = false

  if (slugs.length > 0) {
    if (!opts?.alwaysBySlug && slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
      invalidatePromoDetailCache(opts?.origin)
      fellBackToGlobal = true
    } else {
      try {
        promoResult = await runThrottled(slugs, slug => revalidateTag(promoDetailIdTag(slug)))
      } catch (error) {
        console.error('[promo-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
      }
    }
  }

  const commerceSlugs = opts?.commerceSlugs ?? []
  let commerceAuxResult: { total: number; failed: number } | null = null
  if (commerceSlugs.length > 0) {
    try {
      commerceAuxResult = await runThrottled(commerceSlugs, slug => revalidateTag(commerceAuxTag(slug)))
    } catch (error) {
      console.error('[commerce-aux-cache] revalidateTag by commerce slug failed, relying on TTL fallback', error)
    }
  }

  const ms = Date.now() - startedAt
  console.log(
    `[invalidatePromoDetailBySlugs] promos pedidas=${slugs.length} invalidadas=${promoResult ? promoResult.total - promoResult.failed : fellBackToGlobal ? slugs.length : 0} fallidas=${promoResult?.failed ?? 0} ` +
    `commerceAux pedidos=${commerceSlugs.length} invalidados=${commerceAuxResult ? commerceAuxResult.total - commerceAuxResult.failed : 0} fallidos=${commerceAuxResult?.failed ?? 0} ` +
    `fallbackGlobal=${fellBackToGlobal} ms=${ms}`
  )
}

// Mismo caso que invalidatePromoDetailBySlugs: getCachedCommerceBySlug
// (app/comercios/[slug]/page.tsx) tagea por slug, no por id (el id del
// comercio es parte del resultado, no del input) — invalidar por id ahí no
// tendría efecto, hay que invalidar por esta misma clave de slug.
//
// También invalida el tag commerce-aux de cada slug — las 5 funciones
// auxiliares (branches, other-promos, related-commerces, commerce-promos,
// entities) llevan ese tag además del tag de dominio.
export async function invalidateCommerceDetailBySlugs(slugs: string[], opts?: { alwaysBySlug?: boolean; origin?: string }) {
  if (slugs.length === 0) return

  const startedAt = Date.now()
  if (!opts?.alwaysBySlug && slugs.length > DETAIL_INVALIDATION_BULK_THRESHOLD) {
    invalidateCommerceDetailCache(opts?.origin)
    console.log(`[invalidateCommerceDetailBySlugs] comercios pedidos=${slugs.length} fallbackGlobal=true ms=${Date.now() - startedAt}`)
    return
  }

  let result: { total: number; failed: number } | null = null
  try {
    result = await runThrottled(slugs, slug => {
      revalidateTag(commerceDetailIdTag(slug))
      revalidateTag(commerceAuxTag(slug))
    })
  } catch (error) {
    console.error('[commerce-detail-cache] revalidateTag by slug failed, relying on TTL fallback', error)
  }

  console.log(
    `[invalidateCommerceDetailBySlugs] comercios pedidos=${slugs.length} invalidados=${result ? result.total - result.failed : 0} fallidos=${result?.failed ?? 0} fallbackGlobal=false ms=${Date.now() - startedAt}`
  )
}
